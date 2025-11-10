import { Database } from '../database/Database';
import { OfflineTranslationService } from './OfflineTranslationService';
import { LocalModService } from './LocalModService';
import { ModInfo } from '../types';
/**
 * ModService - Main service for managing mods in Electron app
 *
 * Electron Migration Changes:
 * - Removed SteamWorkshopService dependency (no online API calls)
 * - Replaced TranslationService (DeepL) with OfflineTranslationService (Transformers.js)
 * - All operations work offline after initial model download
 * - Removed Express Response dependencies (use Electron IPC instead)
 * - Optimized for local-only mod scanning and translation
 *
 * Key Features:
 * - Scans local workshop folder for mods
 * - Translates Chinese mod content to English offline
 * - Caches translations in SQLite database
 * - Exports mods as zip archives
 */
export declare class ModService {
    private database;
    private translationService;
    private localModService;
    constructor(database: Database, translationService: OfflineTranslationService, localModService: LocalModService);
    /**
     * Scans the local workshop folder for mods
     * OFFLINE MODE - No Steam API calls
     *
     * This method scans the local workshop folder and reads mod metadata
     * from local files only. Perfect for offline Electron app.
     */
    scanAndSyncLocalMods(): Promise<{
        scanned: number;
        synced: ModInfo[];
        errors: string[];
    }>;
    /**
     * REMOVED: syncModsFromWorkshop
     * This method has been removed in the offline Electron version
     * Use scanAndSyncLocalMods() instead for local-only mod scanning
     */
    /**
     * Determines if a mod needs translation based on whether it has been updated since last translation
     */
    private shouldTranslateMod;
    translateMod(mod: ModInfo, forceRetranslate?: boolean): Promise<ModInfo>;
    /**
     * Gets a mod by ID from the database
     * OFFLINE MODE - No Steam API fallback
     *
     * @param id - Mod ID
     * @param includeTranslation - Whether to translate if not already translated
     * @returns Mod info or null if not found
     */
    getMod(id: string, includeTranslation?: boolean): Promise<ModInfo | null>;
    getAllMods(limit?: number, offset?: number): Promise<ModInfo[]>;
    searchMods(searchTerm: string, limit?: number): Promise<ModInfo[]>;
    /**
     * REMOVED: checkForUpdates
     * This method relied on Steam API and has been removed in offline mode
     * In Electron app, updates are detected by comparing local file timestamps
     * during scanAndSyncLocalMods()
     */
    getModStatistics(): Promise<{
        totalMods: number;
        translatedMods: number;
        languageBreakdown: Record<string, number>;
        recentUpdates: number;
    }>;
    refreshModTranslations(language?: string): Promise<{
        success: number;
        errors: number;
    }>;
    /**
     * Exports selected mods as a zip file
     * Returns the path to the created zip file
     *
     * @param modIds - Array of mod IDs to export
     * @param outputPath - Path where the zip file should be created
     * @returns Path to the created zip file
     */
    exportMods(modIds: string[], outputPath: string): Promise<{
        zipPath: string;
        exportedCount: number;
        missingMods: string[];
    }>;
}
//# sourceMappingURL=ModService.d.ts.map