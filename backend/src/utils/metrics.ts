import { redis } from '../config/redis';

interface Metrics {
  requests: number;
  errors: number;
  emailsSent: number;
  emailsFailed: number;
  avgResponseTime: number;
}

const METRICS_KEY = 'metrics:current';
const METRICS_HISTORY_KEY = 'metrics:history';

export async function incrementMetric(metric: keyof Metrics, value: number = 1): Promise<void> {
  try {
    await redis.hincrby(METRICS_KEY, metric, value);
  } catch (err) {
    // Fail silently - metrics shouldn't break the app
  }
}

export async function recordResponseTime(duration: number): Promise<void> {
  try {
    const current = await redis.hget(METRICS_KEY, 'avgResponseTime');
    const requests = await redis.hget(METRICS_KEY, 'requests');
    
    const currentAvg = parseFloat(current || '0');
    const totalRequests = parseInt(requests || '0');
    
    const newAvg = ((currentAvg * totalRequests) + duration) / (totalRequests + 1);
    await redis.hset(METRICS_KEY, 'avgResponseTime', newAvg.toFixed(2));
  } catch (err) {
    // Fail silently
  }
}

export async function getMetrics(): Promise<Metrics> {
  try {
    const data = await redis.hgetall(METRICS_KEY);
    return {
      requests: parseInt(data.requests || '0'),
      errors: parseInt(data.errors || '0'),
      emailsSent: parseInt(data.emailsSent || '0'),
      emailsFailed: parseInt(data.emailsFailed || '0'),
      avgResponseTime: parseFloat(data.avgResponseTime || '0')
    };
  } catch (err) {
    return {
      requests: 0,
      errors: 0,
      emailsSent: 0,
      emailsFailed: 0,
      avgResponseTime: 0
    };
  }
}

export async function resetMetrics(): Promise<void> {
  try {
    // Save to history before reset
    const current = await getMetrics();
    const timestamp = Date.now();
    await redis.zadd(METRICS_HISTORY_KEY, timestamp, JSON.stringify({ ...current, timestamp }));
    
    // Keep only last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await redis.zremrangebyscore(METRICS_HISTORY_KEY, 0, sevenDaysAgo);
    
    // Reset current
    await redis.del(METRICS_KEY);
  } catch (err) {
    // Fail silently
  }
}

// Reset metrics every hour
setInterval(resetMetrics, 60 * 60 * 1000);
