import { TranslationRequest, TranslationResponse } from '../types';
import { Database } from '../database/Database';
export declare class TranslationService {
    private apiKey;
    private apiUrl;
    private cache;
    private database?;
    constructor(database?: Database);
    translate(request: TranslationRequest): Promise<TranslationResponse>;
    private performTranslation;
    private saveToDatabaseCache;
    translateModContent(title: string, description: string, targetLang?: string): Promise<{
        translatedTitle: string;
        translatedDescription: string;
        detectedLanguage?: string;
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