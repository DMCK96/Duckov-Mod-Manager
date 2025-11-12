/**
 * Electron IPC Type Definitions
 * Defines the contract between main and renderer processes
 */

import type { ModInfo, TranslationRequest, TranslationResponse } from './index';

/**
 * Mod-related operation results
 */
export interface ScanResult {
  scanned: number;
  synced: string[];
  errors: string[];
}

export interface ModListResult {
  mods: ModInfo[];
  total: number;
}

export interface ModDetailsResult {
  mod: ModInfo;
}

/**
 * File dialog options and results
 */
export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

export interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

/**
 * App information and control
 */
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
}

/**
 * IPC Channel names - centralized for type safety
 */
export const IpcChannels = {
  // Mod operations
  MODS_SCAN: 'mods:scan',
  MODS_GET_ALL: 'mods:getAll',
  MODS_GET_BY_ID: 'mods:getById',
  MODS_SEARCH: 'mods:search',
  MODS_SYNC: 'mods:sync',
  MODS_EXPORT: 'mods:export',

  // Translation operations
  TRANSLATION_TRANSLATE: 'translation:translate',
  TRANSLATION_GET_CACHED: 'translation:getCached',
  TRANSLATION_CLEAR_CACHE: 'translation:clearCache',

  // File operations
  DIALOG_OPEN: 'dialog:open',
  DIALOG_SAVE: 'dialog:save',

  // App operations
  APP_GET_INFO: 'app:getInfo',
  APP_GET_PATH: 'app:getPath',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',
} as const;

/**
 * Type for IPC channel keys
 */
export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

/**
 * IPC Handler function type
 * Generic type for type-safe IPC handlers
 */
export type IpcHandler<TArgs = unknown, TReturn = unknown> = (
  args: TArgs
) => Promise<TReturn> | TReturn;

/**
 * Window API exposed to renderer process via preload script
 */
export interface ElectronAPI {
  // Mod operations
  scanMods: () => Promise<ScanResult>;
  getAllMods: (limit?: number, offset?: number) => Promise<ModListResult>;
  getModById: (id: string) => Promise<ModDetailsResult>;
  searchMods: (query: string) => Promise<ModListResult>;
  syncMods: () => Promise<ScanResult>;
  exportMods: (filePath: string, modIds: string[]) => Promise<{ success: boolean; filePath: string }>;

  // Translation operations
  translate: (request: TranslationRequest) => Promise<TranslationResponse>;
  getCachedTranslation: (text: string, sourceLang: string, targetLang: string) => Promise<TranslationResponse | null>;
  clearTranslationCache: () => Promise<{ success: boolean }>;

  // File operations
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogResult>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;

  // App operations
  getAppInfo: () => Promise<AppInfo>;
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'downloads' | 'documents') => Promise<string>;
  quit: () => void;
  relaunch: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
}

/**
 * Augment the Window interface to include our Electron API
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
