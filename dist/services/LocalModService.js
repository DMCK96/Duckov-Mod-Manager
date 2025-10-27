"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalModService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
class LocalModService {
    constructor() {
        this.workshopPath = process.env.WORKSHOP_DATA_PATH || '';
        if (!this.workshopPath) {
            logger_1.logger.warn('Workshop data path not configured. Please set WORKSHOP_DATA_PATH in environment variables.');
        }
    }
    async scanLocalMods() {
        if (!this.workshopPath) {
            throw new Error('Workshop data path not configured');
        }
        try {
            await fs_1.promises.access(this.workshopPath);
            logger_1.logger.info(`Scanning workshop folder: ${this.workshopPath}`);
            const entries = await fs_1.promises.readdir(this.workshopPath, { withFileTypes: true });
            const modIds = entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)
                .filter(name => /^\d+$/.test(name));
            logger_1.logger.info(`Found ${modIds.length} local mods`);
            return modIds;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Workshop data path does not exist: ${this.workshopPath}`);
            }
            logger_1.logger.error('Failed to scan local mods:', error);
            throw error;
        }
    }
    getModPath(modId) {
        return path_1.default.join(this.workshopPath, modId);
    }
    async modExists(modId) {
        if (!this.workshopPath) {
            return false;
        }
        try {
            const modPath = this.getModPath(modId);
            await fs_1.promises.access(modPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getModFolderInfo(modId) {
        const modPath = this.getModPath(modId);
        try {
            const stats = await fs_1.promises.stat(modPath);
            if (!stats.isDirectory()) {
                return {
                    modId,
                    path: modPath,
                    exists: false
                };
            }
            const { fileCount, totalSize } = await this.calculateFolderStats(modPath);
            return {
                modId,
                path: modPath,
                exists: true,
                fileCount,
                totalSize,
                lastModified: stats.mtime
            };
        }
        catch (error) {
            return {
                modId,
                path: modPath,
                exists: false
            };
        }
    }
    async calculateFolderStats(folderPath) {
        let fileCount = 0;
        let totalSize = 0;
        try {
            const entries = await fs_1.promises.readdir(folderPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path_1.default.join(folderPath, entry.name);
                if (entry.isDirectory()) {
                    const subStats = await this.calculateFolderStats(entryPath);
                    fileCount += subStats.fileCount;
                    totalSize += subStats.totalSize;
                }
                else {
                    fileCount++;
                    const stats = await fs_1.promises.stat(entryPath);
                    totalSize += stats.size;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to calculate stats for ${folderPath}:`, error);
        }
        return { fileCount, totalSize };
    }
    setWorkshopPath(path) {
        this.workshopPath = path;
        logger_1.logger.info(`Workshop data path updated to: ${path}`);
    }
    getWorkshopPath() {
        return this.workshopPath;
    }
    async validateConfiguration() {
        if (!this.workshopPath) {
            return { valid: false, message: 'Workshop data path not configured' };
        }
        try {
            await fs_1.promises.access(this.workshopPath);
            const stats = await fs_1.promises.stat(this.workshopPath);
            if (!stats.isDirectory()) {
                return { valid: false, message: 'Workshop data path is not a directory' };
            }
            return { valid: true, message: 'Workshop data path is valid' };
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return { valid: false, message: `Workshop data path does not exist: ${this.workshopPath}` };
            }
            return { valid: false, message: `Failed to access workshop data path: ${error}` };
        }
    }
}
exports.LocalModService = LocalModService;
//# sourceMappingURL=LocalModService.js.map