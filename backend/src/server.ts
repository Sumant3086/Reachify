import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from './config/passport';
import { initDatabase, pool } from './config/database';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import { emailQueue, emailWorker, EmailJobData } from './queue/emailQueue';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Gzip compression
app.use(compression());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Global rate limit — 200 req/min per IP
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Re-enqueue scheduled emails that survived a restart (idempotent via jobId)
async function reEnqueuePendingEmails() {
  const { rows } = await pool.query(
    `SELECT id, recipient_email, subject, body, user_email, scheduled_at
     FROM emails WHERE status = 'scheduled'`
  );

  let requeued = 0;
  const limit = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');

  for (const row of rows) {
    const delay = Math.max(0, new Date(row.scheduled_at).getTime() - Date.now());
    try {
      await emailQueue.add(
        'send-email',
        { emailId: row.id, recipientEmail: row.recipient_email, subject: row.subject,
          body: row.body, senderEmail: row.user_email, hourlyLimit: limit } as EmailJobData,
        { delay, jobId: row.id }
      );
      requeued++;
    } catch (err: any) {
      if (!err?.message?.includes('already exists')) {
        console.error(`Failed to re-enqueue ${row.id}:`, err.message);
      }
    }
  }

  if (requeued > 0) console.log(`Re-enqueued ${requeued} pending emails`);
}

async function start() {
  try {
    await initDatabase();
    console.log('Database initialized');
    console.log(`Worker started (concurrency: ${process.env.WORKER_CONCURRENCY || 5})`);
    await reEnqueuePendingEmails();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => { await emailWorker.close(); process.exit(0); });
process.on('SIGINT',  async () => { await emailWorker.close(); process.exit(0); });

start();
