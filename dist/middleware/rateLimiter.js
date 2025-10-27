"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.rateLimiterMiddleware = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const logger_1 = require("../utils/logger");
const rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') / 1000,
});
exports.rateLimiter = rateLimiter;
const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        await rateLimiter.consume(clientIP);
        next();
    }
    catch (rateLimiterRes) {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        logger_1.logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 1,
        });
    }
};
exports.rateLimiterMiddleware = rateLimiterMiddleware;
//# sourceMappingURL=rateLimiter.js.map