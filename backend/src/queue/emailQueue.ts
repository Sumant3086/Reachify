import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { sendEmail } from '../services/emailService';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const WORKER_CONCURRENCY  = parseInt(process.env.WORKER_CONCURRENCY  || '5');
const EMAIL_DELAY_MS      = parseInt(process.env.EMAIL_DELAY_MS      || '2000');
const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');

export interface EmailJobData {
  emailId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderEmail: string;
  hourlyLimit: number;
}

export const emailQueue = new Queue('email-queue', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail:     { count: 5000 }
  }
});

// Redis-backed rate limit — safe across multiple workers
async function checkRateLimit(senderEmail: string, limit: number): Promise<boolean> {
  const key = `rate:${new Date().toISOString().slice(0, 13)}:${senderEmail}`;
  const count = await redis.get(key);
  return parseInt(count || '0') < limit;
}

// Atomic increment with TTL aligned to the current hour boundary
async function incrementRateLimit(senderEmail: string): Promise<void> {
  const key = `rate:${new Date().toISOString().slice(0, 13)}:${senderEmail}`;
  const ttl = 3600 - (Math.floor(Date.now() / 1000) % 3600);
  await redis.multi().incr(key).expire(key, ttl).exec();
}

export const emailWorker = new Worker<EmailJobData>(
  'email-queue',
  async (job: Job<EmailJobData>) => {
    const { emailId, recipientEmail, subject, body, senderEmail, hourlyLimit } = job.data;
    const limit = hourlyLimit || MAX_EMAILS_PER_HOUR;

    // Rate limit check — reschedule to next hour if exceeded, never drop
    if (!(await checkRateLimit(senderEmail, limit))) {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      await emailQueue.add('send-email', job.data, { delay: nextHour.getTime() - Date.now() });
      console.log(`Rate limit hit — rescheduled ${emailId} → ${nextHour.toISOString()}`);
      return { rescheduled: true };
    }

    // Throttle: minimum delay between sends
    await new Promise(r => setTimeout(r, EMAIL_DELAY_MS));

    try {
      await sendEmail(recipientEmail, subject, body);
      await incrementRateLimit(senderEmail);
      await pool.query(
        `UPDATE emails SET status='sent', sent_at=NOW() WHERE id=$1`,
        [emailId]
      );
      return { success: true };
    } catch (err: any) {
      await pool.query(
        `UPDATE emails SET status='failed', error_message=$1 WHERE id=$2`,
        [err.message, emailId]
      );
      throw err; // triggers BullMQ retry with exponential backoff
    }
  },
  {
    connection: redis,
    concurrency: WORKER_CONCURRENCY,
    // Enforce EMAIL_DELAY_MS gap between jobs across all workers
    limiter: { max: 1, duration: EMAIL_DELAY_MS },
    // Mark jobs stalled for >30s as failed so they retry
    stalledInterval: 30_000,
    maxStalledCount: 2
  }
);

emailWorker.on('completed', job => console.log(`✓ Job ${job.id} done`));
emailWorker.on('failed',    (job, err) => console.error(`✗ Job ${job?.id} failed: ${err.message}`));
emailWorker.on('stalled',   jobId => console.warn(`⚠ Job ${jobId} stalled`));
