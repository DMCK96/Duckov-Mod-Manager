/**
 * Electron Preload Script
 * Creates a secure bridge between main and renderer processes
 *
 * Security principles:
 * - No direct Node.js API access to renderer
 * - Whitelist only necessary IPC channels
 * - Validate all inputs/outputs
 * - Use contextBridge to expose limited API
 */

import { contextBridge, ipcRenderer } from 'electron';

// Inline type definitions to avoid module resolution issues in sandboxed preload
// These types are copied from ./types/electron.ts and ./types/index.ts

/**
 * IPC Channel definitions - must match main process
 */
enum IpcChannels {
  // Mod operations
  MODS_SCAN = 'mods:scan',
  MODS_GET_ALL = 'mods:get-all',
  MODS_GET_BY_ID = 'mods:get-by-id',
  MODS_SEARCH = 'mods:search',
  MODS_SYNC = 'mods:sync',
  MODS_EXPORT = 'mods:export',
  MODS_COLLECTION = 'mods:collection',

  // Translation operations
  TRANSLATION_TRANSLATE = 'translation:translate',
  TRANSLATION_GET_CACHED = 'translation:get-cached',
  TRANSLATION_CLEAR_CACHE = 'translation:clear-cache',

  // Settings operations
  SETTINGS_GET_WORKSHOP_PATH = 'settings:get-workshop-path',
  SETTINGS_SET_WORKSHOP_PATH = 'settings:set-workshop-path',
  SETTINGS_GET_DUCKOV_GAME_PATH = 'settings:get-duckov-game-path',
  SETTINGS_SET_DUCKOV_GAME_PATH = 'settings:set-duckov-game-path',
  SETTINGS_IS_WORKSHOP_CONFIGURED = 'settings:is-workshop-configured',

  // Symlink operations
  SYMLINK_LIST_ACTIVE = 'symlink:list-active',
  SYMLINK_GET_AVAILABLE_MODS = 'symlink:get-available-mods',
  SYMLINK_CREATE = 'symlink:create',
  SYMLINK_REMOVE = 'symlink:remove',
  SYMLINK_VALIDATE_PATHS = 'symlink:validate-paths',

  // File dialog operations
  DIALOG_OPEN = 'dialog:open',
  DIALOG_SAVE = 'dialog:save',

  // App operations
  APP_GET_INFO = 'app:get-info',
  APP_GET_PATH = 'app:get-path',
  APP_QUIT = 'app:quit',
  APP_RELAUNCH = 'app:relaunch',
  APP_MINIMIZE = 'app:minimize',
  APP_MAXIMIZE = 'app:maximize',
  APP_CLOSE = 'app:close',

  // Background task operations
  BACKGROUND_TASK_PROGRESS = 'background-task:progress',
  BACKGROUND_TASK_COMPLETE = 'background-task:complete',
}

/**
 * Translation request interface
 */
interface TranslationRequest {
  text: string;
  sourceLang?: string;
  targetLang: string;
  context?: string;
}

/**
 * File dialog options
 */
interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * Electron API interface
 */
interface ElectronAPI {
  // Mod operations
  scanMods: () => Promise<any>;
  getAllMods: (limit?: number, offset?: number) => Promise<any>;
  getModById: (id: string) => Promise<any>;
  searchMods: (query: string) => Promise<any>;
  syncMods: () => Promise<any>;
  exportMods: (filePath: string, modIds: string[]) => Promise<any>;
  getCollectionMods: (collectionUrl: string) => Promise<any>;
  invoke: (channel: string, args?: any) => Promise<any>;

  // Translation operations
  translate: (request: TranslationRequest) => Promise<any>;
  getCachedTranslation: (text: string, sourceLang: string, targetLang: string) => Promise<any>;
  clearTranslationCache: () => Promise<any>;

  // Settings operations
  getWorkshopPath: () => Promise<string>;
  setWorkshopPath: (path: string) => Promise<void>;
  getDuckovGamePath: () => Promise<string>;
  setDuckovGamePath: (path: string) => Promise<void>;
  isWorkshopConfigured: () => Promise<boolean>;

  // Symlink operations
  listActiveSymlinks: () => Promise<any>;
  getAvailableMods: () => Promise<any>;
  createSymlink: (modId: string) => Promise<any>;
  removeSymlink: (modId: string) => Promise<any>;
  validateSymlinkPaths: () => Promise<any>;

  // File dialog operations
  showOpenDialog: (options: OpenDialogOptions) => Promise<any>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<any>;

  // App operations
  getAppInfo: () => Promise<any>;
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'downloads' | 'documents') => Promise<string>;
  quit: () => void;
  relaunch: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  // Background task operations
  onBackgroundTaskProgress: (callback: (progress: any) => void) => () => void;
  onBackgroundTaskComplete: (callback: (taskId: string) => void) => () => void;
}

/**
 * Validate IPC channel to prevent arbitrary channel access
 */
function isValidChannel(channel: string): boolean {
  return Object.values(IpcChannels).includes(channel as any);
}

