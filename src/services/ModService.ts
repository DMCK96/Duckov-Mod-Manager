import { Database } from '../database/Database';
import { SteamWorkshopService } from './SteamWorkshopService';
import { TranslationService } from './TranslationService';
import { LocalModService } from './LocalModService';
import { ModInfo } from '../types';
import { logger } from '../utils/logger';

export class ModService {
  constructor(
    private database: Database,
    private steamService: SteamWorkshopService,
    private translationService: TranslationService,
    private localModService: LocalModService
  ) {}

  /**
   * Scans the local workshop folder and syncs all found mods with Steam API
   * This is the main workflow for your application
   */
  async scanAndSyncLocalMods(): Promise<{
    scanned: number;
    synced: ModInfo[];
    errors: string[];
  }> {
    try {
      logger.info('Starting local mod scan and sync...');
      
      // Step 1: Scan local workshop folder for mod IDs
      const modIds = await this.localModService.scanLocalMods();
      logger.info(`Found ${modIds.length} local mod folders`);

      if (modIds.length === 0) {
        return { scanned: 0, synced: [], errors: [] };
      }

      // Step 2: Sync these mods from Steam Workshop API
      const result = await this.syncModsFromWorkshop(modIds);

      logger.info(`Scan complete: ${modIds.length} scanned, ${result.synced.length} synced, ${result.errors.length} errors`);
      return {
        scanned: modIds.length,
        synced: result.synced,
        errors: result.errors
      };
    } catch (error) {
      logger.error('Failed to scan and sync local mods:', error);
      throw error;
    }
  }

