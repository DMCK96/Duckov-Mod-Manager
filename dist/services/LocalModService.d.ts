/**
 * LocalModService - Manages local mod folder scanning and operations
 *
 * Electron Considerations:
 * - Works entirely with local file system (no HTTP/network dependencies)
 * - Uses Node.js fs APIs which are fully supported in Electron main process
 * - Workshop path should be configured via environment variable or settings
 * - All operations are async and non-blocking
 */
export declare class LocalModService {
    private workshopPath;
    constructor(workshopPath?: string);
    /**
     * Scans the workshop data folder and returns all mod IDs found
     */
    scanLocalMods(): Promise<string[]>;
    /**
     * Gets the full path for a specific mod
     */
    getModPath(modId: string): string;
    /**
     * Checks if a mod exists locally
     */
    modExists(modId: string): Promise<boolean>;
    /**
     * Gets information about a local mod folder (file count, size, etc.)
     */
    getModFolderInfo(modId: string): Promise<{
        modId: string;
        path: string;
        exists: boolean;
        fileCount?: number;
        totalSize?: number;
        lastModified?: Date;
    }>;
    /**
     * Recursively calculates folder statistics
     */
    private calculateFolderStats;
    /**
     * Updates the workshop path configuration
     */
    setWorkshopPath(path: string): void;
    /**
     * Gets the current workshop path
     */
    getWorkshopPath(): string;
    /**
     * Validates the workshop path configuration
     */
    validateConfiguration(): Promise<{
        valid: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=LocalModService.d.ts.map