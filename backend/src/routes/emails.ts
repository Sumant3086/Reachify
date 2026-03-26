import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { pool } from '../config/database';
import { emailQueue } from '../queue/emailQueue';
import { isAuthenticated } from '../middleware/auth';

const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

router.post('/schedule', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const { subject, body, startTime, delayBetweenEmails, hourlyLimit } = req.body;
    const user = req.user as any;

    // Input validation
    if (!subject?.trim()) return res.status(400).json({ error: 'Subject is required' });
    if (!body?.trim())    return res.status(400).json({ error: 'Body is required' });
    if (!startTime)       return res.status(400).json({ error: 'Start time is required' });
    if (!req.file)        return res.status(400).json({ error: 'Email list file required' });

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'Invalid start time' });

    const delayMs = Math.max(1000, parseInt(delayBetweenEmails || '5') * 1000);
    const limit   = Math.min(parseInt(hourlyLimit || '200'), MAX_EMAILS_PER_HOUR);

    const fileContent = req.file.buffer.toString('utf-8');
    const rawEmails   = fileContent.match(EMAIL_REGEX) || [];
    // Deduplicate
    const emails = [...new Set(rawEmails.map(e => e.toLowerCase()))];

    if (emails.length === 0) return res.status(400).json({ error: 'No valid emails found in file' });

    // Batch insert all rows in one query for performance
    const now = Date.now();
    const values: any[] = [];
    const placeholders: string[] = [];
    const jobsToQueue: Array<{ id: string; data: any; delay: number }> = [];

    emails.forEach((email, i) => {
      const emailId    = uuidv4();
      const scheduledAt = new Date(startDate.getTime() + i * delayMs);
      const delay       = Math.max(0, scheduledAt.getTime() - now);
      const base        = i * 7;

      placeholders.push(
        `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`
      );
      values.push(emailId, user.email, email, subject.trim(), body.trim(), scheduledAt, 'scheduled');
      jobsToQueue.push({ id: emailId, data: { emailId, recipientEmail: email, subject: subject.trim(),
        body: body.trim(), senderEmail: user.email, hourlyLimit: limit }, delay });
    });

    await pool.query(
      `INSERT INTO emails (id,user_email,recipient_email,subject,body,scheduled_at,status)
       VALUES ${placeholders.join(',')}`,
      values
    );

    // Queue all jobs (BullMQ jobId = emailId for idempotency)
    await Promise.all(
      jobsToQueue.map(j => emailQueue.add('send-email', j.data, { delay: j.delay, jobId: j.id }))
    );

    res.json({ success: true, count: emails.length });
  } catch (err: any) {
    console.error('Schedule error:', err.message);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

router.get('/scheduled', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { rows } = await pool.query(
      `SELECT id, recipient_email, subject, scheduled_at, status
       FROM emails WHERE user_email = $1 AND status = 'scheduled'
       ORDER BY scheduled_at ASC LIMIT 500`,
      [user.email]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

router.get('/sent', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { rows } = await pool.query(
      `SELECT id, recipient_email, subject, sent_at, status, error_message
       FROM emails WHERE user_email = $1 AND status IN ('sent','failed')
       ORDER BY sent_at DESC NULLS LAST LIMIT 500`,
      [user.email]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

export default router;
