/**
 * Electron Main Process
 * Manages application lifecycle and creates browser windows
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
// @ts-ignore - electron-squirrel-startup doesn't have type definitions
import * as squirrelStartup from 'electron-squirrel-startup';
import { logger } from './utils/logger';
import { Database } from './database/Database';
import { ModService } from './services/ModService';
import { OfflineTranslationService } from './services/OfflineTranslationService';
import { LocalModService } from './services/LocalModService';
import { SteamWorkshopService } from './services/SteamWorkshopService';

// Dynamic import for electron-store (ES Module)
// Using eval to prevent TypeScript from converting to require()
let Store: any;
async function getStore() {
  if (!Store) {
    // Use eval to ensure dynamic import stays as import() in compiled code
    const module = await eval('import("electron-store")');
    Store = module.default;
  }
  return Store;
}

// Debug: Check squirrel startup value  
console.log('[INIT] squirrelStartup module value:', squirrelStartup);
console.log('[INIT] typeof squirrelStartup:', typeof squirrelStartup);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
// Only check for squirrel events in packaged apps (not during development)
try {
  const isPackaged = app?.isPackaged ?? false;
  console.log('[INIT] app.isPackaged:', isPackaged);
  console.log('[INIT] Will quit?', isPackaged && squirrelStartup);
  
  if (isPackaged && squirrelStartup) {
    console.log('[INIT] Quitting due to Squirrel event');
    app.quit();
  }
} catch (error) {
  console.error('[INIT] Error during squirrel check:', error);
}

/**
 * Application services - initialized once
 */
let database: Database;
let modService: ModService;
let translationService: OfflineTranslationService;
let localModService: LocalModService;
let steamWorkshopService: SteamWorkshopService;

/**
 * Main application window
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Determine if running in development mode with dev server
 * Use a function to avoid accessing app.isPackaged at module load time
 * Only use dev server if ELECTRON_DEV_SERVER is explicitly set
 */
const isDevelopment = () => {
  // Only use dev server if explicitly enabled via environment variable
  const useDevServer = process.env.ELECTRON_DEV_SERVER === 'true';
  const isPackaged = app.isPackaged;
  const result = useDevServer && !isPackaged;
  logger.info(`isDevelopment: ELECTRON_DEV_SERVER=${useDevServer}, isPackaged=${isPackaged}, result=${result}`);
  return result;
};

/**
 * Create the main browser window
 */
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#1a1a1a',
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Security: Don't expose Node.js to renderer
      contextIsolation: true, // Security: Isolate context
      sandbox: true, // Security: Enable sandbox
      webSecurity: true, // Security: Enable web security
      allowRunningInsecureContent: false, // Security: No insecure content
    },
  });

  // Show window when ready to prevent visual flash
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Load the app
  if (isDevelopment()) {
    // Development: Load from Vite dev server
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3001';
    win.loadURL(devServerUrl).catch((err) => {
      logger.error('Failed to load dev server URL:', err);
      logger.error('Make sure Vite dev server is running on port 3001');
      logger.error('Run: npm run web:dev');
    });

    // Open DevTools in development
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: Load from built files
    // Web files are unpacked from asar to app.asar.unpacked
    const indexPath = path.join(__dirname, '../web/dist/index.html').replace('app.asar', 'app.asar.unpacked');
    
    logger.info(`Loading index.html from: ${indexPath}`);
    
    win.loadFile(indexPath).catch((err) => {
      logger.error('Failed to load production index.html:', err);
      logger.error('Make sure to build the web app first: npm run web:build');
    });
  }

  // Window event handlers
  win.on('closed', () => {
    mainWindow = null;
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error(`Failed to load: ${errorCode} - ${errorDescription}`);
  });

  win.webContents.on('crashed', (_event, killed) => {
    logger.error('Renderer process crashed:', { killed });
    // Optionally reload or show error dialog
  });

  return win;
}

/**
 * Initialize application services
 */