/**
 * Safe IPC invoke wrapper with validation
 */
async function safeInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return await ipcRenderer.invoke(channel, ...args);
}

/**
 * Safe IPC send wrapper (for fire-and-forget operations)
 */
function safeSend(channel: string, ...args: unknown[]): void {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  ipcRenderer.send(channel, ...args);
}

/**
 * Electron API exposed to renderer process
 * This is the ONLY interface the renderer can use to communicate with main process
 */
const electronAPI: ElectronAPI = {
  // ==========================================
  // Mod Operations
  // ==========================================

  /**
   * Scan and sync local mods from workshop folder
   */
  scanMods: async () => {
    return await safeInvoke(IpcChannels.MODS_SCAN);
  },

  /**
   * Get all mods with optional pagination
   */
  getAllMods: async (limit?: number, offset?: number) => {
    return await safeInvoke(IpcChannels.MODS_GET_ALL, { limit, offset });
  },

  /**
   * Get mod details by ID
   */
  getModById: async (id: string) => {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Invalid mod ID');
    }
    return await safeInvoke(IpcChannels.MODS_GET_BY_ID, { id });
  },

  /**
   * Search mods by query
   */
  searchMods: async (query: string) => {
    if (typeof query !== 'string') {
      throw new Error('Invalid search query');
    }
    return await safeInvoke(IpcChannels.MODS_SEARCH, { query });
  },

  /**
   * Sync mods with Steam Workshop
   */
  syncMods: async () => {
    return await safeInvoke(IpcChannels.MODS_SYNC);
  },

  /**
   * Export mods to file
   */
  exportMods: async (filePath: string, modIds: string[]) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Invalid file path');
    }
    if (!Array.isArray(modIds) || modIds.some(id => typeof id !== 'string')) {
      throw new Error('Invalid mod IDs array');
    }
    return await safeInvoke(IpcChannels.MODS_EXPORT, { filePath, modIds });
  },

  /**
   * Get mod IDs from a Steam Workshop collection
   */
  getCollectionMods: async (collectionUrl: string) => {
    if (typeof collectionUrl !== 'string' || !collectionUrl.trim()) {
      throw new Error('Invalid collection URL');
    }
    return await safeInvoke(IpcChannels.MODS_COLLECTION, { collectionUrl });
  },

  // ==========================================
  // Translation Operations
  // ==========================================

  /**
   * Translate text
   */
  translate: async (request: TranslationRequest) => {
    if (!request || typeof request.text !== 'string' || !request.text.trim()) {
      throw new Error('Invalid translation request: text is required');
    }
    if (typeof request.targetLang !== 'string' || !request.targetLang.trim()) {
      throw new Error('Invalid translation request: targetLang is required');
    }
    return await safeInvoke(IpcChannels.TRANSLATION_TRANSLATE, request);
  },

  /**
   * Get cached translation
   */
  getCachedTranslation: async (text: string, sourceLang: string, targetLang: string) => {
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Invalid text');
    }
    if (typeof sourceLang !== 'string' || !sourceLang.trim()) {
      throw new Error('Invalid source language');
    }
    if (typeof targetLang !== 'string' || !targetLang.trim()) {
      throw new Error('Invalid target language');
    }
    return await safeInvoke(IpcChannels.TRANSLATION_GET_CACHED, { text, sourceLang, targetLang });
  },

  /**
   * Clear translation cache
   */
  clearTranslationCache: async () => {
    return await safeInvoke(IpcChannels.TRANSLATION_CLEAR_CACHE);
  },

  // ==========================================
  // Settings Operations
  // ==========================================

  /**
   * Get workshop path setting
   */
  getWorkshopPath: async () => {
    const result: any = await safeInvoke(IpcChannels.SETTINGS_GET_WORKSHOP_PATH);
    return result.data || '';
  },

  /**
   * Set workshop path setting
   */
  setWorkshopPath: async (path: string) => {
    if (typeof path !== 'string') {
      throw new Error('Invalid workshop path');
    }
    await safeInvoke(IpcChannels.SETTINGS_SET_WORKSHOP_PATH, { path });
  },

  /**
   * Check if workshop is configured
   */
  isWorkshopConfigured: async () => {
    const result: any = await safeInvoke(IpcChannels.SETTINGS_IS_WORKSHOP_CONFIGURED);
    return result.data || false;
  },

  /**
   * Get duckov game path setting
   */
  getDuckovGamePath: async () => {
    const result: any = await safeInvoke(IpcChannels.SETTINGS_GET_DUCKOV_GAME_PATH);
    return result.data || '';
  },

  /**
   * Set duckov game path setting
   */
  setDuckovGamePath: async (path: string) => {
    if (typeof path !== 'string') {
      throw new Error('Invalid duckov game path');
    }
    await safeInvoke(IpcChannels.SETTINGS_SET_DUCKOV_GAME_PATH, { path });
  },

  // ==========================================
  // Symlink Operations
  // ==========================================

  /**
   * List all active symlinks
   */
  listActiveSymlinks: async () => {
    const result: any = await safeInvoke(IpcChannels.SYMLINK_LIST_ACTIVE);
    return result.data || [];
  },

  /**
   * Get available mods (without symlinks)
   */
  getAvailableMods: async () => {
    const result: any = await safeInvoke(IpcChannels.SYMLINK_GET_AVAILABLE_MODS);
    return result.data || [];
  },

  /**
   * Create a symlink for a mod
   */
  createSymlink: async (modId: string) => {
    if (typeof modId !== 'string' || !modId.trim()) {
      throw new Error('Invalid mod ID');
    }
    return await safeInvoke(IpcChannels.SYMLINK_CREATE, { modId });
  },

  /**
   * Remove a symlink for a mod
   */
  removeSymlink: async (modId: string) => {
    if (typeof modId !== 'string' || !modId.trim()) {
      throw new Error('Invalid mod ID');
    }
    return await safeInvoke(IpcChannels.SYMLINK_REMOVE, { modId });
  },

  /**
   * Validate symlink paths configuration
   */
  validateSymlinkPaths: async () => {
    const result: any = await safeInvoke(IpcChannels.SYMLINK_VALIDATE_PATHS);
    return result.data || { valid: false, errors: ['Unknown error'] };
  },

  // ==========================================
  // File Dialog Operations
  // ==========================================

  /**
   * Show open file/folder dialog
   */
  showOpenDialog: async (options: OpenDialogOptions) => {
    // Validate options
    if (options.properties) {
      const validProps = ['openFile', 'openDirectory', 'multiSelections'];
      if (!options.properties.every(prop => validProps.includes(prop))) {
        throw new Error('Invalid dialog properties');
      }
    }
    return await safeInvoke(IpcChannels.DIALOG_OPEN, options);
  },

  /**
   * Show save file dialog
   */
  showSaveDialog: async (options: SaveDialogOptions) => {
    // Validate filters if provided
    if (options.filters) {
      if (!Array.isArray(options.filters)) {
        throw new Error('Invalid dialog filters: must be array');
      }
      for (const filter of options.filters) {
        if (!filter.name || !filter.extensions || !Array.isArray(filter.extensions)) {
          throw new Error('Invalid dialog filter format');
        }
      }
    }
    return await safeInvoke(IpcChannels.DIALOG_SAVE, options);
  },

  // ==========================================
  // App Operations
  // ==========================================

  /**
   * Get app information
   */
  getAppInfo: async () => {
    return await safeInvoke(IpcChannels.APP_GET_INFO);
  },

  /**
   * Get system path
   */
  getPath: async (name: 'home' | 'appData' | 'userData' | 'temp' | 'downloads' | 'documents') => {
    const validNames = ['home', 'appData', 'userData', 'temp', 'downloads', 'documents'];
    if (!validNames.includes(name)) {
      throw new Error(`Invalid path name: ${name}`);
    }
    return await safeInvoke(IpcChannels.APP_GET_PATH, { name });
  },

  /**
   * Quit the application
   */
  quit: () => {
    safeSend(IpcChannels.APP_QUIT);
  },

  /**
   * Relaunch the application
   */
  relaunch: () => {
    safeSend(IpcChannels.APP_RELAUNCH);
  },

  /**
   * Minimize the window
   */
  minimize: () => {
    safeSend(IpcChannels.APP_MINIMIZE);
  },

  /**
   * Maximize/restore the window
   */
  maximize: () => {
    safeSend(IpcChannels.APP_MAXIMIZE);
  },

  /**
   * Close the window
   */
  close: () => {
    safeSend(IpcChannels.APP_CLOSE);
  },

  // ==========================================
  // Background Task Operations
  // ==========================================

  /**
   * Listen to background task progress updates
   * Returns a cleanup function to remove the listener
   */
  onBackgroundTaskProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on(IpcChannels.BACKGROUND_TASK_PROGRESS, listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IpcChannels.BACKGROUND_TASK_PROGRESS, listener);
    };
  },

  /**
   * Listen to background task completion events
   * Returns a cleanup function to remove the listener
   */
  onBackgroundTaskComplete: (callback: (taskId: string) => void) => {
    const listener = (_event: any, taskId: string) => callback(taskId);
    ipcRenderer.on(IpcChannels.BACKGROUND_TASK_COMPLETE, listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IpcChannels.BACKGROUND_TASK_COMPLETE, listener);
    };
  },

  // ==========================================
  // Generic invoke for additional channels
  // ==========================================

  /**
   * Generic invoke method for IPC channels
   */
  invoke: async (channel: string, args?: any) => {
    return await safeInvoke(channel, args);
  },
};

/**
 * Expose the Electron API to the renderer process
 * This is the only way the renderer can access Electron/Node.js features
 */
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/**
 * Log successful preload initialization (only in development)
 */
if (process.env.NODE_ENV === 'development') {
  console.log('[Preload] Context bridge initialized successfully');
  console.log('[Preload] Available API methods:', Object.keys(electronAPI));
}
