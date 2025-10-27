"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const router = (0, express_1.Router)();
router.post('/translate', async (req, res, next) => {
    try {
        const { text, sourceLang, targetLang = 'en' } = req.body;
        if (!text) {
            res.status(400).json({
                success: false,
                error: 'Text is required'
            });
            return;
        }
        const result = await index_1.translationService.translate({
            text,
            sourceLang,
            targetLang
        });
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/languages', async (req, res, next) => {
    try {
        const languages = await index_1.translationService.getSupportedLanguages();
        res.json({
            success: true,
            data: languages
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/cache/stats', async (req, res, next) => {
    try {
        const stats = index_1.translationService.getCacheStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/cache', async (req, res, next) => {
    try {
        await index_1.translationService.clearCache();
        res.json({
            success: true,
            message: 'Translation cache cleared'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=translation.js.map