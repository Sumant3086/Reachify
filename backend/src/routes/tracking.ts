import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// 1x1 transparent GIF for email open tracking
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Track email opens
router.get('/open/:emailId', async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';

    // Update email with opened_at timestamp
    await pool.query(
      `UPDATE emails 
       SET opened_at = COALESCE(opened_at, NOW()), 
           open_count = COALESCE(open_count, 0) + 1,
           last_opened_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [emailId]
    );

    // Log the open event (optional - for detailed analytics)
    await pool.query(
      `INSERT INTO email_opens (id, email_id, opened_at, user_agent, ip_address)
       VALUES (gen_random_uuid(), $1, NOW(), $2, $3)
       ON CONFLICT DO NOTHING`,
      [emailId, userAgent, ipAddress]
    ).catch(() => {}); // Ignore if table doesn't exist yet

    logger.info({ emailId, userAgent }, 'Email opened');
  } catch (err: any) {
    logger.error({ error: err.message, emailId: req.params.emailId }, 'Failed to track email open');
  }

  // Always return the tracking pixel (even if tracking fails)
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRACKING_PIXEL.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(TRACKING_PIXEL);
});

// Track email clicks
router.get('/click/:emailId', async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;
    const { url } = req.query;
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';

    if (!url || typeof url !== 'string') {
      return res.status(400).send('Invalid URL');
    }

    // Update email with clicked_at timestamp
    await pool.query(
      `UPDATE emails 
       SET clicked_at = COALESCE(clicked_at, NOW()),
           click_count = COALESCE(click_count, 0) + 1,
           last_clicked_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [emailId]
    );

    // Log the click event
    await pool.query(
      `INSERT INTO email_clicks (id, email_id, url, clicked_at, user_agent, ip_address)
       VALUES (gen_random_uuid(), $1, $2, NOW(), $3, $4)`,
      [emailId, url, userAgent, ipAddress]
    ).catch(() => {}); // Ignore if table doesn't exist yet

    logger.info({ emailId, url, userAgent }, 'Email link clicked');

    // Redirect to the original URL
    res.redirect(url);
  } catch (err: any) {
    logger.error({ error: err.message, emailId: req.params.emailId }, 'Failed to track email click');
    
    // Still redirect even if tracking fails
    const url = req.query.url as string;
    if (url) {
      res.redirect(url);
    } else {
      res.status(400).send('Invalid URL');
    }
  }
});

// Unsubscribe handler
router.get('/unsubscribe/:emailId', async (req: Request, res: Response) => {
  try {
    const { emailId } = req.params;

    // Get email details
    const result = await pool.query(
      'SELECT recipient_email, user_id FROM emails WHERE id = $1',
      [emailId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('<h1>Email not found</h1>');
    }

    const { recipient_email, user_id } = result.rows[0];

    // Mark as unsubscribed in contacts table (if exists)
    await pool.query(
      `UPDATE contacts 
       SET subscribed = false, 
           unsubscribed_at = NOW(),
           updated_at = NOW()
       WHERE email = $1 AND user_id = $2`,
      [recipient_email, user_id]
    ).catch(() => {}); // Ignore if contacts table doesn't exist

    // Also create an unsubscribe record
    await pool.query(
      `INSERT INTO unsubscribes (id, email, user_id, unsubscribed_at, source_email_id)
       VALUES (gen_random_uuid(), $1, $2, NOW(), $3)
       ON CONFLICT (email, user_id) DO NOTHING`,
      [recipient_email, user_id, emailId]
    ).catch(() => {}); // Ignore if table doesn't exist

    logger.info({ emailId, email: recipient_email }, 'User unsubscribed');

    // Return a nice unsubscribe confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribed - Reachify</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 48px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          .icon {
            font-size: 64px;
            margin-bottom: 24px;
          }
          h1 {
            color: #1a202c;
            margin-bottom: 16px;
            font-size: 28px;
          }
          p {
            color: #4a5568;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .email {
            background: #f7fafc;
            padding: 12px;
            border-radius: 8px;
            color: #2d3748;
            font-family: monospace;
            margin-bottom: 24px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: transform 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>You've Been Unsubscribed</h1>
          <p>We're sorry to see you go! You will no longer receive emails from us at:</p>
          <div class="email">${recipient_email}</div>
          <p>If this was a mistake, you can resubscribe anytime by contacting us.</p>
          <a href="https://reachify-io.onrender.com" class="button">Visit Reachify</a>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    logger.error({ error: err.message, emailId: req.params.emailId }, 'Failed to process unsubscribe');
    res.status(500).send('<h1>Error processing unsubscribe</h1><p>Please try again later.</p>');
  }
});

export default router;
