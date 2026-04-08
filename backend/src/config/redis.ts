import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  // Only use TLS for Upstash (cloud Redis)
  tls: process.env.REDIS_HOST?.includes('upstash.io') && process.env.REDIS_PASSWORD ? {} : undefined,
  enableReadyCheck: true,
  lazyConnect: false
});

redis.on('error', (err) => console.error('Redis error:', err.message));
redis.on('connect', () => console.log('Redis connected'));
redis.on('ready', () => console.log('Redis ready'));
redis.on('reconnecting', () => console.log('Redis reconnecting...'));

