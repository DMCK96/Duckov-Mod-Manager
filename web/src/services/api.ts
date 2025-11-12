/**
 * API Service Layer - Electron IPC Abstraction
 *
 * This service provides a clean abstraction over Electron IPC communication,
 * making it easy to migrate from HTTP API calls to IPC without changing component logic.
 *
 * Key Features:
 * - Type-safe API calls using TypeScript
 * - Consistent error handling across all operations
 * - Graceful fallback when running outside Electron
 * - Logging for debugging
 * - Matches the interface of the old HTTP API for easy migration
 */

/**
 * Check if window.electronAPI is available
 * This will be true when running in Electron, false in browser dev mode
 */
function isElectronAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

/**
 * Throws error if Electron API is not available
 * Provides helpful error message for debugging
 */
function requireElectron(): void {
  if (!isElectronAvailable()) {
    throw new Error(
      'Electron API not available. ' +
      'This app must run in Electron. ' +
      'Make sure you are running: npm run electron:dev or npm start'
    );
  }
}

/**
 * Type definitions for API responses
 * Matches the structure returned by IPC handlers
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Mod-related API operations
 */
export const modsAPI = {
  /**
   * Get all mods with optional pagination
   * @param limit - Maximum number of mods to return (default: 1000)
   * @param offset - Number of mods to skip (default: 0)
   */
  async getAllMods(limit: number = 1000, offset: number = 0): Promise<any[]> {
    requireElectron();

    try {
      console.log(`[API] Fetching all mods (limit: ${limit}, offset: ${offset})`);
      const result = await window.electronAPI.getAllMods(limit, offset);

      if (result.success && result.data) {
        console.log(`[API] Fetched ${result.data.length} mods`);
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to fetch mods');
      }
    } catch (error) {
      console.error('[API] Failed to fetch mods:', error);
      throw error;
    }
  },

  /**
   * Get a specific mod by ID
   * @param id - Mod ID
   */
  async getModById(id: string): Promise<any> {
    requireElectron();

    try {
      console.log(`[API] Fetching mod ${id}`);
      const result = await window.electronAPI.getModById(id);

      if (result.success && result.data) {
        return result.data;
      } else {
        throw new Error(result.error || 'Mod not found');
      }
    } catch (error) {
      console.error(`[API] Failed to fetch mod ${id}:`, error);
      throw error;
    }
  },

  /**
   * Search mods by query string
   * @param query - Search query
   * @param limit - Maximum number of results (default: 1000)
   */
  async searchMods(query: string, limit: number = 1000): Promise<any[]> {
    requireElectron();

    try {
      console.log(`[API] Searching mods: "${query}"`);
      const result = await window.electronAPI.searchMods(query);

      if (result.success && result.data) {
        console.log(`[API] Found ${result.data.length} mods matching "${query}"`);
        return result.data;
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (error) {
      console.error('[API] Search failed:', error);
      throw error;
    }
  },

  /**
   * Scan local workshop folder and sync mods
   * This triggers a full rescan of the local workshop folder
   */
  async scanWorkshopFolder(): Promise<{
    scanned: number;
    synced: number;
    errors: number;
    mods: any[];
    errorMessages: string[];
  }> {
    requireElectron();

    try {
      console.log('[API] Starting workshop folder scan...');
      const result = await window.electronAPI.scanMods();

      if (result.success && result.data) {
        console.log(
          `[API] Scan complete: ${result.data.scanned} scanned, ` +
          `${result.data.synced} synced, ${result.data.errors} errors`
        );
        return result.data;
      } else {
        throw new Error(result.error || 'Scan failed');
      }
    } catch (error) {
      console.error('[API] Workshop scan failed:', error);
      throw error;
    }
  },

  /**
   * Sync specific mods from workshop
   * In offline mode, this just rescans the local folder
   * @param fileIds - Array of Steam Workshop file IDs (not used in offline mode)
   */
  async syncMods(fileIds: string[]): Promise<{
    synced: number;
    errors: number;
    mods: any[];
    errorMessages: string[];
  }> {
    requireElectron();

    try {
      console.log(`[API] Syncing ${fileIds.length} mods...`);
      const result = await window.electronAPI.syncMods();

      if (result.success && result.data) {
        console.log(`[API] Sync complete: ${result.data.synced} synced, ${result.data.errors} errors`);
        return result.data;
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('[API] Mod sync failed:', error);
      throw error;
    }
  },

  /**
   * Export selected mods as a zip file
   * Opens a save dialog and creates a zip archive
   * @param modIds - Array of mod IDs to export
   */
  async exportMods(modIds: string[]): Promise<{
    success: boolean;
    filePath: string;
    exportedCount: number;
    missingMods: string[];
  }> {
    requireElectron();

    try {
      console.log(`[API] Exporting ${modIds.length} mods...`);

      // Show save dialog to let user choose export location
      const saveDialogResult = await window.electronAPI.showSaveDialog({
        title: 'Export Mods',
        defaultPath: `duckov-mods-export-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`,
        filters: [
          { name: 'Zip Files', extensions: ['zip'] }
        ]
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        throw new Error('Export canceled by user');
      }

      // Export mods to the chosen location
      const result = await window.electronAPI.exportMods(saveDialogResult.filePath, modIds);

      if (result.success) {
        console.log(
          `[API] Export complete: ${result.exportedCount} mods exported to ${result.filePath}`
        );
        return result;
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('[API] Mod export failed:', error);
      throw error;
    }
  },

  /**
   * Get mod statistics overview
   */
  async getStatistics(): Promise<{
    totalMods: number;
    translatedMods: number;
    languageBreakdown: Record<string, number>;
    recentUpdates: number;
  }> {
    requireElectron();

    try {
      console.log('[API] Fetching mod statistics...');

      // Use the mods:stats handler we defined
      const result = await window.electronAPI.getAllMods(10000, 0);

      if (result.success && result.data) {
        const mods = result.data;

        // Calculate statistics client-side
        const stats = {
          totalMods: mods.length,
          translatedMods: mods.filter((mod: any) =>
            mod.translatedTitle || mod.translatedDescription
          ).length,
          languageBreakdown: {} as Record<string, number>,
          recentUpdates: 0
        };

        // Language breakdown
        for (const mod of mods) {
          const lang = mod.language || 'unknown';
          stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
        }

        // Recent updates (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        stats.recentUpdates = mods.filter((mod: any) =>
          new Date(mod.timeUpdated) > weekAgo
        ).length;

        console.log('[API] Statistics calculated:', stats);
        return stats;
      } else {
        throw new Error(result.error || 'Failed to fetch statistics');
      }
    } catch (error) {
      console.error('[API] Failed to fetch statistics:', error);
      throw error;
    }
  }
};

/**
 * Translation-related API operations
 */
export const translationAPI = {
  /**
   * Translate text using offline translation service
   * @param text - Text to translate
   * @param targetLang - Target language (default: 'en')
   * @param sourceLang - Source language (default: 'zh')
   */
  async translateText(
    text: string,
    targetLang: string = 'en',
    sourceLang: string = 'zh'
  ): Promise<{
    translatedText: string;
    originalText: string;
    detectedLanguage: string;
    targetLanguage: string;
  }> {
    requireElectron();

    try {
      console.log(`[API] Translating text (${text.length} chars)...`);
      const result = await window.electronAPI.translate({
        text,
        targetLang,
        sourceLang
      });

      if (result.success && result.data) {
        return result.data;
      } else {
        throw new Error(result.error || 'Translation failed');
      }
    } catch (error) {
      console.error('[API] Translation failed:', error);
      throw error;
    }
  },

  /**
   * Get cached translation
   * @param text - Original text
   * @param sourceLang - Source language
   * @param targetLang - Target language
   */
  async getCachedTranslation(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<any | null> {
    requireElectron();

    try {
      const result = await window.electronAPI.getCachedTranslation(text, sourceLang, targetLang);
      return result;
    } catch (error) {
      console.error('[API] Failed to get cached translation:', error);
      return null;
    }
  },

  /**
   * Get translation cache statistics
   */
  async getCacheStats(): Promise<{
    cached: number;
    total: number;
    hitRate: number;
    modelLoadTime: number;
  }> {
    requireElectron();

    try {
      console.log('[API] Fetching translation cache stats...');

      // Note: The IPC handler returns a different structure, so we'll need to adapt
      // For now, return mock stats until we implement the stats handler
      return {
        cached: 0,
        total: 0,
        hitRate: 0,
        modelLoadTime: 0
      };
    } catch (error) {
      console.error('[API] Failed to fetch cache stats:', error);
      throw error;
    }
  },

  /**
   * Clear translation cache
   */
  async clearCache(): Promise<void> {
    requireElectron();

    try {
      console.log('[API] Clearing translation cache...');
      const result = await window.electronAPI.clearTranslationCache();

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear cache');
      }

      console.log('[API] Translation cache cleared successfully');
    } catch (error) {
      console.error('[API] Failed to clear cache:', error);
      throw error;
    }
  }
};

/**
 * File dialog operations
 */
export const fileAPI = {
  /**
   * Show open file/folder dialog
   * @param options - Dialog options
   */
  async showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }): Promise<{ canceled: boolean; filePaths: string[] }> {
    requireElectron();

    try {
      return await window.electronAPI.showOpenDialog(options);
    } catch (error) {
      console.error('[API] Open dialog failed:', error);
      throw error;
    }
  },

  /**
   * Show save file dialog
   * @param options - Dialog options
   */
  async showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }> {
    requireElectron();

    try {
      return await window.electronAPI.showSaveDialog(options);
    } catch (error) {
      console.error('[API] Save dialog failed:', error);
      throw error;
    }
  }
};

/**
 * App control operations
 */
export const appAPI = {
  /**
   * Get app information
   */
  async getAppInfo(): Promise<{
    name: string;
    version: string;
    platform: string;
    arch: string;
  }> {
    requireElectron();

    try {
      const result = await window.electronAPI.getAppInfo();

      if (result.success && result.data) {
        return result.data;
      } else {
        throw new Error('Failed to get app info');
      }
    } catch (error) {
      console.error('[API] Failed to get app info:', error);
      throw error;
    }
  },

  /**
   * Get system path
   * @param name - Path name ('home', 'appData', 'userData', 'temp', 'downloads', 'documents')
   */
  async getPath(name: 'home' | 'appData' | 'userData' | 'temp' | 'downloads' | 'documents'): Promise<string> {
    requireElectron();

    try {
      return await window.electronAPI.getPath(name);
    } catch (error) {
      console.error('[API] Failed to get path:', error);
      throw error;
    }
  },

  /**
   * Minimize window
   */
  minimize(): void {
    if (isElectronAvailable()) {
      window.electronAPI.minimize();
    }
  },

  /**
   * Maximize/restore window
   */
  maximize(): void {
    if (isElectronAvailable()) {
      window.electronAPI.maximize();
    }
  },

  /**
   * Close window
   */
  close(): void {
    if (isElectronAvailable()) {
      window.electronAPI.close();
    }
  },

  /**
   * Quit application
   */
  quit(): void {
    if (isElectronAvailable()) {
      window.electronAPI.quit();
    }
  },

  /**
   * Relaunch application
   */
  relaunch(): void {
    if (isElectronAvailable()) {
      window.electronAPI.relaunch();
    }
  }
};

/**
 * Utility function to check if running in Electron
 * Can be used by components to conditionally render Electron-specific UI
 */
export function isRunningInElectron(): boolean {
  return isElectronAvailable();
}

/**
 * Default export with all APIs
 */
export default {
  mods: modsAPI,
  translation: translationAPI,
  file: fileAPI,
  app: appAPI,
  isRunningInElectron
};
