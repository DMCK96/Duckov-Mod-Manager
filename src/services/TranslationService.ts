import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger';
import { TranslationRequest, TranslationResponse, CachedTranslation } from '../types';
import { Database } from '../database/Database';

export class TranslationService {
  private apiKey: string;
  private apiUrl: string;
  private cache: NodeCache;
  private database?: Database;
  private lastRequestTime: number = 0;
  private requestCountPerMinute: number = 0;
  private requestCountPerSecond: number = 0;
  private lastSecondTimestamp: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  private readonly MAX_REQUESTS_PER_MINUTE = 50; // Conservative limit for per-minute
  private readonly MAX_REQUESTS_PER_SECOND = 45; // DeepL limit is 50/second (per engineers), use 45 for safety

  constructor(database?: Database) {
    this.apiKey = process.env.DEEPL_API_KEY || '';
    this.apiUrl = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
    this.database = database;
    
    // In-memory cache for quick access (1 hour TTL)
    this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    
    if (!this.apiKey) {
      logger.warn('DeepL API key not configured. Translation features will be disabled.');
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    if (!this.apiKey) {
      throw new Error('DeepL API key not configured');
    }

    const cacheKey = `${request.text}_${request.sourceLang || 'auto'}_${request.targetLang}`;
    
    // Check in-memory cache first
    const cachedResult = this.cache.get<TranslationResponse>(cacheKey);
    if (cachedResult) {
      logger.debug('Translation found in memory cache');
      return cachedResult;
    }

    // Check database cache
    if (this.database) {
      const dbCached = await this.database.getTranslation(
        request.text,
        request.sourceLang || 'auto',
        request.targetLang
      );
      
      if (dbCached) {
        logger.debug('Translation found in database cache');
        const response: TranslationResponse = {
          translatedText: dbCached.translatedText,
          detectedLanguage: dbCached.sourceLang !== 'auto' ? dbCached.sourceLang : undefined
        };
        
        // Store in memory cache for quick access
        this.cache.set(cacheKey, response);
        return response;
      }
    }

    // Perform actual translation
    try {
      const translationResponse = await this.performTranslation(request);
      
      // Cache the result
      this.cache.set(cacheKey, translationResponse);
      
      // Store in database for long-term caching
      if (this.database) {
        await this.saveToDatabaseCache(request, translationResponse);
      }
      
      return translationResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Translation failed:', error);
      throw new Error(`Translation failed: ${errorMessage}`);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const currentSecond = Math.floor(now / 1000);
    
    // Reset per-second counter when we enter a new second
    if (currentSecond !== this.lastSecondTimestamp) {
      this.lastSecondTimestamp = currentSecond;
      this.requestCountPerSecond = 0;
    }
    
    // Reset per-minute counter every minute
    if (timeSinceLastRequest > 60000) {
      this.requestCountPerMinute = 0;
    }
    
    // Check per-second limit (50 requests/second according to DeepL engineers)
    if (this.requestCountPerSecond >= this.MAX_REQUESTS_PER_SECOND) {
      const waitTime = 1000 - (now % 1000); // Wait until next second
      logger.info(`Per-second rate limit reached (${this.MAX_REQUESTS_PER_SECOND}/s). Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.lastSecondTimestamp = Math.floor(Date.now() / 1000);
      this.requestCountPerSecond = 0;
    }
    
    // Check per-minute limit
    if (this.requestCountPerMinute >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - timeSinceLastRequest;
      if (waitTime > 0) {
        logger.info(`Per-minute rate limit reached (${this.MAX_REQUESTS_PER_MINUTE}/min). Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCountPerMinute = 0;
      }
    }
    
    // Ensure minimum interval between requests (currently 1 second)
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCountPerMinute++;
    this.requestCountPerSecond++;
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        const isRateLimit = axios.isAxiosError(error) && error.response?.status === 429;
        
        if (!isRateLimit || attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  private async performTranslation(request: TranslationRequest): Promise<TranslationResponse> {
    // Build the request body according to DeepL API v2 spec
    const requestBody: any = {
      text: [request.text], // DeepL expects an array of texts
      target_lang: request.targetLang.toUpperCase()
    };

    if (request.sourceLang && request.sourceLang !== 'auto') {
      requestBody.source_lang = request.sourceLang.toUpperCase();
    }

    logger.debug(`Translating text (${request.text.length} chars) to ${request.targetLang}`);

    // Apply rate limiting
    await this.waitForRateLimit();

    // Wrap API call with retry logic
    return await this.retryWithBackoff(async () => {
      try {
        const response = await axios.post(this.apiUrl, requestBody, {
          headers: {
            'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Duckov-Mod-Manager/1.0.0'
          },
          timeout: 30000
        });

        if (!response.data || !response.data.translations || response.data.translations.length === 0) {
          throw new Error('No translation returned from DeepL API');
        }

        const translation = response.data.translations[0];
        
        if (!translation.text) {
          throw new Error('Translation text is missing in DeepL API response');
        }
        
        return {
          translatedText: translation.text,
          detectedLanguage: translation.detected_source_language?.toLowerCase(),
          confidence: 1.0 // DeepL doesn't provide confidence scores
        };
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.message || error.message;
          
          logger.error(`DeepL API error - Status: ${status}, Message:`, message);
          
          if (status === 403) {
            throw new Error('DeepL API authentication failed. Check your API key.');
          } else if (status === 456) {
            throw new Error('DeepL API quota exceeded.');
          } else if (status === 429) {
            throw new Error('DeepL API rate limit exceeded. Please try again later.');
          }
          
          throw new Error(`DeepL API error (${status}): ${message}`);
        }
        
        // Handle non-axios errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Unexpected translation error:', error);
        throw new Error(`Translation request failed: ${errorMessage}`);
      }
    });
  }

  private async saveToDatabaseCache(request: TranslationRequest, response: TranslationResponse): Promise<void> {
    if (!this.database) return;

    const cacheExpiryDays = parseInt(process.env.TRANSLATION_CACHE_TTL_DAYS || '7');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + cacheExpiryDays);

    const cachedTranslation: CachedTranslation = {
      originalText: request.text,
      translatedText: response.translatedText,
      sourceLang: response.detectedLanguage || request.sourceLang || 'auto',
      targetLang: request.targetLang,
      createdAt: new Date(),
      expiresAt
    };

    try {
      await this.database.saveTranslation(cachedTranslation);
    } catch (error) {
      logger.error('Failed to save translation to database cache:', error);
    }
  }

  async translateModContent(title: string, description: string, targetLang: string = 'en'): Promise<{
    translatedTitle: string;
    translatedDescription: string;
    detectedLanguage?: string;
  }> {
    // Optimize by batching both texts in a single API call
    try {
      const batchResult = await this.translateBatch([title, description], targetLang);
      
      return {
        translatedTitle: batchResult.translations[0]?.translatedText || title,
        translatedDescription: batchResult.translations[1]?.translatedText || description,
        detectedLanguage: batchResult.translations[0]?.detectedLanguage
      };
    } catch (error) {
      logger.error('Batch translation failed, falling back to individual translations:', error);
      
      // Fallback to individual translations if batch fails
      const results = await Promise.allSettled([
        this.translate({ text: title, targetLang }),
        this.translate({ text: description, targetLang })
      ]);

      const titleResult = results[0];
      const descriptionResult = results[1];

      let translatedTitle = title;
      let translatedDescription = description;
      let detectedLanguage: string | undefined;

      if (titleResult.status === 'fulfilled') {
        translatedTitle = titleResult.value.translatedText;
        detectedLanguage = titleResult.value.detectedLanguage;
      } else {
        const errorMessage = titleResult.reason instanceof Error 
          ? titleResult.reason.message 
          : String(titleResult.reason);
        logger.error(`Title translation failed: ${errorMessage}`, titleResult.reason);
      }

      if (descriptionResult.status === 'fulfilled') {
        translatedDescription = descriptionResult.value.translatedText;
        if (!detectedLanguage) {
          detectedLanguage = descriptionResult.value.detectedLanguage;
        }
      } else {
        const errorMessage = descriptionResult.reason instanceof Error 
          ? descriptionResult.reason.message 
          : String(descriptionResult.reason);
        logger.error(`Description translation failed: ${errorMessage}`, descriptionResult.reason);
      }

      return {
        translatedTitle,
        translatedDescription,
        detectedLanguage
      };
    }
  }

  async translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<{
    translations: Array<{ translatedText: string; detectedLanguage?: string }>;
  }> {
    if (!this.apiKey) {
      throw new Error('DeepL API key not configured');
    }

    if (texts.length === 0) {
      return { translations: [] };
    }

    // Check cache for all texts
    const cacheKeys = texts.map(text => 
      `${text}_${sourceLang || 'auto'}_${targetLang}`
    );
    
    const cachedResults: Array<TranslationResponse | null> = cacheKeys.map(key => 
      this.cache.get<TranslationResponse>(key) || null
    );
    
    // If all are cached, return immediately
    if (cachedResults.every(result => result !== null)) {
      logger.debug('All translations found in cache');
      return {
        translations: cachedResults.map(r => ({
          translatedText: r!.translatedText,
          detectedLanguage: r!.detectedLanguage
        }))
      };
    }

    // Build request for uncached texts
    const requestBody: any = {
      text: texts,
      target_lang: targetLang.toUpperCase()
    };

    if (sourceLang && sourceLang !== 'auto') {
      requestBody.source_lang = sourceLang.toUpperCase();
    }

    logger.debug(`Batch translating ${texts.length} texts (${texts.reduce((sum, t) => sum + t.length, 0)} total chars) to ${targetLang}`);

    // Apply rate limiting
    await this.waitForRateLimit();

    // Wrap API call with retry logic
    return await this.retryWithBackoff(async () => {
      try {
        const response = await axios.post(this.apiUrl, requestBody, {
          headers: {
            'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Duckov-Mod-Manager/1.0.0'
          },
          timeout: 30000
        });

        if (!response.data || !response.data.translations || response.data.translations.length === 0) {
          throw new Error('No translations returned from DeepL API');
        }

        const translations = response.data.translations.map((translation: any, index: number) => {
          if (!translation.text) {
            throw new Error(`Translation text is missing for item ${index}`);
          }

          const result = {
            translatedText: translation.text,
            detectedLanguage: translation.detected_source_language?.toLowerCase()
          };

          // Cache each result
          this.cache.set(cacheKeys[index], result);

          return result;
        });

        return { translations };
      } catch (error: any) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.message || error.message;
          
          logger.error(`DeepL API error - Status: ${status}, Message:`, message);
          
          if (status === 403) {
            throw new Error('DeepL API authentication failed. Check your API key.');
          } else if (status === 456) {
            throw new Error('DeepL API quota exceeded.');
          } else if (status === 429) {
            throw new Error('DeepL API rate limit exceeded. Please try again later.');
          }
          
          throw new Error(`DeepL API error (${status}): ${message}`);
        }
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Unexpected batch translation error:', error);
        throw new Error(`Batch translation request failed: ${errorMessage}`);
      }
    });
  }

