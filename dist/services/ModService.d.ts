import { Database } from '../database/Database';
import { SteamWorkshopService } from './SteamWorkshopService';
import { TranslationService } from './TranslationService';
import { LocalModService } from './LocalModService';
import { ModInfo } from '../types';
export declare class ModService {
    private database;
    private steamService;
    private translationService;
    private localModService;
    constructor(database: Database, steamService: SteamWorkshopService, translationService: TranslationService, localModService: LocalModService);
    scanAndSyncLocalMods(): Promise<{
        scanned: number;
        synced: ModInfo[];
        errors: string[];
    }>;
    syncModsFromWorkshop(fileIds: string[]): Promise<{
        synced: ModInfo[];
        errors: string[];
    }>;
    translateMod(mod: ModInfo, forceRetranslate?: boolean): Promise<ModInfo>;
    getMod(id: string, includeTranslation?: boolean): Promise<ModInfo | null>;
    getAllMods(limit?: number, offset?: number): Promise<ModInfo[]>;
    searchMods(searchTerm: string, limit?: number): Promise<ModInfo[]>;
    checkForUpdates(): Promise<{
        updated: ModInfo[];
        errors: string[];
    }>;
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
}
//# sourceMappingURL=ModService.d.ts.map