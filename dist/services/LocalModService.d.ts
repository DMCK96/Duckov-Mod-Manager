export declare class LocalModService {
    private workshopPath;
    constructor();
    scanLocalMods(): Promise<string[]>;
    getModPath(modId: string): string;
    modExists(modId: string): Promise<boolean>;
    getModFolderInfo(modId: string): Promise<{
        modId: string;
        path: string;
        exists: boolean;
        fileCount?: number;
        totalSize?: number;
        lastModified?: Date;
    }>;
    private calculateFolderStats;
    setWorkshopPath(path: string): void;
    getWorkshopPath(): string;
    validateConfiguration(): Promise<{
        valid: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=LocalModService.d.ts.map