async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing services...');

    // Initialize database
    database = new Database();
    await database.initialize();
    logger.info('Database initialized successfully');

    // Load workshop path from stored settings
    const StoreClass = await getStore();
    const store = new StoreClass();
    const storedWorkshopPath = store.get('workshopPath', '');
    
    logger.info(`Stored workshop path: ${storedWorkshopPath || '(not set)'}`);

    // Initialize services
    translationService = new OfflineTranslationService(database);
    localModService = new LocalModService(storedWorkshopPath as string);
    steamWorkshopService = new SteamWorkshopService();
    modService = new ModService(
      database,
      translationService,
      localModService,
      steamWorkshopService
    );

    logger.info('Services initialized successfully');

    // Only perform initial scan if workshop path is configured
    const workshopPath = (localModService as any).workshopPath;
    if (workshopPath && workshopPath.trim()) {
      try {
        logger.info('Performing initial scan of workshop folder...');
        const result = await modService.scanAndSyncLocalMods();
        logger.info(
          `Initial scan complete: ${result.scanned} mods scanned, ${result.synced.length} synced`
        );
        if (result.errors.length > 0) {
          logger.warn(`Initial scan had ${result.errors.length} errors`);
        }
      } catch (scanError) {
        logger.error('Failed to perform initial workshop scan:', scanError);
        logger.warn(
          'App will continue without initial scan. You can manually trigger a scan via the UI.'
        );
      }
    } else {
      logger.warn('Workshop path not configured. Skipping initial scan. Please configure workshop path in settings.');
    }
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Register IPC handlers for communication with renderer process
 * All handlers use IPC channels defined in types/electron.ts
 */
