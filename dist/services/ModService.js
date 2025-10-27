"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModService = void 0;
const logger_1 = require("../utils/logger");
class ModService {
    constructor(database, steamService, translationService, localModService) {
        this.database = database;
        this.steamService = steamService;
        this.translationService = translationService;
        this.localModService = localModService;
    }
    async scanAndSyncLocalMods() {
        try {
            logger_1.logger.info('Starting local mod scan and sync...');
            const modIds = await this.localModService.scanLocalMods();
            logger_1.logger.info(`Found ${modIds.length} local mod folders`);
            if (modIds.length === 0) {
                return { scanned: 0, synced: [], errors: [] };
            }
            const result = await this.syncModsFromWorkshop(modIds);
            logger_1.logger.info(`Scan complete: ${modIds.length} scanned, ${result.synced.length} synced, ${result.errors.length} errors`);
            return {
                scanned: modIds.length,
                synced: result.synced,
                errors: result.errors
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to scan and sync local mods:', error);
            throw error;
        }
    }
    async syncModsFromWorkshop(fileIds) {
        try {
            logger_1.logger.info(`Syncing ${fileIds.length} mods from Steam Workshop`);
            const syncedMods = [];
            const errors = [];
            const batchSize = 100;
            for (let i = 0; i < fileIds.length; i += batchSize) {
                const batch = fileIds.slice(i, i + batchSize);
                try {
                    const workshopItems = await this.steamService.getPublishedFileDetails(batch);
                    for (const item of workshopItems) {
                        try {
                            if (item.result !== 1) {
                                errors.push(`Mod ${item.publishedfileid}: Steam API error (result: ${item.result})`);
                                continue;
                            }
                            const mod = this.steamService.mapWorkshopItemToMod(item);
                            const localInfo = await this.localModService.getModFolderInfo(mod.id);
                            if (localInfo.exists) {
                                logger_1.logger.debug(`Mod ${mod.id} has local folder: ${localInfo.fileCount} files, ${localInfo.totalSize} bytes`);
                            }
                            if (mod.language && mod.language !== 'en') {
                                try {
                                    await this.translateMod(mod);
                                }
                                catch (translationError) {
                                    logger_1.logger.error(`Failed to translate mod ${mod.id}, saving without translation:`, translationError);
                                    await this.database.saveMod(mod);
                                }
                            }
                            else {
                                await this.database.saveMod(mod);
                            }
                            syncedMods.push(mod);
                            logger_1.logger.debug(`Synced mod: ${mod.title} (${mod.id})`);
                        }
                        catch (error) {
                            const errorMsg = `Failed to process mod ${item.publishedfileid}: ${error}`;
                            logger_1.logger.error(errorMsg);
                            errors.push(errorMsg);
                        }
                    }
                }
                catch (batchError) {
                    const errorMsg = `Failed to fetch batch starting at index ${i}: ${batchError}`;
                    logger_1.logger.error(errorMsg);
                    errors.push(errorMsg);
                }
            }
            logger_1.logger.info(`Successfully synced ${syncedMods.length} mods (${errors.length} errors)`);
            return { synced: syncedMods, errors };
        }
        catch (error) {
            logger_1.logger.error('Failed to sync mods from Workshop:', error);
            throw error;
        }
    }
    async translateMod(mod, forceRetranslate = false) {
        try {
            if (!forceRetranslate && mod.translatedTitle && mod.translatedDescription) {
                const cacheExpiryDays = parseInt(process.env.TRANSLATION_CACHE_TTL_DAYS || '7');
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() - cacheExpiryDays);
                if (mod.lastTranslated && mod.lastTranslated > expiryDate) {
                    logger_1.logger.debug(`Mod ${mod.id} translation is still valid`);
                    return mod;
                }
            }
            logger_1.logger.info(`Translating mod: ${mod.title} (${mod.id})`);
            if (!mod.originalTitle) {
                mod.originalTitle = mod.title;
            }
            if (!mod.originalDescription) {
                mod.originalDescription = mod.description;
            }
            const translation = await this.translationService.translateModContent(mod.title, mod.description, 'en');
            mod.translatedTitle = translation.translatedTitle;
            mod.translatedDescription = translation.translatedDescription;
            mod.lastTranslated = new Date();
            if (translation.detectedLanguage) {
                mod.language = translation.detectedLanguage;
            }
            mod.title = translation.translatedTitle;
            mod.description = translation.translatedDescription;
            await this.database.saveMod(mod);
            logger_1.logger.info(`Successfully translated mod: ${mod.title}`);
            return mod;
        }
        catch (error) {
            logger_1.logger.error(`Failed to translate mod ${mod.id}:`, error);
            return mod;
        }
    }
    async getMod(id, includeTranslation = true) {
        const mod = await this.database.getMod(id);
        if (!mod) {
            try {
                const workshopItems = await this.steamService.getPublishedFileDetails([id]);
                if (workshopItems.length > 0) {
                    const newMod = this.steamService.mapWorkshopItemToMod(workshopItems[0]);
                    if (includeTranslation && newMod.language && newMod.language !== 'en') {
                        await this.translateMod(newMod);
                    }
                    else {
                        await this.database.saveMod(newMod);
                    }
                    return newMod;
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to fetch mod ${id} from Steam Workshop:`, error);
            }
            return null;
        }
        return mod;
    }
    async getAllMods(limit = 100, offset = 0) {
        return await this.database.getAllMods(limit, offset);
    }
    async searchMods(searchTerm, limit = 50) {
        return await this.database.searchMods(searchTerm, limit);
    }
    async checkForUpdates() {
        try {
            logger_1.logger.info('Checking for mod updates...');
            const allMods = await this.database.getAllMods(1000);
            const updatedModIds = await this.steamService.getModUpdates(allMods);
            const updated = [];
            const errors = [];
            for (const modId of updatedModIds) {
                try {
                    const workshopItems = await this.steamService.getPublishedFileDetails([modId]);
                    if (workshopItems.length > 0) {
                        const updatedMod = this.steamService.mapWorkshopItemToMod(workshopItems[0]);
                        const existingMod = allMods.find(m => m.id === modId);
                        if (existingMod && existingMod.language && existingMod.language !== 'en') {
                            await this.translateMod(updatedMod, true);
                        }
                        else {
                            await this.database.saveMod(updatedMod);
                        }
                        updated.push(updatedMod);
                    }
                }
                catch (error) {
                    const errorMessage = `Failed to update mod ${modId}: ${error}`;
                    logger_1.logger.error(errorMessage);
                    errors.push(errorMessage);
                }
            }
            logger_1.logger.info(`Update check complete. ${updated.length} mods updated, ${errors.length} errors`);
            return { updated, errors };
        }
        catch (error) {
            logger_1.logger.error('Failed to check for updates:', error);
            throw error;
        }
    }
    async getModStatistics() {
        const allMods = await this.database.getAllMods(10000);
        const stats = {
            totalMods: allMods.length,
            translatedMods: allMods.filter(mod => mod.translatedTitle || mod.translatedDescription).length,
            languageBreakdown: {},
            recentUpdates: 0
        };
        for (const mod of allMods) {
            const lang = mod.language || 'unknown';
            stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
        }
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        stats.recentUpdates = allMods.filter(mod => mod.timeUpdated > weekAgo).length;
        return stats;
    }
    async refreshModTranslations(language) {
        const allMods = await this.database.getAllMods(10000);
        const modsToTranslate = language
            ? allMods.filter(mod => mod.language === language)
            : allMods.filter(mod => mod.language && mod.language !== 'en');
        let success = 0;
        let errors = 0;
        logger_1.logger.info(`Refreshing translations for ${modsToTranslate.length} mods`);
        for (const mod of modsToTranslate) {
            try {
                await this.translateMod(mod, true);
                success++;
            }
            catch (error) {
                logger_1.logger.error(`Failed to refresh translation for mod ${mod.id}:`, error);
                errors++;
            }
        }
        logger_1.logger.info(`Translation refresh complete. ${success} successful, ${errors} errors`);
        return { success, errors };
    }
}
exports.ModService = ModService;
//# sourceMappingURL=ModService.js.map