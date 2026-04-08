import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import connectRedis from 'connect-redis';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const RedisStore = connectRedis as any;
import passport from './config/passport';
import { initDatabase, pool } from './config/database';
import { redis } from './config/redisWithFallback';
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import paymentRoutes from './routes/payment';
import { emailQueue, emailWorker } from './queue/emailQueue';
import { validateEnv } from './utils/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
validateEnv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging middleware
import { requestLogger } from './middleware/requestLogger';
import { timeoutMiddleware } from './middleware/timeout';
app.use(requestLogger);
app.use(timeoutMiddleware(60000)); // 60 second timeout for all requests

// WebSocket setup
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(compression());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Redis-backed session store
app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  },
  name: 'sessionId' // Custom session cookie name
}));

app.use(passport.initialize());
app.use(passport.session());

// Rate limiting with custom message
const globalLimiter = rateLimit({ 
  windowMs: 60_000, 
  max: 200, 
  standardHeaders: true, 
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health' || req.path === '/metrics'
});

// Per-user rate limiting for authenticated routes
const userLimiter = rateLimit({
  windowMs: 60_000,
  max: 100, // 100 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use user ID if authenticated, otherwise don't use IP at all
    if (req.isAuthenticated && req.isAuthenticated()) {
      return `user:${(req.user as any).id}`;
    }
    // For unauthenticated requests, use a constant key (will be rate limited globally)
    return 'anonymous';
  },
  message: { error: 'Rate limit exceeded for your account' }
});

app.use(globalLimiter);
app.use('/api', userLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/payment', paymentRoutes);

// Cache middleware for GET requests
const cacheMiddleware = (duration: number) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'GET') return next();
    
    const key = `cache:${req.originalUrl}:${(req.user as any)?.id || 'anonymous'}`;
    
    redis.get(key).then(cached => {
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
      
      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        redis.setex(key, duration, JSON.stringify(body)).catch(err => 
          logger.warn({ error: err.message }, 'Cache set failed')
        );
        return originalJson(body);
      };
      next();
    }).catch(() => next());
  };
};

// Apply caching to specific routes
app.use('/api/emails/stats', cacheMiddleware(30)); // 30 seconds
app.use('/api/emails/templates', cacheMiddleware(60)); // 1 minute

