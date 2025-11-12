import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') / 1000,
});

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    await rateLimiter.consume(clientIP);
    next();
  } catch (rateLimiterRes: any) {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 1,
    });
  }
};

export { rateLimiter };
