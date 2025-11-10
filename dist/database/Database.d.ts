import { ModInfo, CachedTranslation } from '../types';
/**
 * Database - SQLite database manager for mod and translation data
 *
 * Electron Considerations:
 * - Uses app.getPath('userData') for database location in production
 * - Falls back to './data' for development/testing
 * - All operations are async and non-blocking
 * - Thread-safe for use in Electron main process
 */
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
    getTranslation(originalText: string, sourceLang: string, targetLang: string): Promise<CachedTranslation | null>;
    /**
     * Gets the total count of cached translations
     * Useful for statistics and monitoring
     *
     * @returns Number of non-expired translations in cache
     */
    getTranslationCount(): Promise<number>;
    /**
     * Clears expired translations from the database
     * Returns the number of deleted entries
     *
     * @returns Number of translations deleted
     */
    clearExpiredTranslations(): Promise<number>;
    /**
     * Clears ALL translations from the database (including non-expired)
     * Use with caution - this will force retranslation of all content
     *
     * @returns Number of translations deleted
     */
    clearAllTranslations(): Promise<number>;
    /**
     * Legacy method - kept for backward compatibility
     * @deprecated Use clearExpiredTranslations() instead
     */
    cleanExpiredTranslations(): Promise<void>;
    private mapRowToMod;
    close(): Promise<void>;
}
//# sourceMappingURL=Database.d.ts.map