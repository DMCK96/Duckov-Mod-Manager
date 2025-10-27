"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationService = void 0;
const axios_1 = __importDefault(require("axios"));
const node_cache_1 = __importDefault(require("node-cache"));
const logger_1 = require("../utils/logger");
class TranslationService {
    constructor(database) {
        this.apiKey = process.env.DEEPL_API_KEY || '';
        this.apiUrl = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
        this.database = database;
        this.cache = new node_cache_1.default({ stdTTL: 3600, checkperiod: 600 });
        if (!this.apiKey) {
            logger_1.logger.warn('DeepL API key not configured. Translation features will be disabled.');
        }
    }
    async translate(request) {
        if (!this.apiKey) {
            throw new Error('DeepL API key not configured');
        }
        const cacheKey = `${request.text}_${request.sourceLang || 'auto'}_${request.targetLang}`;
        const cachedResult = this.cache.get(cacheKey);
        if (cachedResult) {
            logger_1.logger.debug('Translation found in memory cache');
            return cachedResult;
        }
        if (this.database) {
            const dbCached = await this.database.getTranslation(request.text, request.sourceLang || 'auto', request.targetLang);
            if (dbCached) {
                logger_1.logger.debug('Translation found in database cache');
                const response = {
                    translatedText: dbCached.translatedText,
                    detectedLanguage: dbCached.sourceLang !== 'auto' ? dbCached.sourceLang : undefined
                };
                this.cache.set(cacheKey, response);
                return response;
            }
        }
        try {
            const translationResponse = await this.performTranslation(request);
            this.cache.set(cacheKey, translationResponse);
            if (this.database) {
                await this.saveToDatabaseCache(request, translationResponse);
            }
            return translationResponse;
        }
        catch (error) {
            logger_1.logger.error('Translation failed:', error);
            throw error;
        }
    }
    async performTranslation(request) {
        const params = new URLSearchParams({
            auth_key: this.apiKey,
            text: request.text,
            target_lang: request.targetLang.toUpperCase()
        });
        if (request.sourceLang && request.sourceLang !== 'auto') {
            params.append('source_lang', request.sourceLang.toUpperCase());
        }
        try {
            const response = await axios_1.default.post(this.apiUrl, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 30000
            });
            if (!response.data.translations || response.data.translations.length === 0) {
                throw new Error('No translation returned from DeepL API');
            }
            const translation = response.data.translations[0];
            return {
                translatedText: translation.text,
                detectedLanguage: translation.detected_source_language?.toLowerCase(),
                confidence: 1.0
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const status = error.response?.status;
                const message = error.response?.data?.message || error.message;
                if (status === 403) {
                    throw new Error('DeepL API authentication failed. Check your API key.');
                }
                else if (status === 456) {
                    throw new Error('DeepL API quota exceeded.');
                }
                else if (status === 429) {
                    throw new Error('DeepL API rate limit exceeded. Please try again later.');
                }
                throw new Error(`DeepL API error (${status}): ${message}`);
            }
            throw error;
        }
    }
    async saveToDatabaseCache(request, response) {
        if (!this.database)
            return;
        const cacheExpiryDays = parseInt(process.env.TRANSLATION_CACHE_TTL_DAYS || '7');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + cacheExpiryDays);
        const cachedTranslation = {
            originalText: request.text,
            translatedText: response.translatedText,
            sourceLang: response.detectedLanguage || request.sourceLang || 'auto',
            targetLang: request.targetLang,
            createdAt: new Date(),
            expiresAt
        };
        try {
            await this.database.saveTranslation(cachedTranslation);
        }
        catch (error) {
            logger_1.logger.error('Failed to save translation to database cache:', error);
        }
    }
    async translateModContent(title, description, targetLang = 'en') {
        const results = await Promise.allSettled([
            this.translate({ text: title, targetLang }),
            this.translate({ text: description, targetLang })
        ]);
        const titleResult = results[0];
        const descriptionResult = results[1];
        let translatedTitle = title;
        let translatedDescription = description;
        let detectedLanguage;
        if (titleResult.status === 'fulfilled') {
            translatedTitle = titleResult.value.translatedText;
            detectedLanguage = titleResult.value.detectedLanguage;
        }
        else {
            logger_1.logger.error('Title translation failed:', titleResult.reason);
        }
        if (descriptionResult.status === 'fulfilled') {
            translatedDescription = descriptionResult.value.translatedText;
            if (!detectedLanguage) {
                detectedLanguage = descriptionResult.value.detectedLanguage;
            }
        }
        else {
            logger_1.logger.error('Description translation failed:', descriptionResult.reason);
        }
        return {
            translatedTitle,
            translatedDescription,
            detectedLanguage
        };
    }
    async getSupportedLanguages() {
        if (!this.apiKey) {
            throw new Error('DeepL API key not configured');
        }
        try {
            const response = await axios_1.default.get(`${this.apiUrl.replace('/translate', '/languages')}`, {
                params: {
                    auth_key: this.apiKey,
                    type: 'target'
                },
                timeout: 10000
            });
            return response.data.map((lang) => lang.language.toLowerCase());
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch supported languages:', error);
            return ['en', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'zh'];
        }
    }
    async validateConfiguration() {
        if (!this.apiKey) {
            return { valid: false, message: 'DeepL API key not configured' };
        }
        try {
            await this.performTranslation({
                text: 'Hello',
                targetLang: 'de'
            });
            return { valid: true, message: 'DeepL API configuration is valid' };
        }
        catch (error) {
            logger_1.logger.error('DeepL API validation failed:', error);
            return { valid: false, message: `DeepL API validation failed: ${error}` };
        }
    }
    async clearCache() {
        this.cache.flushAll();
        if (this.database) {
            await this.database.cleanExpiredTranslations();
        }
        logger_1.logger.info('Translation caches cleared');
    }
    getCacheStats() {
        const stats = this.cache.getStats();
        return {
            memoryKeys: stats.keys,
            memorySize: `${Math.round(stats.vsize / 1024)} KB`
        };
    }
}
exports.TranslationService = TranslationService;
//# sourceMappingURL=TranslationService.js.map