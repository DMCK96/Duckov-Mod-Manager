import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Steam Workshop API Response Types
 */
interface SteamWorkshopItem {
  publishedfileid: string;
  creator: string;
  title: string;
  description: string;
  time_created: number;
  time_updated: number;
  subscriptions: number;
  favorited: number;
  lifetime_subscriptions: number;
  views: number;
  tags?: Array<{ tag: string }>;
  preview_url?: string;
  file_size?: number;
}

interface SteamAPIResponse {
  response: {
    result: number;
    resultcount: number;
    publishedfiledetails: SteamWorkshopItem[];
  };
}

/**
 * SteamWorkshopService - Fetches mod metadata from Steam Workshop API
 * 
 * This service makes HTTP requests to Steam's public Workshop API to get
 * mod titles, descriptions, preview images, and other metadata that isn't
 * stored in the local workshop folder.
 */
export class SteamWorkshopService {
  private readonly STEAM_API_URL = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
  private readonly MAX_BATCH_SIZE = 100; // Steam API limit

  /**
   * Fetch details for a single workshop item
   */
  async getWorkshopItem(publishedFileId: string): Promise<SteamWorkshopItem | null> {
    try {
      logger.info(`Fetching Steam Workshop details for mod: ${publishedFileId}`);

      const response = await axios.post<SteamAPIResponse>(
        this.STEAM_API_URL,
        new URLSearchParams({
          itemcount: '1',
          'publishedfileids[0]': publishedFileId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (response.data?.response?.publishedfiledetails?.[0]) {
        const item = response.data.response.publishedfiledetails[0];
        
        // Check if the item was found (result 1 = success)
        if (item && (item as any).result === 1) {
          logger.debug(`Successfully fetched details for mod: ${item.title}`);
          return item;
        } else {
          logger.warn(`Mod ${publishedFileId} not found or access denied (result: ${(item as any).result})`);
          return null;
        }
      }

      logger.warn(`No details returned for mod: ${publishedFileId}`);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Steam API request failed for mod ${publishedFileId}: ${error.message}`);
      } else {
        logger.error(`Failed to fetch Steam Workshop item ${publishedFileId}:`, error);
      }
      return null;
    }
  }

  /**
   * Fetch details for multiple workshop items in a batch
   * Steam API supports up to 100 items per request
   */
  async getWorkshopItems(publishedFileIds: string[]): Promise<Map<string, SteamWorkshopItem>> {
    const results = new Map<string, SteamWorkshopItem>();

    if (publishedFileIds.length === 0) {
      return results;
    }

    try {
      // Process in batches of MAX_BATCH_SIZE
      for (let i = 0; i < publishedFileIds.length; i += this.MAX_BATCH_SIZE) {
        const batch = publishedFileIds.slice(i, i + this.MAX_BATCH_SIZE);
        logger.info(`Fetching Steam Workshop details for batch of ${batch.length} mods (${i + 1}-${i + batch.length} of ${publishedFileIds.length})`);

        const params = new URLSearchParams({
          itemcount: batch.length.toString(),
        });

        batch.forEach((id, index) => {
          params.append(`publishedfileids[${index}]`, id);
        });

        const response = await axios.post<SteamAPIResponse>(
          this.STEAM_API_URL,
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 30000, // 30 second timeout for batch requests
          }
        );

        if (response.data?.response?.publishedfiledetails) {
          response.data.response.publishedfiledetails.forEach((item) => {
            // Only add items that were successfully retrieved (result 1 = success)
            if (item && (item as any).result === 1) {
              results.set(item.publishedfileid, item);
            }
          });
        }

        // Add a small delay between batches to be nice to Steam's API
        if (i + this.MAX_BATCH_SIZE < publishedFileIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Successfully fetched ${results.size} of ${publishedFileIds.length} workshop items`);
      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Steam API batch request failed: ${error.message}`);
      } else {
        logger.error('Failed to fetch Steam Workshop items:', error);
      }
      return results;
    }
  }

  /**
   * Check if the Steam Workshop API is accessible
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Try to fetch a known workshop item (Core game mod)
      const testModId = '3167020'; // Use app ID as test
      const response = await axios.post<SteamAPIResponse>(
        this.STEAM_API_URL,
        new URLSearchParams({
          itemcount: '1',
          'publishedfileids[0]': testModId,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
        }
      );

      return response.status === 200 && !!response.data?.response;
    } catch (error) {
      logger.error('Steam Workshop API connection validation failed:', error);
      return false;
    }
  }
}
