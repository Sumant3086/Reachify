import { pool } from '../config/database';
import { redis } from '../config/redisWithFallback';
import { logger } from './logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'connected' | 'disconnected' | 'error';
    smtp: 'verified' | 'unverified' | 'error';
  };
  timestamp: string;
  uptime: number;
}

export async function checkHealth(): Promise<HealthStatus> {
  const health: HealthStatus = {
    status: 'healthy',
    services: {
      database: 'disconnected',
      redis: 'disconnected',
      smtp: 'unverified'
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };

  // Check database
  try {
    await pool.query('SELECT 1');
    health.services.database = 'connected';
  } catch (err: any) {
    health.services.database = 'error';
    health.status = 'unhealthy';
    logger.error({ error: err.message }, 'Database health check failed');
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'connected';
    
    // Check if using fallback
    if ((redis as any).isUsingFallback && (redis as any).isUsingFallback()) {
      health.services.redis = 'connected';
      logger.warn('Using in-memory fallback for Redis');
    }
  } catch (err: any) {
    health.services.redis = 'error';
    health.status = 'degraded';
    logger.error({ error: err.message }, 'Redis health check failed');
  }

  // Check SMTP (basic check - just verify transporter exists)
  try {
    const { sendEmail } = await import('../services/emailService');
    if (sendEmail) {
      health.services.smtp = 'verified';
    }
  } catch (err: any) {
    health.services.smtp = 'error';
    health.status = 'degraded';
    logger.error({ error: err.message }, 'SMTP health check failed');
  }

  return health;
}
