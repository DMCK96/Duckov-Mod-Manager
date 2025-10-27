import { ModService } from './services/ModService';
import { TranslationService } from './services/TranslationService';
import { SteamWorkshopService } from './services/SteamWorkshopService';
import { LocalModService } from './services/LocalModService';
declare const app: import("express-serve-static-core").Express;
declare const steamService: SteamWorkshopService;
declare const translationService: TranslationService;
declare const localModService: LocalModService;
declare const modService: ModService;
export { app, modService, translationService, steamService, localModService };
//# sourceMappingURL=index.d.ts.map