import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { pool } from '../config/database';
import { emailQueue } from '../queue/emailQueue';
import { isAuthenticated } from '../middleware/auth';
import { validateScheduleEmail, handleValidationErrors, sanitizeHtml } from '../utils/validation';
import { parseCSVWithHeaders, personalizeEmail } from '../services/emailPersonalization';
import { logger } from '../utils/logger';
import { checkEmailLimit, requirePermission } from '../middleware/rbac';

const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_EMAILS_PER_BATCH = 1000;

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

// Request deduplication cache (prevents double-submit)
const requestCache = new Map<string, number>();
const CACHE_TTL = 5000; // 5 seconds

// Clean up old cache entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of requestCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      requestCache.delete(key);
    }
  }
}, 60000);

router.post('/schedule', isAuthenticated, checkEmailLimit, upload.single('file'), validateScheduleEmail, handleValidationErrors, async (req: Request, res: Response) => {
  const user = req.user as any;
  const requestKey = `${user.id}:${req.body.subject}:${req.body.startTime}`;
  
  // Check for duplicate request
  const lastRequest = requestCache.get(requestKey);
  if (lastRequest && Date.now() - lastRequest < CACHE_TTL) {
    logger.warn({ userId: user.id, requestKey }, 'Duplicate request detected, ignoring');
    return res.status(429).json({ error: 'Please wait before submitting again' });
  }
  
  requestCache.set(requestKey, Date.now());
  
  const client = await pool.connect();
  
  try {
    const { subject, body, startTime, delayBetweenEmails, hourlyLimit } = req.body;
    const user = req.user as any;

    if (!req.file) {
      return res.status(400).json({ error: 'Email list file is required' });
    }

    const startDate = new Date(startTime);
    const currentTime = new Date();
    // Allow scheduling in the past or present for immediate sending
    if (startDate.getTime() < currentTime.getTime() - 60000) {
      return res.status(400).json({ error: 'Start time is too far in the past' });
    }

    const delayMs = Math.max(1000, parseInt(delayBetweenEmails || '5') * 1000);
    const limit = Math.min(parseInt(hourlyLimit || '200'), MAX_EMAILS_PER_HOUR);

    // Parse CSV with personalization support
    const fileContent = req.file.buffer.toString('utf-8');
    const { emails, data } = parseCSVWithHeaders(fileContent);

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No valid emails found in file' });
    }

    if (emails.length > MAX_EMAILS_PER_BATCH) {
      return res.status(400).json({ 
        error: `Maximum ${MAX_EMAILS_PER_BATCH} emails per batch. You uploaded ${emails.length}` 
      });
    }

    // Sanitize email body
    const sanitizedBody = sanitizeHtml(body.trim());
    const sanitizedSubject = subject.trim();

    const nowTimestamp = Date.now();
    const values: any[] = [];
    const placeholders: string[] = [];
    const jobsToQueue: Array<{ id: string; data: any; delay: number }> = [];

    emails.forEach((email, i) => {
      const emailId = uuidv4();
      const scheduledAt = new Date(startDate.getTime() + i * delayMs);
      const delay = Math.max(0, scheduledAt.getTime() - nowTimestamp);

      // Personalize email body and subject
      const emailData = data[i] || { email };
      const personalizedBody = personalizeEmail(sanitizedBody, emailData);
      const personalizedSubject = personalizeEmail(sanitizedSubject, emailData);

      const b = i * 7 + 1;
      placeholders.push(`($${b},$${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6})`);
      values.push(emailId, user.id, email, personalizedSubject, personalizedBody, scheduledAt, 'scheduled');

      jobsToQueue.push({
        id: emailId,
        data: {
          emailId,
          recipientEmail: email,
          subject: personalizedSubject,
          body: personalizedBody,
          userId: user.id,
          hourlyLimit: limit
        },
        delay
      });
    });

    // Start transaction
    await client.query('BEGIN');

    try {
      // Insert all emails in database
      await client.query(
        `INSERT INTO emails (id, user_id, recipient_email, subject, body, scheduled_at, status) 
         VALUES ${placeholders.join(',')}`,
        values
      );

      // Queue all jobs (if this fails, transaction will rollback)
      await Promise.all(
        jobsToQueue.map(j => emailQueue.add('send-email', j.data, { delay: j.delay, jobId: j.id }))
      );

      // Commit transaction
      await client.query('COMMIT');

      logger.info({ userId: user.id, count: emails.length }, 'Emails scheduled successfully');
      return res.json({ success: true, count: emails.length });
    } catch (queueError: any) {
      // Rollback on queue failure
      await client.query('ROLLBACK');
      logger.error({ error: queueError.message, userId: user.id }, 'Failed to queue emails, rolled back');
      throw queueError;
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Schedule error');
    return res.status(500).json({ error: 'Failed to schedule emails' });
  } finally {
    client.release();
  }
});

