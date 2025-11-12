import { Database } from '../database/Database';
import { logger } from '../utils/logger';
import { app } from 'electron';
import path from 'path';

// Dynamic import types for @xenova/transformers (ES module)
type Pipeline = any;
type TransformersModule = {
  pipeline: (task: string, model: string, options?: any) => Promise<Pipeline>;
  env: {
    cacheDir: string;
    allowRemoteModels: boolean;
    allowLocalModels: boolean;
  };
};

/**
 * OfflineTranslationService - Provides offline translation using Transformers.js
 *
 * Key Features:
 * - Uses Xenova/opus-mt-zh-en model for Chinese to English translation
 * - Lazy loads translation model on first use (downloads ~300-500MB on first run)
 * - Caches translations in SQLite database for instant reuse
 * - Works completely offline after initial model download
 * - Electron main process compatible (no browser dependencies)
 *
 * Model Information:
 * - Model: Xenova/opus-mt-zh-en (OPUS-MT Chinese-English translation)
 * - Size: ~300-500 MB
 * - Source: Hugging Face Transformers
 * - Quality: Production-grade translation quality
 *
 * Electron Considerations:
 * - Models cached in app.getPath('userData')/models directory
 * - All operations run in Node.js environment (main process)
 * - No HTTP calls required after initial model download
 * - Thread-safe for use in IPC handlers
 */
export class OfflineTranslationService {
  private translator: Pipeline | null = null;
  private transformersModule: TransformersModule | null = null;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private database: Database;

  // Translation statistics for monitoring
  private stats = {
    totalTranslations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    modelLoadTime: 0
  };

  constructor(database: Database) {
    this.database = database;
    logger.info('OfflineTranslationService created (models will be loaded on first use)');
  }