function registerIpcHandlers(): void {
  logger.info('Registering IPC handlers...');

  // ==========================================
  // Mod Operations
  // ==========================================

  /**
   * Scan local workshop folder and sync mods
   * Returns scan results including synced mods and errors
   */
  ipcMain.handle('mods:scan', async () => {
    try {
      logger.info('[IPC] mods:scan - Starting local mod scan...');
      const result = await modService.scanAndSyncLocalMods();

      logger.info(`[IPC] mods:scan - Scan complete: ${result.scanned} scanned, ${result.synced.length} synced`);

      return {
        success: true,
        data: {
          scanned: result.scanned,
          synced: result.synced.length,
          errors: result.errors.length,
          mods: result.synced,
          errorMessages: result.errors
        }
      };
    } catch (error) {
      logger.error('[IPC] mods:scan - Error:', error);
      throw error;
    }
  });

  /**
   * Get all mods with optional pagination
   */
  ipcMain.handle('mods:get-all', async (_, args: { limit?: number; offset?: number }) => {
    try {
      const { limit = 1000, offset = 0 } = args || {};
      logger.debug(`[IPC] mods:getAll - Fetching mods (limit: ${limit}, offset: ${offset})`);

      const mods = await modService.getAllMods(limit, offset);

      return {
        success: true,
        data: mods,
        pagination: {
          limit,
          offset,
          count: mods.length
        }
      };
    } catch (error) {
      logger.error('[IPC] mods:getAll - Error:', error);
      throw error;
    }
  });

  /**
   * Get specific mod by ID
   */
  /**
   * Get mod by ID
   */
  ipcMain.handle('mods:get-by-id', async (_, args: { id: string }) => {
    try {
      const { id } = args;
      logger.debug(`[IPC] mods:getById - Fetching mod ${id}`);

      const mod = await modService.getMod(id, true);

      if (!mod) {
        return {
          success: false,
          error: 'Mod not found'
        };
      }

      return {
        success: true,
        data: mod
      };
    } catch (error) {
      logger.error('[IPC] mods:getById - Error:', error);
      throw error;
    }
  });

  /**
   * Search mods by query
   */
  ipcMain.handle('mods:search', async (_, args: { query: string }) => {
    try {
      const { query } = args;
      logger.debug(`[IPC] mods:search - Searching for: ${query}`);

      if (!query || typeof query !== 'string') {
        return {
          success: false,
          error: 'Search query is required'
        };
      }

      const mods = await modService.searchMods(query, 1000);

      return {
        success: true,
        data: mods,
        query,
        count: mods.length
      };
    } catch (error) {
      logger.error('[IPC] mods:search - Error:', error);
      throw error;
    }
  });

  /**
   * Sync specific mods from workshop (not used in current offline implementation)
   * Kept for potential future use
   */
  ipcMain.handle('mods:sync', async (_) => {
    try {
      logger.info('[IPC] mods:sync - Manual sync requested (using scanAndSyncLocalMods)');

      // In offline mode, we just rescan the local folder
      const result = await modService.scanAndSyncLocalMods();

      return {
        success: true,
        data: {
          synced: result.synced.length,
          errors: result.errors.length,
          mods: result.synced,
          errorMessages: result.errors
        }
      };
    } catch (error) {
      logger.error('[IPC] mods:sync - Error:', error);
      throw error;
    }
  });

  /**
   * Export selected mods as zip file
   * Opens save dialog and creates zip archive of mod folders
   */
  ipcMain.handle('mods:export', async (_, args: { filePath: string; modIds: string[] }) => {
    try {
      const { filePath, modIds } = args;

      if (!Array.isArray(modIds) || modIds.length === 0) {
        return {
          success: false,
          error: 'modIds array is required and must not be empty'
        };
      }

      logger.info(`[IPC] mods:export - Exporting ${modIds.length} mods to ${filePath}`);

      const result = await modService.exportMods(modIds, filePath);

      return {
        success: true,
        filePath: result.zipPath,
        exportedCount: result.exportedCount,
        missingMods: result.missingMods
      };
    } catch (error) {
      logger.error('[IPC] mods:export - Error:', error);
      throw error;
    }
  });

  /**
   * Get mod statistics overview
   */
  ipcMain.handle('mods:stats', async () => {
    try {
      logger.debug('[IPC] mods:stats - Fetching mod statistics');

      const stats = await modService.getModStatistics();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('[IPC] mods:stats - Error:', error);
      throw error;
    }
  });

  // ==========================================
  // Translation Operations
  // ==========================================

  /**
   * Translate text using offline translation service
   */
  ipcMain.handle('translation:translate', async (_, request: { text: string; targetLang: string; sourceLang?: string }) => {
    try {
      const { text, targetLang } = request;
      logger.debug(`[IPC] translation:translate - Translating text (${text.length} chars)`);

      if (!text || !text.trim()) {
        return {
          success: false,
          error: 'Text is required'
        };
      }

      const translatedText = await translationService.translate(text);

      return {
        success: true,
        data: {
          translatedText,
          originalText: text,
          detectedLanguage: 'zh',
          targetLanguage: targetLang
        }
      };
    } catch (error) {
      logger.error('[IPC] translation:translate - Error:', error);
      throw error;
    }
  });

  /**
   * Get translation cache statistics
   */
  ipcMain.handle('translation:stats', async () => {
    try {
      logger.debug('[IPC] translation:stats - Fetching cache stats');

      const stats = await translationService.getCacheStats();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('[IPC] translation:stats - Error:', error);
      throw error;
    }
  });

  /**
   * Clear translation cache
   */
  ipcMain.handle('translation:clear-cache', async () => {
    try {
      logger.info('[IPC] translation:clearCache - Clearing translation cache');

      await translationService.clearCache();

      return {
        success: true,
        message: 'Translation cache cleared successfully'
      };
    } catch (error) {
      logger.error('[IPC] translation:clearCache - Error:', error);
      throw error;
    }
  });

  // ==========================================
  // File Dialog Operations
  // ==========================================

  /**
   * Show open file/folder dialog
   */
  ipcMain.handle('dialog:open', async (_, options: any) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(mainWindow!, options);

      return {
        canceled: result.canceled,
        filePaths: result.filePaths || []
      };
    } catch (error) {
      logger.error('[IPC] dialog:open - Error:', error);
      throw error;
    }
  });

  /**
   * Show save file dialog
   */
  ipcMain.handle('dialog:save', async (_, options: any) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog(mainWindow!, options);

      return {
        canceled: result.canceled,
        filePath: result.filePath
      };
    } catch (error) {
      logger.error('[IPC] dialog:save - Error:', error);
      throw error;
    }
  });

  // ==========================================
  // Settings Operations
  // ==========================================

  /**
   * Get workshop path setting
   */
  ipcMain.handle('settings:get-workshop-path', async () => {
    try {
      logger.debug('[IPC] settings:getWorkshopPath - Fetching workshop path');
      
      const workshopPath = localModService ? (localModService as any).workshopPath : '';
      
      return {
        success: true,
        data: workshopPath || ''
      };
    } catch (error) {
      logger.error('[IPC] settings:getWorkshopPath - Error:', error);
      throw error;
    }
  });

  /**
   * Set workshop path setting
   */
  ipcMain.handle('settings:set-workshop-path', async (_, args: { path: string }) => {
    try {
      const { path: workshopPath } = args;
      logger.info(`[IPC] settings:setWorkshopPath - Setting workshop path to: ${workshopPath}`);
      
      if (!localModService) {
        throw new Error('Local mod service not initialized');
      }
      
      // Update the workshop path
      localModService.setWorkshopPath(workshopPath);
      
      // Store in user preferences for persistence
      const StoreClass = await getStore();
      const store = new StoreClass();
      store.set('workshopPath', workshopPath);
      
      return {
        success: true,
        message: 'Workshop path updated successfully'
      };
    } catch (error) {
      logger.error('[IPC] settings:setWorkshopPath - Error:', error);
      throw error;
    }
  });

  /**
   * Check if workshop path is configured
   */
  ipcMain.handle('settings:is-workshop-configured', async () => {
    try {
      const workshopPath = localModService ? (localModService as any).workshopPath : '';
      const isConfigured = Boolean(workshopPath && workshopPath.trim());
      
      logger.debug(`[IPC] settings:isWorkshopConfigured - ${isConfigured}`);
      
      return {
        success: true,
        data: isConfigured
      };
    } catch (error) {
      logger.error('[IPC] settings:isWorkshopConfigured - Error:', error);
      throw error;
    }
  });

  // ==========================================
  // App Operations
  // ==========================================

  /**
   * Get app information
   */
  ipcMain.handle('app:get-info', async () => {
    try {
      return {
        success: true,
        data: {
          name: app.getName(),
          version: app.getVersion(),
          platform: process.platform,
          arch: process.arch
        }
      };
    } catch (error) {
      logger.error('[IPC] app:getInfo - Error:', error);
      throw error;
    }
  });

  /**
   * Get system path
   */
  ipcMain.handle('app:get-path', async (_, args: { name: string }) => {
    try {
      const { name } = args;
      const validNames = ['home', 'appData', 'userData', 'temp', 'downloads', 'documents'];

      if (!validNames.includes(name)) {
        throw new Error(`Invalid path name: ${name}`);
      }

      return {
        success: true,
        data: app.getPath(name as any)
      };
    } catch (error) {
      logger.error('[IPC] app:getPath - Error:', error);
      throw error;
    }
  });

  /**
   * Window control operations
   */
  ipcMain.on('app:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('app:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('app:close', () => {
    mainWindow?.close();
  });

  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.on('app:relaunch', () => {
    app.relaunch();
    app.quit();
  });

  logger.info('IPC handlers registered successfully');
}

