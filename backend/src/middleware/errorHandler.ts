import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log error
  logger.error({
    error: message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: (req.user as any)?.id
  }, 'Request error');

  // Don't leak error details in production
  const isProd = process.env.NODE_ENV === 'production';
  
  res.status(statusCode).json({
    error: message,
    ...(isProd ? {} : { stack: err.stack })
  });
}

export function notFoundHandler(req: Request, res: Response) {
  logger.warn({ url: req.url, method: req.method }, 'Route not found');
  res.status(404).json({ error: 'Route not found' });
}

export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  statusCode = 401;
  isOperational = true;

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
