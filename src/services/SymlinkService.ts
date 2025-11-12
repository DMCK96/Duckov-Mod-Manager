import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface SymlinkInfo {
  modId: string;
  modTitle?: string;
  sourcePath: string;
  targetPath: string;
  exists: boolean;
}

/**
 * SymlinkService - Manages symbolic links between workshop mods and game mods folder
 * 
 * Creates symlinks from workshop data folder to Duckov_Data\Mods folder
 */
export class SymlinkService {
  private workshopPath: string;
  private duckovGamePath: string;
  private modsPath: string;

  constructor(workshopPath: string, duckovGamePath: string) {
    this.workshopPath = workshopPath;
    this.duckovGamePath = duckovGamePath;
    this.modsPath = path.join(duckovGamePath, 'Duckov_Data', 'Mods');
    
    logger.info(`SymlinkService initialized with workshop: ${workshopPath}, game: ${duckovGamePath}`);
  }

  /**
   * Ensures the Duckov_Data/Mods folder exists
   */
  private async ensureModsFolderExists(): Promise<void> {
    try {
      await fs.access(this.modsPath);
    } catch {
      logger.info(`Creating mods folder: ${this.modsPath}`);
      await fs.mkdir(this.modsPath, { recursive: true });
    }
  }

  /**
   * Creates a symlink for a mod from workshop to game mods folder
   */
  async createSymlink(modId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sourcePath = path.join(this.workshopPath, modId);
      const targetPath = path.join(this.modsPath, modId);

      // Check if source exists
      try {
        await fs.access(sourcePath);
      } catch {
        return { success: false, error: `Source mod folder not found: ${sourcePath}` };
      }

      // Ensure mods folder exists
      await this.ensureModsFolderExists();

      // Check if target already exists
      try {
        const stats = await fs.lstat(targetPath);
        if (stats.isSymbolicLink()) {
          return { success: false, error: 'Symlink already exists for this mod' };
        } else {
          return { success: false, error: 'A folder with this name already exists (not a symlink)' };
        }
      } catch {
        // Target doesn't exist, which is good
      }

      // Create the symlink
      // On Windows, we need 'junction' type for directory symlinks without admin privileges
      await fs.symlink(sourcePath, targetPath, 'junction');
      
      logger.info(`Created symlink for mod ${modId}: ${sourcePath} -> ${targetPath}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to create symlink for mod ${modId}: ${error}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Removes a symlink for a mod
   */
  async removeSymlink(modId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const targetPath = path.join(this.modsPath, modId);

      // Check if target exists and is a symlink
      try {
        const stats = await fs.lstat(targetPath);
        if (!stats.isSymbolicLink()) {
          return { success: false, error: 'Target is not a symlink, refusing to delete' };
        }
      } catch {
        return { success: false, error: 'Symlink does not exist' };
      }

      // Remove the symlink
      await fs.unlink(targetPath);
      
      logger.info(`Removed symlink for mod ${modId}: ${targetPath}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Failed to remove symlink for mod ${modId}: ${error}`;
      logger.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Lists all active symlinks in the mods folder
   */
  async listActiveSymlinks(): Promise<SymlinkInfo[]> {
    const symlinks: SymlinkInfo[] = [];

    try {
      // Check if mods folder exists
      try {
        await fs.access(this.modsPath);
      } catch {
        logger.info('Mods folder does not exist, no active symlinks');
        return symlinks;
      }

      const entries = await fs.readdir(this.modsPath, { withFileTypes: true });

      for (const entry of entries) {
        try {
          const targetPath = path.join(this.modsPath, entry.name);
          const stats = await fs.lstat(targetPath);

          if (stats.isSymbolicLink()) {
            const sourcePath = await fs.readlink(targetPath);
            const sourceExists = await this.pathExists(sourcePath);

            symlinks.push({
              modId: entry.name,
              sourcePath,
              targetPath,
              exists: sourceExists
            });
          }
        } catch (error) {
          logger.warn(`Error checking entry ${entry.name}:`, error);
        }
      }

      logger.info(`Found ${symlinks.length} active symlinks`);
    } catch (error) {
      logger.error('Failed to list symlinks:', error);
    }

    return symlinks;
  }

  /**
   * Gets all available mods from workshop that don't have symlinks
   */
  async getAvailableMods(): Promise<string[]> {
    try {
      const activeSymlinks = await this.listActiveSymlinks();
      const activeModIds = new Set(activeSymlinks.map(s => s.modId));

      // Get all mods from workshop
      const entries = await fs.readdir(this.workshopPath, { withFileTypes: true });
      const allModIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => /^\d+$/.test(name)); // Only numeric folder names

      // Filter out mods that already have symlinks
      const availableMods = allModIds.filter(modId => !activeModIds.has(modId));

      logger.info(`Found ${availableMods.length} available mods (${allModIds.length} total, ${activeSymlinks.length} already symlinked)`);
      return availableMods;
    } catch (error) {
      logger.error('Failed to get available mods:', error);
      return [];
    }
  }

  /**
   * Checks if a symlink exists for a mod
   */
  async symlinkExists(modId: string): Promise<boolean> {
    try {
      const targetPath = path.join(this.modsPath, modId);
      const stats = await fs.lstat(targetPath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Helper to check if a path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates that the paths are configured correctly
   */
  async validatePaths(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.workshopPath) {
      errors.push('Workshop path is not configured');
    }

    if (!this.duckovGamePath) {
      errors.push('Duckov game path is not configured');
    }

    // Check if workshop path exists
    if (this.workshopPath && !(await this.pathExists(this.workshopPath))) {
      errors.push(`Workshop path does not exist: ${this.workshopPath}`);
    }

    // Check if game path exists
    if (this.duckovGamePath && !(await this.pathExists(this.duckovGamePath))) {
      errors.push(`Duckov game path does not exist: ${this.duckovGamePath}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
