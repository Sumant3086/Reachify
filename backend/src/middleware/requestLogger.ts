import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = req.id || 'unknown';

  // Log request
  logger.info({
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req.user as any)?.id
  }, 'Incoming request');

  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: (req.user as any)?.id
    }, 'Request completed');

    // Alert on slow requests
    if (duration > 1000) {
      logger.warn({
        requestId,
        method: req.method,
        url: req.url,
        duration
      }, 'Slow request detected');
    }

    return originalSend.call(this, data);
  };

  next();
}
