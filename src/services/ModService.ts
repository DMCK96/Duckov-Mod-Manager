import { Database } from '../database/Database';
import { OfflineTranslationService } from './OfflineTranslationService';
import { LocalModService } from './LocalModService';
import { ModInfo } from '../types';
import { logger } from '../utils/logger';
import archiver from 'archiver';
import path from 'path';

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
export class ModService {
  constructor(
    private database: Database,
    private translationService: OfflineTranslationService,
    private localModService: LocalModService
  ) {}

  /**
   * Scans the local workshop folder for mods
   * OFFLINE MODE - No Steam API calls
   *
   * This method scans the local workshop folder and reads mod metadata
   * from local files only. Perfect for offline Electron app.
   */
  async scanAndSyncLocalMods(): Promise<{
    scanned: number;
    synced: ModInfo[];
    errors: string[];
  }> {
    try {
      logger.info('Starting local mod scan (offline mode)...');

      // Scan local workshop folder for mod IDs
      const modIds = await this.localModService.scanLocalMods();
      logger.info(`Found ${modIds.length} local mod folders`);

      if (modIds.length === 0) {
        return { scanned: 0, synced: [], errors: [] };
      }

      // Process local mods without Steam API
      const synced: ModInfo[] = [];
      const errors: string[] = [];

      for (const modId of modIds) {
        try {
          // Get or create mod entry in database
          let mod = await this.database.getMod(modId);

          if (!mod) {
            // Create basic mod entry from local folder info
            const folderInfo = await this.localModService.getModFolderInfo(modId);

            if (!folderInfo.exists) {
              errors.push(`Mod ${modId}: Folder not found`);
              continue;
            }

            // Create minimal mod info from local data
            // In a real implementation, you might read mod.json or other metadata files
            mod = {
              id: modId,
              title: `Mod ${modId}`, // Would read from local metadata
              description: `Local mod in workshop folder`,
              creator: 'Unknown',
              previewUrl: '',
              fileSize: folderInfo.totalSize || 0,
              subscriptions: 0,
              rating: 0,
              tags: [],
              timeCreated: new Date(),
              timeUpdated: folderInfo.lastModified || new Date(),
              language: 'zh' // Assume Chinese for now
            };

            await this.database.saveMod(mod);
          }

          // Translate if needed
          if (mod.language && mod.language !== 'en') {
            const existingMod = await this.database.getMod(mod.id);
            const needsTranslation = this.shouldTranslateMod(mod, existingMod);

            if (needsTranslation) {
              logger.info(`Mod ${mod.id} needs translation`);
              await this.translateMod(mod);
            } else if (existingMod) {
              // Keep existing translations
              mod.translatedTitle = existingMod.translatedTitle;
              mod.translatedDescription = existingMod.translatedDescription;
              mod.lastTranslated = existingMod.lastTranslated;
              mod.originalTitle = existingMod.originalTitle;
              mod.originalDescription = existingMod.originalDescription;
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

        output.on('error', (err) => {
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
