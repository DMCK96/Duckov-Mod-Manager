/**
 * TypeScript declaration for Electron API exposed to renderer via contextBridge
 * This must match the ElectronAPI interface defined in src/preload.ts
 */

interface TranslationRequest {
  text: string;
  sourceLang?: string;
  targetLang: string;
  context?: string;
}

interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
}

interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

interface SaveDialogResult {
  canceled: boolean;
  filePath?: string;
}

interface SymlinkInfo {
  modId: string;
  modTitle?: string;
  sourcePath: string;
  targetPath: string;
  exists: boolean;
}

interface SymlinkOperationResult {
  success: boolean;
  error?: string;
}

interface BackgroundTaskProgress {
  taskId: string;
  taskName: string;
  message: string;
  progress: number; // 0-100
  isComplete: boolean;
}

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
  listActiveSymlinks: () => Promise<SymlinkInfo[]>;
  getAvailableMods: () => Promise<string[]>;
  createSymlink: (modId: string) => Promise<SymlinkOperationResult>;
  removeSymlink: (modId: string) => Promise<SymlinkOperationResult>;
  validateSymlinkPaths: () => Promise<{ valid: boolean; errors: string[] }>;

  // File dialog operations
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogResult>;
  showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;

  // App operations
  getAppInfo: () => Promise<any>;
  getPath: (name: 'home' | 'appData' | 'userData' | 'temp' | 'downloads' | 'documents') => Promise<string>;
  quit: () => void;
  relaunch: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  // Background task operations
  onBackgroundTaskProgress: (callback: (progress: BackgroundTaskProgress) => void) => () => void;
  onBackgroundTaskComplete: (callback: (taskId: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
