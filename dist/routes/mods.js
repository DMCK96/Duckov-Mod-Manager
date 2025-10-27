"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const mods = await index_1.modService.getAllMods(limit, offset);
        res.json({
            success: true,
            data: mods,
            pagination: {
                limit,
                offset,
                count: mods.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/search', async (req, res, next) => {
    try {
        const searchTerm = req.query.q;
        const limit = parseInt(req.query.limit) || 50;
        if (!searchTerm) {
            res.status(400).json({
                success: false,
                error: 'Search term (q) is required'
            });
            return;
        }
        const mods = await index_1.modService.searchMods(searchTerm, limit);
        res.json({
            success: true,
            data: mods,
            query: searchTerm,
            count: mods.length
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const includeTranslation = req.query.translate !== 'false';
        const mod = await index_1.modService.getMod(id, includeTranslation);
        if (!mod) {
            res.status(404).json({
                success: false,
                error: 'Mod not found'
            });
            return;
        }
        res.json({
            success: true,
            data: mod
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/scan', async (req, res, next) => {
    try {
        logger_1.logger.info('Starting local mod scan and sync...');
        const result = await index_1.modService.scanAndSyncLocalMods();
        res.json({
            success: true,
            data: {
                scanned: result.scanned,
                synced: result.synced.length,
                errors: result.errors.length,
                mods: result.synced,
                errorMessages: result.errors
            },
            message: `Scanned ${result.scanned} local mods, synced ${result.synced.length} successfully`
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/sync', async (req, res, next) => {
    try {
        const { fileIds } = req.body;
        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            res.status(400).json({
                success: false,
                error: 'fileIds array is required'
            });
            return;
        }
        logger_1.logger.info(`Syncing ${fileIds.length} specific mods from Workshop`);
        const result = await index_1.modService.syncModsFromWorkshop(fileIds);
        res.json({
            success: true,
            data: {
                synced: result.synced.length,
                errors: result.errors.length,
                mods: result.synced,
                errorMessages: result.errors
            },
            requested: fileIds.length
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/translate', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { force = false } = req.body;
        const mod = await index_1.modService.getMod(id, false);
        if (!mod) {
            res.status(404).json({
                success: false,
                error: 'Mod not found'
            });
            return;
        }
        const translatedMod = await index_1.modService.translateMod(mod, force);
        res.json({
            success: true,
            data: translatedMod
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/updates/check', async (req, res, next) => {
    try {
        logger_1.logger.info('Manual update check requested');
        const result = await index_1.modService.checkForUpdates();
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/stats/overview', async (req, res, next) => {
    try {
        const stats = await index_1.modService.getModStatistics();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/translations/refresh', async (req, res, next) => {
    try {
        const { language } = req.body;
        logger_1.logger.info(`Refreshing translations${language ? ` for language: ${language}` : ''}`);
        const result = await index_1.modService.refreshModTranslations(language);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=mods.js.map