import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';
declare const rateLimiter: RateLimiterMemory;
export declare const rateLimiterMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export { rateLimiter };
//# sourceMappingURL=rateLimiter.d.ts.map