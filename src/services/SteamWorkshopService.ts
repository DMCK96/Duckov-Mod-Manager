import axios from 'axios';
import { logger } from '../utils/logger';
import { SteamWorkshopItem, SteamWorkshopResponse, ModInfo } from '../types';
import * as cheerio from 'cheerio';

export class SteamWorkshopService {
  private apiKey: string;
  private appId: string;
  private baseUrl = 'https://api.steampowered.com/ISteamRemoteStorage';

  constructor() {
    this.apiKey = process.env.STEAM_API_KEY || '';
    this.appId = process.env.STEAM_APP_ID || '';
    
    if (!this.apiKey) {
      logger.warn('Steam API key not configured. Steam Workshop features will be limited.');
    }
    
    if (!this.appId) {
      logger.warn('Steam App ID not configured. Please set STEAM_APP_ID in environment variables.');
    }
  }

  async getPublishedFileDetails(fileIds: string[]): Promise<SteamWorkshopItem[]> {
    if (!this.apiKey) {
      throw new Error('Steam API key not configured');
    }

    try {
      const response = await axios.post<SteamWorkshopResponse>(
        `${this.baseUrl}/GetPublishedFileDetails/v1/`,
        {
          key: this.apiKey,
          itemcount: fileIds.length,
          ...fileIds.reduce((acc, id, index) => ({
            ...acc,
            [`publishedfileids[${index}]`]: id
          }), {})
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000
        }
      );

      if (response.data.response.result !== 1) {
        throw new Error(`Steam API returned error code: ${response.data.response.result}`);
      }

      return response.data.response.publishedfiledetails || [];
    } catch (error) {
      logger.error('Failed to fetch Steam Workshop details:', error);
      throw error;
    }
  }



  async getModUpdates(knownMods: ModInfo[]): Promise<string[]> {
    if (knownMods.length === 0) return [];

    try {
      const fileIds = knownMods.map(mod => mod.id);
      const workshopItems = await this.getPublishedFileDetails(fileIds);
      
      const updatedMods: string[] = [];
      
      for (const item of workshopItems) {
        const knownMod = knownMods.find(mod => mod.id === item.publishedfileid);
        if (knownMod && item.time_updated > knownMod.timeUpdated.getTime() / 1000) {
          updatedMods.push(item.publishedfileid);
        }
      }

      logger.info(`Found ${updatedMods.length} updated mods out of ${knownMods.length} checked`);
      return updatedMods;
    } catch (error) {
      logger.error('Failed to check for mod updates:', error);
      return [];
    }
  }

  mapWorkshopItemToMod(item: SteamWorkshopItem): ModInfo {
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

  private calculateRating(favorited: number, subscriptions: number): number {
    if (subscriptions === 0) return 0;
    return (favorited / subscriptions) * 5; // Convert to 5-star rating
  }

  private detectLanguage(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    // Simple language detection based on character patterns
    const koreanPattern = /[\u3131-\u3163\uac00-\ud7a3]/;
    const chinesePattern = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
    
    if (koreanPattern.test(text)) return 'ko';
    if (chinesePattern.test(text)) return 'zh';
    if (japanesePattern.test(text)) return 'ja';
    
    return 'en';
  }

  async validateConfiguration(): Promise<{ valid: boolean; message: string }> {
    if (!this.apiKey) {
      return { valid: false, message: 'Steam API key not configured' };
    }
    
    if (!this.appId) {
      return { valid: false, message: 'Steam App ID not configured' };
    }

    try {
      // Test API connection with a simple request
      await axios.get(`${this.baseUrl}/GetPublishedFileDetails/v1/`, {
        params: {
          key: this.apiKey,
          itemcount: 1,
          'publishedfileids[0]': '1' // Dummy ID to test API
        },
        timeout: 10000
      });
      
      return { valid: true, message: 'Steam API configuration is valid' };
    } catch (error) {
      logger.error('Steam API validation failed:', error);
      return { valid: false, message: 'Failed to connect to Steam API' };
    }
  }

  /**
   * Extracts mod IDs from a Steam Workshop collection URL
   */
  async getCollectionItems(collectionUrl: string): Promise<string[]> {
    try {
      logger.info(`Fetching collection from URL: ${collectionUrl}`);
      
      // Extract collection ID from URL
      const collectionIdMatch = collectionUrl.match(/\?id=(\d+)/);
      if (!collectionIdMatch) {
        throw new Error('Invalid collection URL format. Expected format: https://steamcommunity.com/sharedfiles/filedetails/?id=XXXXXXXXX');
      }
      
      const collectionId = collectionIdMatch[1];
      
      // Fetch the collection page
      const response = await axios.get(collectionUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      const $ = cheerio.load(response.data);
      const modIds: string[] = [];
      
      // Find all workshop item links in the collection
      $('.collectionItemDetails a').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const modIdMatch = href.match(/\?id=(\d+)/);
          if (modIdMatch) {
            modIds.push(modIdMatch[1]);
          }
        }
      });
      
      // Alternative selector if the first one doesn't work
      if (modIds.length === 0) {
        $('.workshopItem').each((_, element) => {
          const href = $(element).find('a').attr('href');
          if (href) {
            const modIdMatch = href.match(/\?id=(\d+)/);
            if (modIdMatch) {
              modIds.push(modIdMatch[1]);
            }
          }
        });
      }
      
      // Remove duplicates
      const uniqueModIds = [...new Set(modIds)];
      
      logger.info(`Found ${uniqueModIds.length} mods in collection ${collectionId}`);
      return uniqueModIds;
    } catch (error) {
      logger.error('Failed to fetch collection items:', error);
      throw error;
    }
  }
}
