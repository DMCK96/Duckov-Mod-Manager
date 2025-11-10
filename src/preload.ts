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
import {
  ElectronAPI,
  IpcChannels,
  OpenDialogOptions,
  SaveDialogOptions,
  TranslationRequest,
} from './types/electron';

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
