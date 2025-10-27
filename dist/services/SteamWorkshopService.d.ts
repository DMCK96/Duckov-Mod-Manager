import { SteamWorkshopItem, ModInfo } from '../types';
export declare class SteamWorkshopService {
    private apiKey;
    private appId;
    private baseUrl;
    constructor();
    getPublishedFileDetails(fileIds: string[]): Promise<SteamWorkshopItem[]>;
    getModUpdates(knownMods: ModInfo[]): Promise<string[]>;
    mapWorkshopItemToMod(item: SteamWorkshopItem): ModInfo;
    private calculateRating;
    private detectLanguage;
    validateConfiguration(): Promise<{
        valid: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=SteamWorkshopService.d.ts.map