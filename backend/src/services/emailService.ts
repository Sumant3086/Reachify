import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

// Connection pool for better performance
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  pool: true, // Use connection pooling
  maxConnections: 10, // Increased for better throughput
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 10, // Increased to 10 emails per second
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 30000,
  socketTimeout: 30000
});

// Verify SMTP connection on startup with retry (non-blocking)
let smtpReady = false;
async function verifySmtpConnection(retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await transporter.verify();
      smtpReady = true;
      logger.info('✅ SMTP connection verified');
      return;
    } catch (error: any) {
      logger.warn({ attempt: i + 1, error: error.message }, 'SMTP verification failed, will retry on first email send');
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced to 1 second
      }
    }
  }
  // Don't block startup - SMTP will be verified on first email send
  logger.warn('SMTP verification skipped - will verify on first email send');
}

// Verify in background, don't block startup
verifySmtpConnection().catch(() => {
  logger.warn('SMTP verification failed during startup, will retry on demand');
});

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // Wait for SMTP to be ready
  if (!smtpReady) {
    await verifySmtpConnection();
  }

  try {
    // NOTE: Resend free tier only allows sending to your verified email address
    // To send to other recipients, verify a domain at resend.com/domains
    const info = await transporter.sendMail({
      from: 'Reachify <onboarding@resend.dev>', // Resend's test domain
      to,
      subject,
      text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${body}
          </body>
        </html>
      `
    });
    
    logger.info({ messageId: info.messageId, to, subject }, 'Email sent successfully');
    
    // Track metrics
    try {
      const { incrementMetric } = await import('../utils/metrics');
      await incrementMetric('emailsSent');
    } catch {}
  } catch (error: any) {
    logger.error({ error: error.message, to, subject }, 'Email send failed');
    
    // Track metrics
    try {
      const { incrementMetric } = await import('../utils/metrics');
      await incrementMetric('emailsFailed');
    } catch {}
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  transporter.close();
  logger.info('SMTP transporter closed');
});

process.on('SIGINT', () => {
  transporter.close();
  logger.info('SMTP transporter closed');
});
