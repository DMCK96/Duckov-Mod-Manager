import { Router } from 'express';
import { translationService } from '../index';

const router = Router();

// Translate text
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
    
    const result = await translationService.translate({
      text,
      sourceLang,
      targetLang
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get supported languages
router.get('/languages', async (req, res, next) => {
  try {
    const languages = await translationService.getSupportedLanguages();
    
    res.json({
      success: true,
      data: languages
    });
  } catch (error) {
    next(error);
  }
});

// Get cache statistics
router.get('/cache/stats', async (req, res, next) => {
  try {
    const stats = translationService.getCacheStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// Clear cache
router.delete('/cache', async (req, res, next) => {
  try {
    await translationService.clearCache();
    
    res.json({
      success: true,
      message: 'Translation cache cleared'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
