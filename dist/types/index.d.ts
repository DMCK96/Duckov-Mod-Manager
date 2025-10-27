export interface SteamWorkshopItem {
    publishedfileid: string;
    result: number;
    creator: string;
    creator_app_id: number;
    consumer_app_id: number;
    filename: string;
    file_size: number;
    file_url: string;
    hcontent_file: string;
    preview_url: string;
    hcontent_preview: string;
    title: string;
    description: string;
    time_created: number;
    time_updated: number;
    visibility: number;
    banned: number;
    ban_reason: string;
    subscriptions: number;
    favorited: number;
    lifetime_subscriptions: number;
    lifetime_favorited: number;
    views: number;
    tags: Array<{
        tag: string;
    }>;
}
export interface SteamWorkshopResponse {
    response: {
        result: number;
        resultcount: number;
        publishedfiledetails: SteamWorkshopItem[];
    };
}
export interface ModInfo {
    id: string;
    title: string;
    description: string;
    originalTitle?: string;
    originalDescription?: string;
    translatedTitle?: string;
    translatedDescription?: string;
    creator: string;
    previewUrl: string;
    fileSize: number;
    subscriptions: number;
    rating: number;
    tags: string[];
    timeCreated: Date;
    timeUpdated: Date;
    lastTranslated?: Date;
    language?: string;
}
export interface TranslationRequest {
    text: string;
    sourceLang?: string;
    targetLang: string;
}
export interface TranslationResponse {
    translatedText: string;
    detectedLanguage?: string;
    confidence?: number;
}
export interface CachedTranslation {
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    createdAt: Date;
    expiresAt: Date;
}
//# sourceMappingURL=index.d.ts.map