import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../config/redisWithFallback';
import { sendEmail } from '../services/emailService';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const WORKER_CONCURRENCY  = parseInt(process.env.WORKER_CONCURRENCY  || '10'); // Increased for faster processing
const EMAIL_DELAY_MS      = parseInt(process.env.EMAIL_DELAY_MS      || '100'); // Reduced to 100ms for near-instant sending
const MAX_EMAILS_PER_HOUR = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');

export interface EmailJobData {
  emailId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  userId: string;
  hourlyLimit: number;
}

export const emailQueue = new Queue('email-queue', {
  connection: (redis as any).getRedisInstance() || redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail:     { count: 5000 }
  }
});

// Per-user rate limiting with Redis
async function checkRateLimit(userId: string, limit: number): Promise<boolean> {
  const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = `rate:${hourKey}:${userId}`;
  const count = await redis.get(key);
  return parseInt(count || '0') < limit;
}

async function incrementRateLimit(userId: string): Promise<void> {
  const hourKey = new Date().toISOString().slice(0, 13);
  const key = `rate:${hourKey}:${userId}`;
  const ttl = 3600 - (Math.floor(Date.now() / 1000) % 3600);
  const pipeline = redis.multi();
  pipeline.incr(key);
  pipeline.expire(key, ttl);
  await pipeline.exec();
}

export const emailWorker = new Worker<EmailJobData>(
  'email-queue',
  async (job: Job<EmailJobData>) => {
    const { emailId, recipientEmail, subject, body, userId, hourlyLimit } = job.data;
    const limit = hourlyLimit || MAX_EMAILS_PER_HOUR;

    logger.info({ emailId, recipientEmail, userId, attempt: job.attemptsMade + 1 }, 'Processing email job');

    // Per-user rate limit check
    if (!(await checkRateLimit(userId, limit))) {
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      const delay = nextHour.getTime() - Date.now();
      
      await emailQueue.add('send-email', job.data, { 
        delay, 
        jobId: `${emailId}-retry-${Date.now()}` 
      });
      
      logger.info({ emailId, userId }, 'Rate limit hit - rescheduled to next hour');
      return { rescheduled: true };
    }

    try {
      await sendEmail(recipientEmail, subject, body);
      await incrementRateLimit(userId);
      
      await pool.query(
        `UPDATE emails SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [emailId]
      );
      
      logger.info({ emailId, recipientEmail, userId }, 'Email sent successfully');
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error';
      
      // Update database with error
      await pool.query(
        `UPDATE emails SET status='failed', error_message=$1, updated_at=NOW() WHERE id=$2`,
        [errorMessage, emailId]
      );
      
      logger.error({ 
        emailId, 
        recipientEmail, 
        userId, 
        error: errorMessage,
        attempt: job.attemptsMade + 1,
        maxAttempts: 3
      }, 'Email send failed');
      
      // Throw error to trigger retry mechanism
      throw new Error(errorMessage);
    }
  },
  {
    connection: (redis as any).getRedisInstance() || redis as any,
    concurrency: WORKER_CONCURRENCY,
    limiter: { max: 10, duration: 1000 }, // 10 emails per second max
    stalledInterval: 30_000,
    maxStalledCount: 2,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        // Exponential backoff: 5s, 10s, 20s
        return Math.min(5000 * Math.pow(2, attemptsMade), 20000);
      }
    }
  }
);

// Remove all existing listeners to prevent memory leaks on hot reload
emailWorker.removeAllListeners();

emailWorker.on('completed', job => {
  logger.info({ 
    jobId: job.id, 
    emailId: job.data.emailId,
    duration: Date.now() - job.processedOn!
  }, 'Job completed');
});

emailWorker.on('failed', (job, err) => {
  logger.error({ 
    jobId: job?.id, 
    emailId: job?.data?.emailId,
    error: err.message,
    attempts: job?.attemptsMade,
    maxAttempts: 3
  }, 'Job failed');
});

emailWorker.on('stalled', jobId => {
  logger.warn({ jobId }, 'Job stalled - will be retried');
});

emailWorker.on('ready', () => {
  logger.info('Email worker is ready and listening for jobs');
});

emailWorker.on('error', err => {
  logger.error({ error: err.message, stack: err.stack }, 'Worker error');
});

emailWorker.on('active', (job) => {
  logger.debug({ 
    jobId: job.id, 
    emailId: job.data.emailId,
    recipient: job.data.recipientEmail
  }, 'Job started processing');
});