// Root route for health checks
app.get('/', (_req, res) => {
  res.json({
    name: 'Reachify API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      auth: '/auth/*',
      emails: '/emails/*',
      payment: '/payment/*'
    }
  });
});

// Health check with detailed info
app.get('/health', async (_req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Redis
    await redis.ping();
    
    // Check queue status
    const queueCounts = await emailQueue.getJobCounts();
    
    res.json({ 
      status: 'healthy', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        worker: 'running'
      },
      queue: {
        waiting: queueCounts.waiting || 0,
        active: queueCounts.active || 0,
        completed: queueCounts.completed || 0,
        failed: queueCounts.failed || 0
      }
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Health check failed');
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Metrics endpoint for monitoring
app.get('/metrics', async (_req, res) => {
  try {
    const queueCounts = await emailQueue.getJobCounts();
    const memUsage = process.memoryUsage();
    
    // Get application metrics
    let appMetrics = {
      requests: 0,
      errors: 0,
      emailsSent: 0,
      emailsFailed: 0,
      avgResponseTime: 0
    };
    
    try {
      const { getMetrics } = await import('./utils/metrics');
      appMetrics = await getMetrics();
    } catch {}
    
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
      },
      queue: queueCounts,
      application: appMetrics,
      nodeVersion: process.version,
      platform: process.platform
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket authentication
io.use((socket, next) => {
  const userId = socket.handshake.auth.userId;
  if (!userId) {
    return next(new Error('Authentication required'));
  }
  socket.data.userId = userId;
  next();
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  socket.join(userId);
  logger.info({ userId, socketId: socket.id }, 'WebSocket client connected');

  socket.on('disconnect', (reason) => {
    logger.info({ userId, socketId: socket.id, reason }, 'WebSocket client disconnected');
  });

  socket.on('error', (error) => {
    logger.error({ userId, socketId: socket.id, error: error.message }, 'WebSocket error');
  });
});

// Emit email status updates via WebSocket
emailWorker.on('completed', async (job) => {
  const userId = job.data.userId;
  io.to(userId).emit('emailUpdate', {
    emailId: job.data.emailId,
    status: 'sent',
    timestamp: new Date().toISOString()
  });
});

emailWorker.on('failed', async (job) => {
  if (job) {
    const userId = job.data.userId;
    io.to(userId).emit('emailUpdate', {
      emailId: job.data.emailId,
      status: 'failed',
      timestamp: new Date().toISOString()
    });
  }
});

async function reEnqueuePendingEmails() {
  const lockKey = 'lock:re-enqueue';
  const lockValue = Date.now().toString();
  const lockTTL = 30; // 30 seconds

  try {
    // Acquire distributed lock using Redis
    const acquired = await redis.set(lockKey, lockValue, 'EX', lockTTL, 'NX');
    
    if (!acquired) {
      logger.info('Another instance is re-enqueueing emails, skipping');
      return;
    }

    // Get ALL scheduled emails, including past ones that haven't been sent yet
    const { rows } = await pool.query(
      `SELECT id, recipient_email, subject, body, user_id, scheduled_at
       FROM emails WHERE status = 'scheduled'`
    );

    let requeued = 0;
    const limit = parseInt(process.env.MAX_EMAILS_PER_HOUR || '200');

    for (const row of rows) {
      // If scheduled time is in the past, send immediately (delay = 0)
      const delay = Math.max(0, new Date(row.scheduled_at).getTime() - Date.now());
      
      try {
        const existingJob = await emailQueue.getJob(row.id);
        if (!existingJob) {
          await emailQueue.add(
            'send-email',
            {
              emailId: row.id,
              recipientEmail: row.recipient_email,
              subject: row.subject,
              body: row.body,
              userId: row.user_id,
              hourlyLimit: limit
            },
            { delay, jobId: row.id }
          );
          requeued++;
        }
      } catch (err: any) {
        if (!err?.message?.includes('already exists')) {
          logger.error({ emailId: row.id, error: err.message }, 'Failed to re-enqueue email');
        }
      }
    }

    if (requeued > 0) {
      logger.info({ count: requeued }, 'Re-enqueued pending emails');
    } else {
      logger.info('No pending emails to re-enqueue');
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to re-enqueue pending emails');
  } finally {
    // Release lock
    const currentValue = await redis.get(lockKey);
    if (currentValue === lockValue) {
      await redis.del(lockKey);
    }
  }
}

// Data retention cleanup (run daily)
async function cleanupOldEmails() {
  try {
    const result = await pool.query(
      `DELETE FROM emails WHERE created_at < NOW() - INTERVAL '90 days'`
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ deleted: result.rowCount }, 'Cleaned up old emails');
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to cleanup old emails');
  }
}

async function start() {
  try {
    // Perform startup checks
    const { performStartupChecks } = await import('./utils/startupCheck');
    const checksPass = await performStartupChecks();
    if (!checksPass) {
      process.exit(1);
    }
    
    await initDatabase();
    logger.info('Database initialized');
    
    // Run migrations
    try {
      const { runMigrations } = await import('./migrations');
      await runMigrations(pool);
      logger.info('Database migrations completed');
    } catch (err: any) {
      logger.error({ error: err.message }, 'Migration failed');
    }
    
    await reEnqueuePendingEmails();
    
    // Run cleanup daily at 2 AM
    const now = new Date();
    const night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 2, 0, 0);
    const msUntilNight = night.getTime() - now.getTime();
    
    setTimeout(() => {
      cleanupOldEmails();
      setInterval(cleanupOldEmails, 24 * 60 * 60 * 1000);
    }, msUntilNight);
    
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      logger.info({ 
        port: PORT, 
        env: process.env.NODE_ENV,
        nodeVersion: process.version 
      }, 'Server started successfully');
    });
  } catch (err: any) {
    logger.error({ error: err?.message || String(err), stack: err?.stack }, 'Failed to start server');
    console.error('Startup error:', err);
    process.exit(1);
  }
}

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  
  // Stop accepting new requests
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close worker
  await emailWorker.close();
  logger.info('Worker closed');
  
  // Close Redis
  await redis.quit();
  logger.info('Redis connection closed');
  
  // Close database
  await pool.end();
  logger.info('Database pool closed');
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

// Keep-alive for free tier
if (isProd) {
  const selfUrl = process.env.RENDER_EXTERNAL_URL || `https://reachify-api.onrender.com`;
  setInterval(() => {
    fetch(`${selfUrl}/health`)
      .then(() => logger.debug('Keep-alive ping OK'))
      .catch((err) => logger.warn({ error: err.message }, 'Keep-alive ping failed'));
  }, 14 * 60 * 1000);
}

start();
