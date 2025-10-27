import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class LocalModService {
  private workshopPath: string;

  constructor() {
    this.workshopPath = process.env.WORKSHOP_DATA_PATH || '';
    
    if (!this.workshopPath) {
      logger.warn('Workshop data path not configured. Please set WORKSHOP_DATA_PATH in environment variables.');
    }
  }

  /**
   * Scans the workshop data folder and returns all mod IDs found
   */
  async scanLocalMods(): Promise<string[]> {
    if (!this.workshopPath) {
      throw new Error('Workshop data path not configured');
    }

    try {
      // Check if path exists
      await fs.access(this.workshopPath);
      
      logger.info(`Scanning workshop folder: ${this.workshopPath}`);
      
      const entries = await fs.readdir(this.workshopPath, { withFileTypes: true });
      
      // Filter for directories that have numeric names (mod IDs)
      const modIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => /^\d+$/.test(name)); // Only numeric folder names
      
      logger.info(`Found ${modIds.length} local mods`);
      return modIds;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Workshop data path does not exist: ${this.workshopPath}`);
      }
      logger.error('Failed to scan local mods:', error);
      throw error;
    }
  }

  /**
   * Gets the full path for a specific mod
   */
  getModPath(modId: string): string {
    return path.join(this.workshopPath, modId);
  }

  /**
   * Checks if a mod exists locally
   */
  async modExists(modId: string): Promise<boolean> {
    if (!this.workshopPath) {
      return false;
    }

    try {
      const modPath = this.getModPath(modId);
      await fs.access(modPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets information about a local mod folder (file count, size, etc.)
   */
  async getModFolderInfo(modId: string): Promise<{
    modId: string;
    path: string;
    exists: boolean;
    fileCount?: number;
    totalSize?: number;
    lastModified?: Date;
  }> {
    const modPath = this.getModPath(modId);
    
    try {
      const stats = await fs.stat(modPath);
      
      if (!stats.isDirectory()) {
        return {
          modId,
          path: modPath,
          exists: false
        };
      }

      // Count files recursively
      const { fileCount, totalSize } = await this.calculateFolderStats(modPath);

      return {
        modId,
        path: modPath,
        exists: true,
        fileCount,
        totalSize,
        lastModified: stats.mtime
      };
    } catch (error) {
      return {
        modId,
        path: modPath,
        exists: false
      };
    }
  }

  /**
   * Recursively calculates folder statistics
   */
  private async calculateFolderStats(folderPath: string): Promise<{
    fileCount: number;
    totalSize: number;
  }> {
    let fileCount = 0;
    let totalSize = 0;

    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(folderPath, entry.name);
        
        if (entry.isDirectory()) {
          const subStats = await this.calculateFolderStats(entryPath);
          fileCount += subStats.fileCount;
          totalSize += subStats.totalSize;
        } else {
          fileCount++;
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.error(`Failed to calculate stats for ${folderPath}:`, error);
    }

    return { fileCount, totalSize };
  }

  /**
   * Updates the workshop path configuration
   */
  setWorkshopPath(path: string): void {
    this.workshopPath = path;
    logger.info(`Workshop data path updated to: ${path}`);
  }

  /**
   * Gets the current workshop path
   */
  getWorkshopPath(): string {
    return this.workshopPath;
  }

  /**
   * Validates the workshop path configuration
   */
  async validateConfiguration(): Promise<{ valid: boolean; message: string }> {
    if (!this.workshopPath) {
      return { valid: false, message: 'Workshop data path not configured' };
    }

    try {
      await fs.access(this.workshopPath);
      const stats = await fs.stat(this.workshopPath);
      
      if (!stats.isDirectory()) {
        return { valid: false, message: 'Workshop data path is not a directory' };
      }

      return { valid: true, message: 'Workshop data path is valid' };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { valid: false, message: `Workshop data path does not exist: ${this.workshopPath}` };
      }
      return { valid: false, message: `Failed to access workshop data path: ${error}` };
    }
  }
}
