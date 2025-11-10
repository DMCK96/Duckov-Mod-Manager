import { TranslationRequest, TranslationResponse } from '../types';
import { Database } from '../database/Database';
export declare class TranslationService {
    private apiKey;
    private apiUrl;
    private cache;
    private database?;
    private lastRequestTime;
    private requestCountPerMinute;
    private requestCountPerSecond;
    private lastSecondTimestamp;
    private readonly MIN_REQUEST_INTERVAL;
    private readonly MAX_REQUESTS_PER_MINUTE;
    private readonly MAX_REQUESTS_PER_SECOND;
    constructor(database?: Database);
    translate(request: TranslationRequest): Promise<TranslationResponse>;
    private waitForRateLimit;
    private retryWithBackoff;
    private performTranslation;
    private saveToDatabaseCache;
    translateModContent(title: string, description: string, targetLang?: string): Promise<{
        translatedTitle: string;
        translatedDescription: string;
        detectedLanguage?: string;
    }>;
    translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<{
        translations: Array<{
            translatedText: string;
            detectedLanguage?: string;
        }>;
    }>;
    getSupportedLanguages(): Promise<string[]>;
    validateConfiguration(): Promise<{
        valid: boolean;
        message: string;
    }>;
    clearCache(): Promise<void>;
    getCacheStats(): {
        memoryKeys: number;
        memorySize: string;
    };
}
//# sourceMappingURL=TranslationService.d.ts.map