router.get('/scheduled', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { rows } = await pool.query(
      `SELECT id, recipient_email, subject, scheduled_at, status
       FROM emails WHERE user_id = $1 AND status = 'scheduled'
       ORDER BY scheduled_at ASC LIMIT 500`,
      [user.id]
    );
    res.json(rows);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch scheduled emails');
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

router.get('/sent', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { rows } = await pool.query(
      `SELECT id, recipient_email, subject, sent_at, status, error_message
       FROM emails WHERE user_id = $1 AND status IN ('sent','failed')
       ORDER BY sent_at DESC NULLS LAST LIMIT 500`,
      [user.id]
    );
    res.json(rows);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch sent emails');
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

router.delete('/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    // Check if email belongs to user and is scheduled
    const result = await pool.query(
      'SELECT status FROM emails WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    if (result.rows[0].status !== 'scheduled') {
      return res.status(400).json({ error: 'Can only cancel scheduled emails' });
    }

    // Remove from queue
    const job = await emailQueue.getJob(id);
    if (job) {
      await job.remove();
    }

    // Update database
    await pool.query(
      `UPDATE emails SET status='cancelled', updated_at=NOW() WHERE id=$1`,
      [id]
    );

    logger.info({ emailId: id, userId: user.id }, 'Email cancelled');
    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to cancel email');
    return res.status(500).json({ error: 'Failed to cancel email' });
  }
});

