"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    logger_1.logger.error(`Error in ${req.method} ${req.path}:`, err);
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
    res.status(500).json({
        error: 'Internal Server Error',
        message: isDevelopment ? err.message : 'Something went wrong',
        ...(isDevelopment && { stack: err.stack })
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map