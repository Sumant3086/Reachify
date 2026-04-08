import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const validateScheduleEmail = [
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required')
    .isLength({ max: 500 }).withMessage('Subject must be less than 500 characters')
    .escape(),
  
  body('body')
    .trim()
    .notEmpty().withMessage('Email body is required')
    .isLength({ max: 50000 }).withMessage('Email body too large'),
  
  body('startTime')
    .notEmpty().withMessage('Start time is required')
    .isISO8601().withMessage('Invalid date format'),
  
  body('delayBetweenEmails')
    .optional()
    .isInt({ min: 1, max: 3600 }).withMessage('Delay must be between 1 and 3600 seconds'),
  
  body('hourlyLimit')
    .optional()
    .isInt({ min: 1, max: 1000 }).withMessage('Hourly limit must be between 1 and 1000'),
];

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      error: errors.array()[0].msg,
      details: errors.array()
    });
    return;
  }
  next();
};

export const sanitizeHtml = (html: string): string => {
  // Basic XSS protection - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};