// Email templates endpoints
router.get('/templates', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { rows } = await pool.query(
      'SELECT id, name, subject, body, created_at FROM email_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );
    res.json(rows);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch templates');
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/templates', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { name, subject, body } = req.body;
    const user = req.user as any;

    if (!name?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Name, subject, and body are required' });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO email_templates (id, user_id, name, subject, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, name) DO UPDATE SET
         subject = EXCLUDED.subject,
         body = EXCLUDED.body`,
      [id, user.id, name.trim(), subject.trim(), body.trim()]
    );

    return res.json({ success: true, id });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to save template');
    return res.status(500).json({ error: 'Failed to save template' });
  }
});

router.delete('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as any;

    await pool.query(
      'DELETE FROM email_templates WHERE id = $1 AND user_id = $2',
      [id, user.id]
    );

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to delete template');
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Bulk cancel emails (Available to all users)
router.post('/bulk-cancel', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { emailIds } = req.body;
    const user = req.user as any;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'Email IDs array is required' });
    }

    if (emailIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 emails can be cancelled at once' });
    }

    // Verify ownership and get scheduled emails
    const result = await pool.query(
      `SELECT id FROM emails 
       WHERE id = ANY($1) AND user_id = $2 AND status = 'scheduled'`,
      [emailIds, user.id]
    );

    const validIds = result.rows.map(r => r.id);

    if (validIds.length === 0) {
      return res.status(404).json({ error: 'No valid scheduled emails found' });
    }

    // Remove from queue
    await Promise.all(
      validIds.map(async (id) => {
        const job = await emailQueue.getJob(id);
        if (job) await job.remove();
      })
    );

    // Update database
    await pool.query(
      `UPDATE emails SET status='cancelled', updated_at=NOW() 
       WHERE id = ANY($1)`,
      [validIds]
    );

    logger.info({ userId: user.id, count: validIds.length }, 'Bulk cancelled emails');
    return res.json({ success: true, cancelled: validIds.length });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Bulk cancel failed');
    return res.status(500).json({ error: 'Failed to cancel emails' });
  }
});

// Get email statistics
router.get('/stats', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) as total,
        MIN(created_at) as first_email,
        MAX(sent_at) as last_sent
       FROM emails WHERE user_id = $1`,
      [user.id]
    );

    const stats = result.rows[0];
    const successRate = stats.sent > 0 
      ? ((parseInt(stats.sent) / (parseInt(stats.sent) + parseInt(stats.failed))) * 100).toFixed(2)
      : '0';

    return res.json({
      ...stats,
      successRate: parseFloat(successRate)
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch stats');
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get user permissions and limits
router.get('/permissions', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { getUserRole, ROLE_PERMISSIONS } = await import('../middleware/rbac');
    const userRole = await getUserRole(user.id, pool);
    const permissions = ROLE_PERMISSIONS[userRole];

    // Get current usage
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyResult = await pool.query(
      `SELECT COUNT(*) as count FROM emails 
       WHERE user_id = $1 AND created_at >= $2 AND status IN ('sent', 'scheduled')`,
      [user.id, monthStart]
    );

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyResult = await pool.query(
      `SELECT COUNT(*) as count FROM emails 
       WHERE user_id = $1 AND created_at >= $2 AND status IN ('sent', 'scheduled')`,
      [user.id, hourAgo]
    );

    return res.json({
      role: userRole,
      permissions,
      usage: {
        monthly: {
          used: parseInt(monthlyResult.rows[0].count),
          limit: permissions.maxEmailsPerMonth,
          remaining: permissions.maxEmailsPerMonth === -1 
            ? -1 
            : Math.max(0, permissions.maxEmailsPerMonth - parseInt(monthlyResult.rows[0].count))
        },
        hourly: {
          used: parseInt(hourlyResult.rows[0].count),
          limit: permissions.maxEmailsPerHour,
          remaining: permissions.maxEmailsPerHour === -1 
            ? -1 
            : Math.max(0, permissions.maxEmailsPerHour - parseInt(hourlyResult.rows[0].count))
        }
      }
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch permissions');
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Retry failed emails (Professional+ only)
router.post('/retry-failed', isAuthenticated, requirePermission('canBulkSend'), async (req: Request, res: Response) => {
  try {
    const { emailIds } = req.body;
    const user = req.user as any;

    if (!Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'Email IDs array is required' });
    }

    // Get failed emails
    const result = await pool.query(
      `SELECT id, recipient_email, subject, body, user_id
       FROM emails 
       WHERE id = ANY($1) AND user_id = $2 AND status = 'failed'`,
      [emailIds, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No failed emails found' });
    }

    const limit = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');

    // Re-queue emails with immediate delivery
    await Promise.all(
      result.rows.map(row =>
        emailQueue.add(
          'send-email',
          {
            emailId: row.id,
            recipientEmail: row.recipient_email,
            subject: row.subject,
            body: row.body,
            userId: row.user_id,
            hourlyLimit: limit
          },
          { delay: 0, jobId: `${row.id}-retry-${Date.now()}` }
        )
      )
    );

    // Update status back to scheduled
    await pool.query(
      `UPDATE emails 
       SET status='scheduled', error_message=NULL, updated_at=NOW() 
       WHERE id = ANY($1)`,
      [emailIds]
    );

    logger.info({ userId: user.id, count: result.rows.length }, 'Retrying failed emails');
    return res.json({ success: true, retried: result.rows.length });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Retry failed');
    return res.status(500).json({ error: 'Failed to retry emails' });
  }
});

export default router;
