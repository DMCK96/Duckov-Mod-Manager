"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localModService = exports.steamService = exports.translationService = exports.modService = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const Database_1 = require("./database/Database");
const ModService_1 = require("./services/ModService");
const TranslationService_1 = require("./services/TranslationService");
const SteamWorkshopService_1 = require("./services/SteamWorkshopService");
const LocalModService_1 = require("./services/LocalModService");
const mods_1 = __importDefault(require("./routes/mods"));
const translation_1 = __importDefault(require("./routes/translation"));
const health_1 = __importDefault(require("./routes/health"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3000;
const database = new Database_1.Database();
const steamService = new SteamWorkshopService_1.SteamWorkshopService();
exports.steamService = steamService;
const translationService = new TranslationService_1.TranslationService();
exports.translationService = translationService;
const localModService = new LocalModService_1.LocalModService();
exports.localModService = localModService;
const modService = new ModService_1.ModService(database, steamService, translationService, localModService);
exports.modService = modService;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(rateLimiter_1.rateLimiterMiddleware);
app.use(express_1.default.static(path_1.default.join(__dirname, '../web/dist')));
app.use('/api/mods', mods_1.default);
app.use('/api/translation', translation_1.default);
app.use('/api/health', health_1.default);
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../web/dist/index.html'));
});
app.use(errorHandler_1.errorHandler);
async function startServer() {
    try {
        await database.initialize();
        logger_1.logger.info('Database initialized successfully');
        app.listen(PORT, () => {
            logger_1.logger.info(`Duckov Mod Manager server running on port ${PORT}`);
            logger_1.logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGINT', async () => {
    logger_1.logger.info('Shutting down gracefully...');
    await database.close();
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map