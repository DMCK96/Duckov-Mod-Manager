"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {
            steam: { status: 'unknown', message: '' },
            translation: { status: 'unknown', message: '' },
            database: { status: 'healthy', message: 'Connected' }
        }
    };
    try {
        const steamCheck = await index_1.steamService.validateConfiguration();
        health.services.steam = {
            status: steamCheck.valid ? 'healthy' : 'error',
            message: steamCheck.message
        };
    }
    catch (error) {
        health.services.steam = {
            status: 'error',
            message: 'Failed to validate Steam API'
        };
    }
    try {
        const translationCheck = await index_1.translationService.validateConfiguration();
        health.services.translation = {
            status: translationCheck.valid ? 'healthy' : 'error',
            message: translationCheck.message
        };
    }
    catch (error) {
        health.services.translation = {
            status: 'error',
            message: 'Failed to validate Translation API'
        };
    }
    const hasErrors = Object.values(health.services).some(service => service.status === 'error');
    if (hasErrors) {
        health.status = 'degraded';
    }
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});
exports.default = router;
//# sourceMappingURL=health.js.map