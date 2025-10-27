"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamWorkshopService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class SteamWorkshopService {
    constructor() {
        this.baseUrl = 'https://api.steampowered.com/ISteamRemoteStorage';
        this.apiKey = process.env.STEAM_API_KEY || '';
        this.appId = process.env.STEAM_APP_ID || '';
        if (!this.apiKey) {
            logger_1.logger.warn('Steam API key not configured. Steam Workshop features will be limited.');
        }
        if (!this.appId) {
            logger_1.logger.warn('Steam App ID not configured. Please set STEAM_APP_ID in environment variables.');
        }
    }
    async getPublishedFileDetails(fileIds) {
        if (!this.apiKey) {
            throw new Error('Steam API key not configured');
        }
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/GetPublishedFileDetails/v1/`, {
                key: this.apiKey,
                itemcount: fileIds.length,
                ...fileIds.reduce((acc, id, index) => ({
                    ...acc,
                    [`publishedfileids[${index}]`]: id
                }), {})
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 30000
            });
            if (response.data.response.result !== 1) {
                throw new Error(`Steam API returned error code: ${response.data.response.result}`);
            }
            return response.data.response.publishedfiledetails || [];
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch Steam Workshop details:', error);
            throw error;
        }
    }
    async getModUpdates(knownMods) {
        if (knownMods.length === 0)
            return [];
        try {
            const fileIds = knownMods.map(mod => mod.id);
            const workshopItems = await this.getPublishedFileDetails(fileIds);
            const updatedMods = [];
            for (const item of workshopItems) {
                const knownMod = knownMods.find(mod => mod.id === item.publishedfileid);
                if (knownMod && item.time_updated > knownMod.timeUpdated.getTime() / 1000) {
                    updatedMods.push(item.publishedfileid);
                }
            }
            logger_1.logger.info(`Found ${updatedMods.length} updated mods out of ${knownMods.length} checked`);
            return updatedMods;
        }
        catch (error) {
            logger_1.logger.error('Failed to check for mod updates:', error);
            return [];
        }
    }
    mapWorkshopItemToMod(item) {
        return {
            id: item.publishedfileid,
            title: item.title || 'Unknown Title',
            description: item.description || '',
            creator: item.creator || 'Unknown Creator',
            previewUrl: item.preview_url || '',
            fileSize: item.file_size || 0,
            subscriptions: item.subscriptions || 0,
            rating: this.calculateRating(item.lifetime_favorited, item.lifetime_subscriptions),
            tags: item.tags?.map(tag => tag.tag) || [],
            timeCreated: new Date(item.time_created * 1000),
            timeUpdated: new Date(item.time_updated * 1000),
            language: this.detectLanguage(item.title, item.description)
        };
    }
    calculateRating(favorited, subscriptions) {
        if (subscriptions === 0)
            return 0;
        return (favorited / subscriptions) * 5;
    }
    detectLanguage(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const koreanPattern = /[\u3131-\u3163\uac00-\ud7a3]/;
        const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf]/;
        const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
        if (koreanPattern.test(text))
            return 'ko';
        if (chinesePattern.test(text))
            return 'zh';
        if (japanesePattern.test(text))
            return 'ja';
        return 'en';
    }
    async validateConfiguration() {
        if (!this.apiKey) {
            return { valid: false, message: 'Steam API key not configured' };
        }
        if (!this.appId) {
            return { valid: false, message: 'Steam App ID not configured' };
        }
        try {
            await axios_1.default.get(`${this.baseUrl}/GetPublishedFileDetails/v1/`, {
                params: {
                    key: this.apiKey,
                    itemcount: 1,
                    'publishedfileids[0]': '1'
                },
                timeout: 10000
            });
            return { valid: true, message: 'Steam API configuration is valid' };
        }
        catch (error) {
            logger_1.logger.error('Steam API validation failed:', error);
            return { valid: false, message: 'Failed to connect to Steam API' };
        }
    }
}
exports.SteamWorkshopService = SteamWorkshopService;
//# sourceMappingURL=SteamWorkshopService.js.map