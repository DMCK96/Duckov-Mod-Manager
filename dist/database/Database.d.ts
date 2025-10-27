import { ModInfo, CachedTranslation } from '../types';
export declare class Database {
    private db;
    private dbPath;
    constructor();
    private ensureDataDirectory;
    initialize(): Promise<void>;
    private createTables;
    private runQuery;
    private getQuery;
    private getAllQuery;
    saveMod(mod: ModInfo): Promise<void>;
    getMod(id: string): Promise<ModInfo | null>;
    getAllMods(limit?: number, offset?: number): Promise<ModInfo[]>;
    searchMods(searchTerm: string, limit?: number): Promise<ModInfo[]>;
    saveTranslation(translation: CachedTranslation): Promise<void>;
    getTranslation(originalText: string, sourceLang: string, targetLang: string): Promise<CachedTranslation | null>;
    cleanExpiredTranslations(): Promise<void>;
    private mapRowToMod;
    close(): Promise<void>;
}
//# sourceMappingURL=Database.d.ts.map