  async getSupportedLanguages(): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('DeepL API key not configured');
    }

    try {
      const response = await axios.get(`${this.apiUrl.replace('/translate', '/languages')}`, {
        params: {
          auth_key: this.apiKey,
          type: 'target'
        },
        timeout: 10000
      });

      return response.data.map((lang: any) => lang.language.toLowerCase());
    } catch (error) {
      logger.error('Failed to fetch supported languages:', error);
      // Return common languages as fallback
      return ['en', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'zh'];
    }
  }

  async validateConfiguration(): Promise<{ valid: boolean; message: string }> {
    if (!this.apiKey) {
      return { valid: false, message: 'DeepL API key not configured' };
    }

    try {
      // Test API with a simple translation
      await this.performTranslation({
        text: 'Hello',
        targetLang: 'de'
      });
      
      return { valid: true, message: 'DeepL API configuration is valid' };
    } catch (error) {
      logger.error('DeepL API validation failed:', error);
      return { valid: false, message: `DeepL API validation failed: ${error}` };
    }
  }

  async clearCache(): Promise<void> {
    this.cache.flushAll();
    
    if (this.database) {
      await this.database.cleanExpiredTranslations();
    }
    
    logger.info('Translation caches cleared');
  }

  getCacheStats(): { memoryKeys: number; memorySize: string } {
    const stats = this.cache.getStats();
    return {
      memoryKeys: stats.keys,
      memorySize: `${Math.round(stats.vsize / 1024)} KB`
    };
  }
}
