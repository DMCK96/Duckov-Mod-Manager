/**
 * Electron Main Process
 * Manages application lifecycle and creates browser windows
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as squirrelStartup from 'electron-squirrel-startup';
import { logger } from './utils/logger';
import { Database } from './database/Database';
import { ModService } from './services/ModService';
import { TranslationService } from './services/TranslationService';
import { SteamWorkshopService } from './services/SteamWorkshopService';
import { LocalModService } from './services/LocalModService';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (squirrelStartup) {
  app.quit();
}

/**
 * Application services - initialized once
 */
let database: Database;
let modService: ModService;
let translationService: TranslationService;
let steamService: SteamWorkshopService;
let localModService: LocalModService;

/**
 * Main application window
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Determine if running in development mode
 */
const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
  if (isDevelopment) {
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
    const indexPath = path.join(__dirname, '../web/dist/index.html');
    win.loadFile(indexPath).catch((err) => {
      logger.error('Failed to load production index.html:', err);
      logger.error('Make sure to build the web app first: npm run web:build');
    });
  }

  // Window event handlers
  win.on('closed', () => {
    mainWindow = null;
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error(`Failed to load: ${errorCode} - ${errorDescription}`);
  });

  win.webContents.on('crashed', (event, killed) => {
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

    // Initialize services
    steamService = new SteamWorkshopService();
    translationService = new TranslationService();
    localModService = new LocalModService();
    modService = new ModService(
      database,
      steamService,
      translationService,
      localModService
    );

    logger.info('Services initialized successfully');

    // Perform initial scan of local workshop folder
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
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Register IPC handlers
 * Note: Actual handler implementations will be added in the next phase
 */
function registerIpcHandlers(): void {
  logger.info('Registering IPC handlers...');

  // IPC handlers will be implemented in the next phase
  // This is a placeholder to set up the structure

  // Example handler structure (to be implemented):
  // ipcMain.handle('mods:scan', async () => {
  //   return await modService.scanAndSyncLocalMods();
  // });

  logger.info('IPC handlers registered (placeholder)');
}

/**
 * Application ready event handler
 */
app.whenReady().then(async () => {
  try {
    logger.info('App ready, initializing...');
    logger.info(`Running in ${isDevelopment ? 'development' : 'production'} mode`);
    logger.info(`Platform: ${process.platform}, Architecture: ${process.arch}`);

    // Initialize services
    await initializeServices();

    // Register IPC handlers
    registerIpcHandlers();

    // Create main window
    mainWindow = createMainWindow();

    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application:', error);
    app.quit();
  }
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
  if (!modService || !translationService || !steamService || !localModService) {
    throw new Error('Services not initialized');
  }
  return {
    modService,
    translationService,
    steamService,
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
