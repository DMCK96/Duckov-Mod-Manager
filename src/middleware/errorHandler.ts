import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`Error in ${req.method} ${req.path}:`, err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      ...(isDevelopment && { stack: err.stack })
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
    return;
  }

  if (err.message.includes('API key')) {
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'External service configuration error'
    });
    return;
  }

  // Default server error
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong',
    ...(isDevelopment && { stack: err.stack })
  });
};
