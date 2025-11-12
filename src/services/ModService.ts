import { Database } from '../database/Database';
import { OfflineTranslationService } from './OfflineTranslationService';
import { LocalModService } from './LocalModService';
import { SteamWorkshopService } from './SteamWorkshopService';
import { ModInfo } from '../types';
import { logger } from '../utils/logger';
import archiver from 'archiver';

/**
 * ModService - Main service for managing mods in Electron app
 *
 * Electron Migration Changes:
 * - Re-added SteamWorkshopService to fetch mod metadata from Steam API
 * - Replaced TranslationService (DeepL) with OfflineTranslationService (Transformers.js)
 * - Translation works offline after initial model download
 * - Removed Express Response dependencies (use Electron IPC instead)
 * - Hybrid approach: fetch metadata from Steam, translate offline
 *
 * Key Features:
 * - Scans local workshop folder for mods
 * - Fetches mod metadata (title, description) from Steam Workshop API
 * - Translates Chinese mod content to English offline
 * - Caches translations in SQLite database
 * - Exports mods as zip archives
 */
export class ModService {
  constructor(
    private database: Database,
    private translationService: OfflineTranslationService,
    private localModService: LocalModService,
    private steamWorkshopService: SteamWorkshopService
  ) {}

  /**
   * Scans the local workshop folder for mods and fetches details from Steam
   * 
   * This method:
   * 1. Scans the local workshop folder for mod IDs
   * 2. Fetches mod metadata (title, description, etc.) from Steam Workshop API
   * 3. Saves/updates mod info in the database
   * 4. Translates mod content if needed
   */
  async scanAndSyncLocalMods(): Promise<{
    scanned: number;
    synced: ModInfo[];
    errors: string[];
  }> {
    try {
      logger.info('Starting local mod scan with Steam API integration...');

      // Scan local workshop folder for mod IDs
      const modIds = await this.localModService.scanLocalMods();
      logger.info(`Found ${modIds.length} local mod folders`);

      if (modIds.length === 0) {
        return { scanned: 0, synced: [], errors: [] };
      }

      // Fetch mod details from Steam Workshop API (in batches)
      logger.info('Fetching mod details from Steam Workshop API...');
      const steamModsMap = await this.steamWorkshopService.getWorkshopItems(modIds);
      logger.info(`Retrieved ${steamModsMap.size} mod details from Steam API`);

      // Process each mod
      const synced: ModInfo[] = [];
      const errors: string[] = [];

      for (const modId of modIds) {
        try {
          // Get existing mod from database
          let mod = await this.database.getMod(modId);
          const steamMod = steamModsMap.get(modId);

          if (!steamMod) {
            logger.warn(`No Steam Workshop details found for mod ${modId}, skipping...`);
            errors.push(`Mod ${modId}: Not found on Steam Workshop or access denied`);
            continue;
          }

          // Get local folder info
          const folderInfo = await this.localModService.getModFolderInfo(modId);

          if (!folderInfo.exists) {
            errors.push(`Mod ${modId}: Local folder not found`);
            continue;
          }

          // Detect language - check both title and description for Chinese characters
          // More robust detection: check each field separately
          const titleHasChinese = /[\u4e00-\u9fa5]/.test(steamMod.title);
          const descriptionHasChinese = /[\u4e00-\u9fa5]/.test(steamMod.description || '');
          const hasChinese = titleHasChinese || descriptionHasChinese;
          const language = hasChinese ? 'zh' : 'en';

          // Check if content has changed (need to invalidate translations)
          const contentChanged = mod && (
            mod.originalTitle !== steamMod.title || 
            mod.originalDescription !== steamMod.description
          );

          // Create or update mod info
          const updatedMod: ModInfo = {
            id: modId,
            title: steamMod.title,
            description: steamMod.description || 'No description available',
            creator: steamMod.creator || 'Unknown',
            previewUrl: steamMod.preview_url || '',
            fileSize: steamMod.file_size || folderInfo.totalSize || 0,
            subscriptions: steamMod.subscriptions || 0,
            rating: 0, // Steam API doesn't provide rating directly
            tags: steamMod.tags?.map(t => t.tag) || [],
            timeCreated: new Date(steamMod.time_created * 1000),
            timeUpdated: new Date(steamMod.time_updated * 1000),
            language: language,
            // Set original content to current Steam values
            originalTitle: steamMod.title,
            originalDescription: steamMod.description || 'No description available',
            // Clear translations if content changed, otherwise preserve them
            translatedTitle: contentChanged ? undefined : mod?.translatedTitle,
            translatedDescription: contentChanged ? undefined : mod?.translatedDescription,
            lastTranslated: contentChanged ? undefined : mod?.lastTranslated
          };

          // Save to database
          await this.database.saveMod(updatedMod);
          mod = updatedMod;

          // Translate if needed - now checks for Chinese content more intelligently
          // Translate if: 1) language is detected as Chinese, OR 2) title/description contain Chinese chars
          const needsTranslationCheck = titleHasChinese || descriptionHasChinese;
          
          if (needsTranslationCheck) {
            // Check if we need to translate (content changed or no translation exists)
            const needsTranslation = contentChanged || !mod.translatedTitle || !mod.translatedDescription;

            if (needsTranslation) {
              logger.info(`Mod ${mod.id} (${mod.title}) needs translation (contains Chinese characters)`);
              await this.translateMod(mod);
              // Re-fetch to get the updated translations
              const translatedMod = await this.database.getMod(mod.id);
              if (translatedMod) {
                mod = translatedMod;
              }
            }
          }

          synced.push(mod);
          logger.debug(`Processed mod: ${mod.title} (${mod.id})`);
        } catch (error) {
          const errorMsg = `Failed to process mod ${modId}: ${error}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      logger.info(`Scan complete: ${modIds.length} scanned, ${synced.length} synced, ${errors.length} errors`);
      return {
        scanned: modIds.length,
        synced,
        errors
      };
    } catch (error) {
      logger.error('Failed to scan local mods:', error);
      throw error;
    }
  }

  /**
   * REMOVED: syncModsFromWorkshop
   * This method has been removed in the offline Electron version
   * Use scanAndSyncLocalMods() instead for local-only mod scanning
   */

  async translateMod(mod: ModInfo, forceRetranslate: boolean = false): Promise<ModInfo> {
    try {
      // Detect which fields contain Chinese characters
      const titleHasChinese = /[\u4e00-\u9fa5]/.test(mod.title);
      const descriptionHasChinese = /[\u4e00-\u9fa5]/.test(mod.description);
      
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

      logger.info(`Translating mod: ${mod.title} (${mod.id}) - Title: ${titleHasChinese ? 'Chinese' : 'English'}, Description: ${descriptionHasChinese ? 'Chinese' : 'English'}`);
      
      // Store original content if not already stored
      if (!mod.originalTitle) {
        mod.originalTitle = mod.title;
      }
      if (!mod.originalDescription) {
        mod.originalDescription = mod.description;
      }

      // Translate only fields that contain Chinese characters
      // If a field is already in English, keep it as-is
      let translatedTitle = mod.title;
      let translatedDescription = mod.description;

      if (titleHasChinese || descriptionHasChinese) {
        // Translate the content - the service will handle both fields
        const translation = await this.translationService.translateModContent(
          titleHasChinese ? mod.title : '', // Only translate if has Chinese
          descriptionHasChinese ? mod.description : '', // Only translate if has Chinese
          'en'
        );

        // Use translated versions for fields that had Chinese, keep original for English fields
        translatedTitle = titleHasChinese ? translation.translatedTitle : mod.title;
        translatedDescription = descriptionHasChinese ? translation.translatedDescription : mod.description;
        
        // If we detected the language, update it
        if (translation.detectedLanguage) {
          mod.language = translation.detectedLanguage;
        }
      }

      // Update mod with translated content
      mod.translatedTitle = translatedTitle;
      mod.translatedDescription = translatedDescription;
      mod.lastTranslated = new Date();

      // Don't overwrite title and description - let the database layer handle prioritization
      // The mapRowToMod function will use translatedTitle/translatedDescription when available

      // Save to database
      await this.database.saveMod(mod);
      
      logger.info(`Successfully translated mod: ${translatedTitle}`);
      return mod;
    } catch (error) {
      logger.error(`Failed to translate mod ${mod.id}:`, error);
      // Return mod without translation rather than failing completely
      return mod;
    }
  }

  /**
   * Gets a mod by ID from the database
   * OFFLINE MODE - No Steam API fallback
   *
   * @param id - Mod ID
   * @param includeTranslation - Whether to translate if not already translated
   * @returns Mod info or null if not found
   */
  async getMod(id: string, includeTranslation: boolean = true): Promise<ModInfo | null> {
    const mod = await this.database.getMod(id);

    if (!mod) {
      logger.debug(`Mod ${id} not found in database`);
      return null;
    }

    // Translate if requested and needed
    if (includeTranslation && mod.language && mod.language !== 'en' && !mod.translatedTitle) {
      try {
        await this.translateMod(mod);
      } catch (error) {
        logger.error(`Failed to translate mod ${id}:`, error);
        // Return mod even if translation fails
      }
    }

    return mod;
  }

  async getAllMods(limit: number = 100, offset: number = 0): Promise<ModInfo[]> {
    return await this.database.getAllMods(limit, offset);
  }

  async searchMods(searchTerm: string, limit: number = 50): Promise<ModInfo[]> {
    return await this.database.searchMods(searchTerm, limit);
  }

  /**
   * REMOVED: checkForUpdates
   * This method relied on Steam API and has been removed in offline mode
   * In Electron app, updates are detected by comparing local file timestamps
   * during scanAndSyncLocalMods()
   */

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

  /**
   * Exports selected mods as a zip file
   * Returns the path to the created zip file
   *
   * @param modIds - Array of mod IDs to export
   * @param outputPath - Path where the zip file should be created
   * @returns Path to the created zip file
   */
  async exportMods(modIds: string[], outputPath: string): Promise<{
    zipPath: string;
    exportedCount: number;
    missingMods: string[];
  }> {
    try {
      logger.info(`Exporting ${modIds.length} mods to ${outputPath}`);

      // Verify all mods exist locally
      const modPaths: { id: string; path: string }[] = [];
      const missingMods: string[] = [];

      for (const modId of modIds) {
        const exists = await this.localModService.modExists(modId);
        if (exists) {
          modPaths.push({
            id: modId,
            path: this.localModService.getModPath(modId)
          });
        } else {
          missingMods.push(modId);
        }
      }

      if (missingMods.length > 0) {
        logger.warn(`Missing local files for mods: ${missingMods.join(', ')}`);
      }

      if (modPaths.length === 0) {
        throw new Error('No local mod folders found for export');
      }

      // Create zip archive
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Create output stream
      const output = require('fs').createWriteStream(outputPath);

      return new Promise((resolve, reject) => {
        // Handle stream events
        output.on('close', () => {
          const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
          logger.info(`Export complete: ${modPaths.length} mods exported, ${sizeInMB} MB total`);
          resolve({
            zipPath: outputPath,
            exportedCount: modPaths.length,
            missingMods
          });
        });

        archive.on('error', (err) => {
          logger.error('Archive error:', err);
          reject(err);
        });

        output.on('error', (err: Error) => {
          logger.error('Output stream error:', err);
          reject(err);
        });

        // Pipe archive to output file
        archive.pipe(output);

        // Add each mod folder to the archive
        for (const mod of modPaths) {
          logger.debug(`Adding mod ${mod.id} to archive`);
          archive.directory(mod.path, mod.id);
        }

        // Finalize the archive
        archive.finalize();
      });
    } catch (error) {
      logger.error('Failed to export mods:', error);
      throw error;
    }
  }

  /**
   * REMOVED: exportModsFromCollection
   * This method relied on Steam API and has been removed in offline mode
   * Use exportMods() with an array of mod IDs instead
   */
}
