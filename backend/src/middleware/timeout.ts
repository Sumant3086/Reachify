import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function timeoutMiddleware(timeoutMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn({ 
          path: req.path, 
          method: req.method,
          timeout: timeoutMs 
        }, 'Request timeout');
        
        res.status(408).json({ 
          error: 'Request timeout',
          message: 'The request took too long to process'
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}