  /**
   * Syncs specific mod IDs from Steam Workshop API
   * Fetches metadata and translates if needed
   */
  async syncModsFromWorkshop(fileIds: string[]): Promise<{
    synced: ModInfo[];
    errors: string[];
  }> {
    try {
      logger.info(`Syncing ${fileIds.length} mods from Steam Workshop`);
      
      const syncedMods: ModInfo[] = [];
      const errors: string[] = [];

      // Batch API calls (Steam API supports up to 100 items per request)
      const batchSize = 100;
      for (let i = 0; i < fileIds.length; i += batchSize) {
        const batch = fileIds.slice(i, i + batchSize);
        
        try {
          const workshopItems = await this.steamService.getPublishedFileDetails(batch);

          for (const item of workshopItems) {
            try {
              // Skip items with errors
              if (item.result !== 1) {
                errors.push(`Mod ${item.publishedfileid}: Steam API error (result: ${item.result})`);
                continue;
              }

              const mod = this.steamService.mapWorkshopItemToMod(item);
              
              // Add local folder information
              const localInfo = await this.localModService.getModFolderInfo(mod.id);
              if (localInfo.exists) {
                // You could extend ModInfo type to include local folder info if needed
                logger.debug(`Mod ${mod.id} has local folder: ${localInfo.fileCount} files, ${localInfo.totalSize} bytes`);
              }
              
              // Check if we need to translate
              if (mod.language && mod.language !== 'en') {
                try {
                  // Check if mod exists and if translation is needed
                  const existingMod = await this.database.getMod(mod.id);
                  const needsTranslation = this.shouldTranslateMod(mod, existingMod);
                  
                  if (needsTranslation) {
                    logger.info(`Mod ${mod.id} needs translation (updated: ${mod.timeUpdated.toISOString()})`);
                    await this.translateMod(mod);
                  } else {
                    // Mod hasn't changed, keep existing translations
                    if (existingMod) {
                      mod.translatedTitle = existingMod.translatedTitle;
                      mod.translatedDescription = existingMod.translatedDescription;
                      mod.lastTranslated = existingMod.lastTranslated;
                      mod.originalTitle = existingMod.originalTitle;
                      mod.originalDescription = existingMod.originalDescription;
                      logger.debug(`Mod ${mod.id} unchanged, using existing translation`);
                    }
                    await this.database.saveMod(mod);
                  }
                } catch (translationError) {
                  logger.error(`Failed to translate mod ${mod.id}, saving without translation:`, translationError);
                  await this.database.saveMod(mod);
                }
              } else {
                await this.database.saveMod(mod);
              }
              
              syncedMods.push(mod);
              logger.debug(`Synced mod: ${mod.title} (${mod.id})`);
            } catch (error) {
              const errorMsg = `Failed to process mod ${item.publishedfileid}: ${error}`;
              logger.error(errorMsg);
              errors.push(errorMsg);
            }
          }
        } catch (batchError) {
          const errorMsg = `Failed to fetch batch starting at index ${i}: ${batchError}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      logger.info(`Successfully synced ${syncedMods.length} mods (${errors.length} errors)`);
      return { synced: syncedMods, errors };
    } catch (error) {
      logger.error('Failed to sync mods from Workshop:', error);
      throw error;
    }
  }

  /**
   * Determines if a mod needs translation based on whether it has been updated since last translation
   */
  private shouldTranslateMod(mod: ModInfo, existingMod: ModInfo | null): boolean {
    // If no existing mod in DB, translation is needed
    if (!existingMod) {
      return true;
    }

    // If never translated before, translation is needed
    if (!existingMod.lastTranslated) {
      return true;
    }

    // If mod has been updated since last translation, translation is needed
    if (mod.timeUpdated > existingMod.lastTranslated) {
      return true;
    }

    // If translation is too old (past cache expiry), translation is needed
    const cacheExpiryDays = parseInt(process.env.TRANSLATION_CACHE_TTL_DAYS || '7');
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - cacheExpiryDays);
    
    if (existingMod.lastTranslated < expiryDate) {
      return true;
    }

    // Otherwise, existing translation is still valid
    return false;
  }

  async translateMod(mod: ModInfo, forceRetranslate: boolean = false): Promise<ModInfo> {
    try {
      // Check if already translated and not forcing retranslation
      if (!forceRetranslate && mod.translatedTitle && mod.translatedDescription) {
        // Check if translation is recent enough
        const cacheExpiryDays = parseInt(process.env.TRANSLATION_CACHE_TTL_DAYS || '7');
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() - cacheExpiryDays);
        
        if (mod.lastTranslated && mod.lastTranslated > expiryDate) {
          logger.debug(`Mod ${mod.id} translation is still valid`);
          return mod;
        }
      }

      logger.info(`Translating mod: ${mod.title} (${mod.id})`);
      
      // Store original content if not already stored
      if (!mod.originalTitle) {
        mod.originalTitle = mod.title;
      }
      if (!mod.originalDescription) {
        mod.originalDescription = mod.description;
      }

      // Translate the content
      const translation = await this.translationService.translateModContent(
        mod.title,
        mod.description,
        'en'
      );

      // Update mod with translated content
      mod.translatedTitle = translation.translatedTitle;
      mod.translatedDescription = translation.translatedDescription;
      mod.lastTranslated = new Date();
      
      // If we detected the language, update it
      if (translation.detectedLanguage) {
        mod.language = translation.detectedLanguage;
      }

      // Don't overwrite title and description - let the database layer handle prioritization
      // The mapRowToMod function will use translatedTitle/translatedDescription when available

      // Save to database
      await this.database.saveMod(mod);
      
      logger.info(`Successfully translated mod: ${mod.title}`);
      return mod;
    } catch (error) {
      logger.error(`Failed to translate mod ${mod.id}:`, error);
      // Return mod without translation rather than failing completely
      return mod;
    }
  }

  async getMod(id: string, includeTranslation: boolean = true): Promise<ModInfo | null> {
    const mod = await this.database.getMod(id);
    
    if (!mod) {
      // Try to fetch from Steam Workshop
      try {
        const workshopItems = await this.steamService.getPublishedFileDetails([id]);
        if (workshopItems.length > 0) {
          const newMod = this.steamService.mapWorkshopItemToMod(workshopItems[0]);
          
          if (includeTranslation && newMod.language && newMod.language !== 'en') {
            await this.translateMod(newMod);
          } else {
            await this.database.saveMod(newMod);
          }
          
          return newMod;
        }
      } catch (error) {
        logger.error(`Failed to fetch mod ${id} from Steam Workshop:`, error);
      }
      
      return null;
    }

    return mod;
  }

  async getAllMods(limit: number = 100, offset: number = 0): Promise<ModInfo[]> {
    return await this.database.getAllMods(limit, offset);
  }

  async searchMods(searchTerm: string, limit: number = 50): Promise<ModInfo[]> {
    return await this.database.searchMods(searchTerm, limit);
  }

  async checkForUpdates(): Promise<{ updated: ModInfo[]; errors: string[] }> {
    try {
      logger.info('Checking for mod updates...');
      
      const allMods = await this.database.getAllMods(1000); // Get all mods
      const updatedModIds = await this.steamService.getModUpdates(allMods);
      
      const updated: ModInfo[] = [];
      const errors: string[] = [];

      for (const modId of updatedModIds) {
        try {
          const workshopItems = await this.steamService.getPublishedFileDetails([modId]);
          if (workshopItems.length > 0) {
            const updatedMod = this.steamService.mapWorkshopItemToMod(workshopItems[0]);
            
            // Check if translation needs updating
            const existingMod = allMods.find(m => m.id === modId);
            if (existingMod && existingMod.language && existingMod.language !== 'en') {
              const needsTranslation = this.shouldTranslateMod(updatedMod, existingMod);
              
              if (needsTranslation) {
                logger.info(`Mod ${modId} needs re-translation after update`);
                await this.translateMod(updatedMod, true); // Force retranslation
              } else {
                // Keep existing translations
                updatedMod.translatedTitle = existingMod.translatedTitle;
                updatedMod.translatedDescription = existingMod.translatedDescription;
                updatedMod.lastTranslated = existingMod.lastTranslated;
                updatedMod.originalTitle = existingMod.originalTitle;
                updatedMod.originalDescription = existingMod.originalDescription;
                await this.database.saveMod(updatedMod);
              }
            } else {
              await this.database.saveMod(updatedMod);
            }
            
            updated.push(updatedMod);
          }
        } catch (error) {
          const errorMessage = `Failed to update mod ${modId}: ${error}`;
          logger.error(errorMessage);
          errors.push(errorMessage);
        }
      }

      logger.info(`Update check complete. ${updated.length} mods updated, ${errors.length} errors`);
      return { updated, errors };
    } catch (error) {
      logger.error('Failed to check for updates:', error);
      throw error;
    }
  }

  async getModStatistics(): Promise<{
    totalMods: number;
    translatedMods: number;
    languageBreakdown: Record<string, number>;
    recentUpdates: number;
  }> {
    const allMods = await this.database.getAllMods(10000); // Get all mods for stats
    
    const stats = {
      totalMods: allMods.length,
      translatedMods: allMods.filter(mod => mod.translatedTitle || mod.translatedDescription).length,
      languageBreakdown: {} as Record<string, number>,
      recentUpdates: 0
    };

    // Language breakdown
    for (const mod of allMods) {
      const lang = mod.language || 'unknown';
      stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
    }

    // Recent updates (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    stats.recentUpdates = allMods.filter(mod => mod.timeUpdated > weekAgo).length;

    return stats;
  }

  async refreshModTranslations(language?: string): Promise<{ success: number; errors: number }> {
    const allMods = await this.database.getAllMods(10000);
    const modsToTranslate = language 
      ? allMods.filter(mod => mod.language === language)
      : allMods.filter(mod => mod.language && mod.language !== 'en');

    let success = 0;
    let errors = 0;

    logger.info(`Refreshing translations for ${modsToTranslate.length} mods`);

    for (const mod of modsToTranslate) {
      try {
        await this.translateMod(mod, true); // Force retranslation
        success++;
      } catch (error) {
        logger.error(`Failed to refresh translation for mod ${mod.id}:`, error);
        errors++;
      }
    }

    logger.info(`Translation refresh complete. ${success} successful, ${errors} errors`);
    return { success, errors };
  }
}