/**
 * Application ready event handler
 */
app.whenReady().then(async () => {
  try {
    console.log('[STARTUP] App ready event fired');
    logger.info('App ready, initializing...');
    logger.info(`Running in ${isDevelopment() ? 'development' : 'production'} mode`);
    logger.info(`Platform: ${process.platform}, Architecture: ${process.arch}`);

    console.log('[STARTUP] About to initialize services');
    // Initialize services
    await initializeServices();

    console.log('[STARTUP] Services initialized, registering IPC handlers');
    // Register IPC handlers
    registerIpcHandlers();

    console.log('[STARTUP] Creating main window');
    // Create main window
    mainWindow = createMainWindow();

    console.log('[STARTUP] Application started successfully');
    logger.info('Application started successfully');
  } catch (error) {
    console.error('[STARTUP ERROR]', error);
    logger.error('Failed to start application:', error);
    app.quit();
  }
}).catch(error => {
  console.error('[STARTUP PROMISE REJECTED]', error);
  app.quit();
});

/**
 * Activate event (macOS specific)
 * On macOS, re-create window when dock icon is clicked and no windows are open
 */
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

/**
 * Window all closed event
 * On macOS, apps typically stay open until explicitly quit
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Before quit event
 * Perform cleanup before app quits
 */
app.on('before-quit', async (event) => {
  logger.info('App is quitting, cleaning up...');

  // Prevent quit until cleanup is done
  event.preventDefault();

  try {
    // Close database connection
    if (database) {
      await database.close();
      logger.info('Database closed successfully');
    }
  } catch (error) {
    logger.error('Error during cleanup:', error);
  } finally {
    // Allow quit to proceed
    app.exit(0);
  }
});

/**
 * Handle uncaught errors
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // Don't crash the app, but log the error
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', { reason, promise });
});

/**
 * Export services for IPC handlers (will be used in next phase)
 */
export function getServices() {
  if (!modService || !translationService || !localModService) {
    throw new Error('Services not initialized');
  }
  return {
    modService,
    translationService,
    localModService,
    database,
  };
}

/**
 * Export main window reference
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
