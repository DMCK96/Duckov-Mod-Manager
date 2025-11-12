import { Router } from 'express';
import { modService } from '../index';
import { logger } from '../utils/logger';

const router = Router();

// Get all mods
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const mods = await modService.getAllMods(limit, offset);
    
    res.json({
      success: true,
      data: mods,
      pagination: {
        limit,
        offset,
        count: mods.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Search mods
router.get('/search', async (req, res, next) => {
  try {
    const searchTerm = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!searchTerm) {
      res.status(400).json({
        success: false,
        error: 'Search term (q) is required'
      });
      return;
    }
    
    const mods = await modService.searchMods(searchTerm, limit);
    
    res.json({
      success: true,
      data: mods,
      query: searchTerm,
      count: mods.length
    });
  } catch (error) {
    next(error);
  }
});

// Get specific mod
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const includeTranslation = req.query.translate !== 'false';
    
    const mod = await modService.getMod(id, includeTranslation);
    
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
  } catch (error) {
    next(error);
  }
});

// Scan local workshop folder and sync all mods
router.post('/scan', async (req, res, next) => {
  try {
    logger.info('Starting local mod scan and sync...');
    const result = await modService.scanAndSyncLocalMods();
    
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
  } catch (error) {
    next(error);
  }
});

// Sync specific mods from Steam Workshop
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
    
    logger.info(`Syncing ${fileIds.length} specific mods from Workshop`);
    const result = await modService.syncModsFromWorkshop(fileIds);
    
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
  } catch (error) {
    next(error);
  }
});

// Translate a specific mod
router.post('/:id/translate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { force = false } = req.body;
    
    const mod = await modService.getMod(id, false);
    if (!mod) {
      res.status(404).json({
        success: false,
        error: 'Mod not found'
      });
      return;
    }
    
    const translatedMod = await modService.translateMod(mod, force);
    
    res.json({
      success: true,
      data: translatedMod
    });
  } catch (error) {
    next(error);
  }
});

// Check for updates
router.post('/updates/check', async (req, res, next) => {
  try {
    logger.info('Manual update check requested');
    const result = await modService.checkForUpdates();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get mod statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await modService.getModStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// Refresh translations
router.post('/translations/refresh', async (req, res, next) => {
  try {
    const { language } = req.body;
    
    logger.info(`Refreshing translations${language ? ` for language: ${language}` : ''}`);
    const result = await modService.refreshModTranslations(language);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Export selected mods as zip
router.post('/export', async (req, res, next) => {
  try {
    const { modIds } = req.body;
    
    if (!Array.isArray(modIds) || modIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'modIds array is required and must not be empty'
      });
      return;
    }
    
    logger.info(`Exporting ${modIds.length} selected mods`);
    
    // The response will be streamed, so we don't use res.json
    await modService.exportMods(modIds, res);
  } catch (error) {
    next(error);
  }
});

// Get mod IDs from Steam Workshop collection URL
router.post('/collection/mods', async (req, res, next) => {
  try {
    const { collectionUrl } = req.body;
    
    if (!collectionUrl || typeof collectionUrl !== 'string') {
      res.status(400).json({
        success: false,
        error: 'collectionUrl is required and must be a string'
      });
      return;
    }
    
    logger.info(`Getting mods from collection: ${collectionUrl}`);
    
    const modIds = await modService.getModsFromCollection(collectionUrl);
    
    res.json({
      success: true,
      data: {
        modIds,
        count: modIds.length
      },
      message: `Found ${modIds.length} mods in collection`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
