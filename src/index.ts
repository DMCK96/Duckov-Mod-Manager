import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { rateLimiterMiddleware } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { Database } from './database/Database';
import { ModService } from './services/ModService';
import { TranslationService } from './services/TranslationService';
import { SteamWorkshopService } from './services/SteamWorkshopService';
import { LocalModService } from './services/LocalModService';

// Routes
import modsRouter from './routes/mods';
import translationRouter from './routes/translation';
import healthRouter from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const database = new Database();
const steamService = new SteamWorkshopService();
const translationService = new TranslationService();
const localModService = new LocalModService();
const modService = new ModService(database, steamService, translationService, localModService);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiterMiddleware);

// Serve static files from web build
app.use(express.static(path.join(__dirname, '../web/dist')));

// API Routes
app.use('/api/mods', modsRouter);
app.use('/api/translation', translationRouter);
app.use('/api/health', healthRouter);

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/dist/index.html'));
});

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await database.initialize();
    logger.info('Database initialized successfully');
    
    // Perform initial scan of local workshop folder
    try {
      logger.info('Performing initial scan of workshop folder...');
      const result = await modService.scanAndSyncLocalMods();
      logger.info(`Initial scan complete: ${result.scanned} mods scanned, ${result.synced.length} synced`);
      if (result.errors.length > 0) {
        logger.warn(`Initial scan had ${result.errors.length} errors`);
      }
    } catch (scanError) {
      logger.error('Failed to perform initial workshop scan:', scanError);
      logger.warn('Server will continue without initial scan. You can manually trigger a scan via the API.');
    }
    
    app.listen(PORT, () => {
      logger.info(`Duckov Mod Manager server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await database.close();
  process.exit(0);
});

startServer();

export { app, modService, translationService, steamService, localModService };