  /**
   * Dynamically imports the transformers module
   * This is required because @xenova/transformers is an ES module
   * @private
   */
  private async loadTransformersModule(): Promise<TransformersModule> {
    if (this.transformersModule) {
      return this.transformersModule;
    }

    try {
      // Dynamic import of ES module
      // Using Function constructor to prevent TypeScript from converting to require()
      // This is necessary because @xenova/transformers is a pure ES module
      const importModule = new Function('specifier', 'return import(specifier)');
      const module = await importModule('@xenova/transformers') as any;
      this.transformersModule = module;
      
      // Configure Transformers.js for Electron environment
      // Models will be cached in userData directory for offline use
      const modelsPath = path.join(app.getPath('userData'), 'models');
      module.env.cacheDir = modelsPath;

      // Disable remote model loading after first download
      module.env.allowRemoteModels = true; // Set to false after initial download
      module.env.allowLocalModels = true;

      logger.info(`Translation models will be cached at: ${modelsPath}`);
      
      return module;
    } catch (error) {
      logger.error('Failed to load transformers module:', error);
      throw new Error(`Failed to load transformers module: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initializes the translation model (lazy loading)
   * Downloads model on first call (~300-500MB, one-time download)
   * Subsequent calls reuse cached model from disk
   *
   * This method is idempotent and thread-safe
   */
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.translator) {
      logger.debug('Translation model already initialized');
      return;
    }

    // If initialization is in progress, wait for it
    if (this.isInitializing && this.initializationPromise) {
      logger.debug('Waiting for ongoing initialization...');
      return this.initializationPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initializationPromise = this.loadModel();

    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  /**
   * Loads the translation model from cache or downloads it
   * @private
   */
  private async loadModel(): Promise<void> {
    try {
      const startTime = Date.now();
      logger.info('Loading offline translation model (Xenova/opus-mt-zh-en)...');
      logger.info('Note: First load will download ~300-500MB. Please be patient...');

      // Load the transformers module first (dynamic import)
      const transformers = await this.loadTransformersModule();

      // Load the translation pipeline
      // Model: opus-mt-zh-en (Chinese to English)
      // Task: translation
      this.translator = await transformers.pipeline(
        'translation',
        'Xenova/opus-mt-zh-en',
        {
          // Progress callback to show download progress
          progress_callback: (progress: any) => {
            if (progress.status === 'progress') {
              const percent = progress.progress ? Math.round(progress.progress) : 0;
              logger.info(`Downloading model: ${progress.file || 'unknown'} - ${percent}%`);
            } else if (progress.status === 'done') {
              logger.info(`Downloaded: ${progress.file || 'unknown'}`);
            }
          }
        }
      );

      const loadTime = Date.now() - startTime;
      this.stats.modelLoadTime = loadTime;

      logger.info(`Translation model loaded successfully in ${(loadTime / 1000).toFixed(2)}s`);
      logger.info('Model is now cached locally for offline use');
    } catch (error) {
      logger.error('Failed to load translation model:', error);
      throw new Error(`Translation model initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Translates a single text from Chinese to English
   * Checks database cache first, then performs translation if needed
   *
   * @param text - The Chinese text to translate
   * @returns Promise<string> - The English translation
   */
  async translate(text: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return text;
    }

    this.stats.totalTranslations++;

    try {
      // Check database cache first
      const cached = await this.database.getTranslation(text, 'zh', 'en');
      if (cached && cached.translatedText) {
        this.stats.cacheHits++;
        logger.debug(`Translation cache hit for text: ${text.substring(0, 50)}...`);
        return cached.translatedText;
      }

      this.stats.cacheMisses++;

      // Ensure model is loaded
      await this.initialize();

      if (!this.translator) {
        throw new Error('Translation model not initialized');
      }

      // Perform translation
      logger.debug(`Translating text (${text.length} chars): ${text.substring(0, 50)}...`);
      const startTime = Date.now();

      const result = await this.translator(text, {
        // Translation parameters
        max_length: 512, // Maximum output length
        num_beams: 4,    // Beam search for better quality
        early_stopping: true
      }) as any;

      const translationTime = Date.now() - startTime;
      const translatedText = result.translation_text || result[0]?.translation_text || text;

      logger.debug(`Translation completed in ${translationTime}ms: ${translatedText.substring(0, 50)}...`);

      // Save to database cache
      await this.database.saveTranslation(text, translatedText, 'zh', 'en');

      return translatedText;
    } catch (error) {
      logger.error(`Translation failed for text: ${text.substring(0, 50)}...`, error);
      // Return original text on failure rather than throwing
      return text;
    }
  }

  /**
   * Translates multiple texts in batch
   * More efficient than calling translate() multiple times
   *
   * @param texts - Array of Chinese texts to translate
   * @returns Promise<string[]> - Array of English translations
   */
  async translateBatch(texts: string[]): Promise<string[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    logger.info(`Batch translating ${texts.length} texts...`);

    // Process texts in parallel for better performance
    // But limit concurrency to avoid overwhelming the model
    const batchSize = 5;
    const results: string[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.translate(text))
      );
      results.push(...batchResults);

      logger.debug(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    }

    return results;
  }

  /**
   * Translates mod content (title and description)
   * Optimized for mod translation workflow
   *
   * @param title - Mod title in Chinese
   * @param description - Mod description in Chinese
   * @returns Translation result with both title and description
   */
  async translateModContent(
    title: string,
    description: string,
    _targetLang: string = 'en'
  ): Promise<{
    translatedTitle: string;
    translatedDescription: string;
    detectedLanguage?: string;
  }> {
    try {
      // Translate both in parallel
      const [translatedTitle, translatedDescription] = await Promise.all([
        this.translate(title),
        this.translate(description)
      ]);

      return {
        translatedTitle,
        translatedDescription,
        detectedLanguage: 'zh' // We know it's Chinese since we use zh-en model
      };
    } catch (error) {
      logger.error('Mod content translation failed:', error);
      // Return original content on error
      return {
        translatedTitle: title,
        translatedDescription: description,
        detectedLanguage: 'zh'
      };
    }
  }

  /**
   * Gets translation cache statistics
   * Useful for monitoring and UI display
   *
   * @returns Cache statistics including hit rate
   */
  async getCacheStats(): Promise<{
    cached: number;
    total: number;
    hitRate: number;
    modelLoadTime: number;
  }> {
    try {
      // Get count of cached translations from database
      const cached = await this.database.getTranslationCount();

      const hitRate = this.stats.totalTranslations > 0
        ? (this.stats.cacheHits / this.stats.totalTranslations) * 100
        : 0;

      return {
        cached,
        total: this.stats.totalTranslations,
        hitRate: Math.round(hitRate),
        modelLoadTime: this.stats.modelLoadTime
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        cached: 0,
        total: this.stats.totalTranslations,
        hitRate: 0,
        modelLoadTime: this.stats.modelLoadTime
      };
    }
  }

  /**
   * Clears the translation cache
   * Useful for freeing up disk space or forcing retranslations
   */
  async clearCache(): Promise<void> {
    try {
      const count = await this.database.clearExpiredTranslations();
      logger.info(`Cleared ${count} expired translations from cache`);

      // Reset statistics
      this.stats.cacheHits = 0;
      this.stats.cacheMisses = 0;
      this.stats.totalTranslations = 0;
    } catch (error) {
      logger.error('Failed to clear translation cache:', error);
      throw error;
    }
  }

  /**
   * Validates the service configuration
   * Checks if model can be loaded and is functional
   *
   * @returns Validation result with status and message
   */
  async validateConfiguration(): Promise<{ valid: boolean; message: string }> {
    try {
      // Try to initialize the model
      await this.initialize();

      if (!this.translator) {
        return {
          valid: false,
          message: 'Translation model failed to initialize'
        };
      }

      // Test translation with a simple phrase
      const testResult = await this.translator('你好', {
        max_length: 128,
        num_beams: 2
      }) as any;

      const testTranslation = testResult.translation_text || testResult[0]?.translation_text;

      if (!testTranslation) {
        return {
          valid: false,
          message: 'Translation model test failed - no output'
        };
      }

      logger.info(`Translation model validated. Test: "你好" -> "${testTranslation}"`);

      const cacheDir = this.transformersModule?.env.cacheDir || path.join(app.getPath('userData'), 'models');
      return {
        valid: true,
        message: `Offline translation is ready. Model cached at: ${cacheDir}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Translation validation failed:', error);
      return {
        valid: false,
        message: `Translation validation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Gets information about the loaded model
   * @returns Model information
   */
  getModelInfo(): {
    name: string;
    size: string;
    languages: { source: string; target: string };
    cached: boolean;
  } {
    return {
      name: 'Xenova/opus-mt-zh-en',
      size: '~300-500 MB',
      languages: {
        source: 'Chinese',
        target: 'English'
      },
      cached: this.translator !== null
    };
  }

  /**
   * Checks if the model is ready for use
   * @returns true if model is loaded and ready
   */
  isReady(): boolean {
    return this.translator !== null;
  }
}
