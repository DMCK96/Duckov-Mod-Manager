# Duckov Mod Manager - Electron Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                      Electron Application                          │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Renderer Process                         │  │
│  │                 (Chromium + React App)                      │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                  React Components                    │  │  │
│  │  │                                                      │  │  │
│  │  │  • ModList                                          │  │  │
│  │  │  • ModDetails                                       │  │  │
│  │  │  • TranslationPanel                                 │  │  │
│  │  │  • Settings                                         │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                           │                                 │  │
│  │                           ▼                                 │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │           window.electronAPI (Context Bridge)        │  │  │
│  │  │                                                      │  │  │
│  │  │  • scanMods()                                       │  │  │
│  │  │  • getAllMods()                                     │  │  │
│  │  │  • translate()                                      │  │  │
│  │  │  • showOpenDialog()                                 │  │  │
│  │  │  • ... (20+ methods)                                │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                             │                                      │
│                             │ IPC (Inter-Process Communication)    │
│                             │ (Secure, Type-Safe)                  │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 Preload Script (preload.ts)                 │  │
│  │                    Security Bridge Layer                     │  │
│  │                                                             │  │
│  │  • Validates all IPC channels against whitelist            │  │
│  │  • Validates all input parameters                          │  │
│  │  • Exposes safe API via contextBridge                      │  │
│  │  • NO direct Node.js access                                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                             │                                      │
│                             │ Validated IPC Messages               │
│                             ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                  Main Process (main.ts)                     │  │
│  │                   Node.js + Electron                        │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │              IPC Handler Layer (Phase 2)             │  │  │
│  │  │                                                      │  │  │
│  │  │  ipcMain.handle('mods:scan', ...)                   │  │  │
│  │  │  ipcMain.handle('mods:getAll', ...)                 │  │  │
│  │  │  ipcMain.handle('translation:translate', ...)       │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                           │                                 │  │
│  │                           ▼                                 │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                 Service Layer                        │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌────────────────┐  ┌────────────────────────────┐ │  │  │
│  │  │  │  ModService    │  │  TranslationService        │ │  │  │
│  │  │  └────────────────┘  └────────────────────────────┘ │  │  │
│  │  │  ┌────────────────────────────┐  ┌───────────────┐ │  │  │
│  │  │  │  SteamWorkshopService      │  │ LocalModSvc   │ │  │  │
│  │  │  └────────────────────────────┘  └───────────────┘ │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                           │                                 │  │
│  │                           ▼                                 │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │                 Data Layer                           │  │  │
│  │  │                                                      │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │  │  │
│  │  │  │   Database   │  │  File System │  │   Cache   │ │  │  │
│  │  │  │   (SQLite)   │  │  (Workshop)  │  │  (Memory) │ │  │  │
│  │  │  └──────────────┘  └──────────────┘  └───────────┘ │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Process Isolation & Security

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Boundaries                        │
└─────────────────────────────────────────────────────────────────┘

  Renderer Process                Main Process
  (Sandboxed)                    (Privileged)
  ┌──────────────────┐           ┌──────────────────┐
  │                  │           │                  │
  │  • No Node.js    │           │  • Full Node.js  │
  │  • No File I/O   │           │  • File System   │
  │  • No Network    │ ◄────────►│  • Database      │
  │  • Isolated      │    IPC    │  • Network       │
  │                  │  (Bridge) │  • OS APIs       │
  └──────────────────┘           └──────────────────┘
         ▲                               ▲
         │                               │
         └───── Preload Script ──────────┘
              (Trust Boundary)

  Security Settings:
  ✓ nodeIntegration: false
  ✓ contextIsolation: true
  ✓ sandbox: true
  ✓ webSecurity: true
  ✓ allowRunningInsecureContent: false
```

## Data Flow Examples

### Example 1: Scanning Mods

```
┌─────────┐     ┌──────────┐     ┌──────┐     ┌───────────┐     ┌──────────┐
│ React   │────►│ Preload  │────►│ IPC  │────►│ Handler   │────►│ Service  │
│ Button  │     │ Validate │     │      │     │           │     │          │
└─────────┘     └──────────┘     └──────┘     └───────────┘     └──────────┘
    │                                                                  │
    │ onClick={() =>                                                   │
    │   window.electronAPI.scanMods()                                  │
    │                                                                  │
    │                                              modService.         │
    │                                              scanAndSyncLocalMods()
    │                                                                  │
    │                                                                  ▼
    │                                                          ┌──────────────┐
    │                                                          │ File System  │
    │                                                          │ + Database   │
    │                                                          └──────────────┘
    │                                                                  │
    │◄─────────────────────────────────────────────────────────────────┘
    │ { scanned: 150, synced: [...], errors: [] }
    │
    ▼
┌─────────┐
│ Update  │
│ UI      │
└─────────┘
```

### Example 2: Translating Mod Description

```
React Component
      │
      │ window.electronAPI.translate({
      │   text: "Russian text",
      │   targetLang: "en"
      │ })
      ▼
Preload Script
      │
      │ Validates:
      │ - text is non-empty string ✓
      │ - targetLang is valid ✓
      │ - channel is whitelisted ✓
      ▼
IPC Channel: 'translation:translate'
      │
      ▼
IPC Handler (main.ts)
      │
      │ const { translationService } = getServices();
      │ return await translationService.translate(request);
      ▼
TranslationService
      │
      ├─► Check cache first
      │   └─► Return if found
      │
      ├─► Call DeepL API
      │   └─► Store in cache
      │
      └─► Return translation
          │
          ▼
    { translatedText: "English text",
      detectedLanguage: "ru",
      confidence: 0.95 }
          │
          ▼
React Component
      │
      └─► Update UI with translation
```

## File Structure

```
E:\Repositories\Duckov-Mod-Manager\
│
├── 📁 src/                               # Backend/Electron code
│   ├── ⚡ main.ts                        # Main process entry point
│   ├── 🔒 preload.ts                     # Security bridge
│   │
│   ├── 📁 types/
│   │   ├── electron.ts                   # IPC types & channels
│   │   └── index.ts                      # Shared types
│   │
│   ├── 📁 services/                      # Business logic
│   │   ├── ModService.ts                 # Mod operations
│   │   ├── TranslationService.ts         # Translation
│   │   ├── SteamWorkshopService.ts       # Steam API
│   │   └── LocalModService.ts            # Local file ops
│   │
│   ├── 📁 database/
│   │   └── Database.ts                   # SQLite wrapper
│   │
│   └── 📁 utils/
│       └── logger.ts                     # Logging utility
│
├── 📁 web/                               # Frontend React code
│   ├── 📁 src/
│   │   ├── App.tsx                       # React app
│   │   ├── components/                   # React components
│   │   └── ...
│   ├── 📁 dist/                          # Built React app
│   └── index.html
│
├── 📁 dist/                              # Compiled TypeScript
│   ├── main.js                           # ⚡ Compiled from src/main.ts
│   ├── preload.js                        # 🔒 Compiled from src/preload.ts
│   ├── services/                         # Compiled services
│   └── ...
│
├── 📁 scripts/
│   └── verify-setup.js                   # Setup verification
│
├── 📁 data/                              # Runtime data
│   └── mods.db                           # SQLite database
│
├── 📁 release/                           # Built packages
│   ├── Duckov-Mod-Manager-1.0.0-x64.exe  # Windows installer
│   ├── Duckov-Mod-Manager-1.0.0.dmg      # macOS disk image
│   └── ...
│
├── ⚙️ package.json                       # Dependencies & scripts
├── ⚙️ tsconfig.json                      # TypeScript (shared)
├── ⚙️ tsconfig.electron.json             # TypeScript (Electron)
├── ⚙️ electron-builder.json              # Build config
├── ⚙️ vite.config.ts                     # Vite config
├── 🌍 .env                               # Environment vars
│
└── 📚 Documentation
    ├── ELECTRON_SETUP.md                 # Technical docs
    ├── DEVELOPMENT.md                    # Developer guide
    ├── ARCHITECTURE.md                   # This file
    └── IMPLEMENTATION_SUMMARY.md         # Summary
```

## IPC Communication Flow

### Whitelisted Channels

```typescript
// src/types/electron.ts

export const IpcChannels = {
  // Mod Operations
  MODS_SCAN: 'mods:scan',
  MODS_GET_ALL: 'mods:getAll',
  MODS_GET_BY_ID: 'mods:getById',
  MODS_SEARCH: 'mods:search',
  MODS_SYNC: 'mods:sync',
  MODS_EXPORT: 'mods:export',

  // Translation
  TRANSLATION_TRANSLATE: 'translation:translate',
  TRANSLATION_GET_CACHED: 'translation:getCached',
  TRANSLATION_CLEAR_CACHE: 'translation:clearCache',

  // Dialogs
  DIALOG_OPEN: 'dialog:open',
  DIALOG_SAVE: 'dialog:save',

  // App Control
  APP_GET_INFO: 'app:getInfo',
  APP_GET_PATH: 'app:getPath',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',
} as const;
```

### Channel Validation

```
Request from Renderer
         │
         ▼
   ┌──────────────────┐
   │ Preload Script   │
   └──────────────────┘
         │
         ├─► Is channel in whitelist? ──No──► ❌ Throw Error
         │                               │
         │◄──────────────────────────────┘
         │
         ├─► Are parameters valid? ──No──► ❌ Throw Error
         │                            │
         │◄───────────────────────────┘
         │
         └─► Forward to Main Process ───► ✅ Success
```

## Type Safety

### Renderer Side

```typescript
// Full type inference in React components

// TypeScript knows the return type is Promise<ScanResult>
const result = await window.electronAPI.scanMods();
//    ^? const result: ScanResult

// TypeScript validates arguments
await window.electronAPI.getModById(123);
//                                  ^^^
// Error: Argument of type 'number' is not assignable to parameter of type 'string'

// Autocomplete works
window.electronAPI.
//                 ^? scanMods, getAllMods, getModById, translate, ...
```

### Main Process Side

```typescript
// IPC handlers are type-safe

ipcMain.handle(IpcChannels.MODS_GET_ALL, async (event, { limit, offset }) => {
  // limit and offset are typed
  const result = await modService.getAllMods(limit, offset);
  // Return type must match ModListResult
  return result;
});
```

## Development vs Production

```
┌─────────────────────────────────────────────────────────────┐
│                      Development Mode                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Terminal 1: Vite Dev Server (http://localhost:3001)       │
│              ┌─────────────┐                                │
│              │ React App   │ Hot Module Replacement         │
│              └─────────────┘ Changes reflect immediately    │
│                                                             │
│  Terminal 2: TypeScript Watch                              │
│              ┌─────────────┐                                │
│              │ main.ts     │ Auto-rebuild on save           │
│              │ preload.ts  │ Requires Electron restart      │
│              └─────────────┘                                │
│                                                             │
│  Terminal 3: Electron                                       │
│              ┌─────────────┐                                │
│              │ App Window  │ Restart manually when needed   │
│              │ + DevTools  │ DevTools open automatically    │
│              └─────────────┘                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Production Mode                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Build Process:                                             │
│    1. web:build   → web/dist/ (optimized React)            │
│    2. build:electron → dist/ (compiled main process)        │
│    3. electron-builder → release/ (packaged app)            │
│                                                             │
│  Single Executable:                                         │
│    ┌─────────────────────────────────────┐                 │
│    │  Duckov-Mod-Manager.exe             │                 │
│    │                                     │                 │
│    │  • All code bundled                │                 │
│    │  • No dev dependencies              │                 │
│    │  • No DevTools                      │                 │
│    │  • Optimized & minified             │                 │
│    └─────────────────────────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

```
Development Environment
         │
         ├─► npm run build
         │   ├─► Build React app (Vite)
         │   └─► Compile TypeScript (tsc)
         │
         ▼
   Built Artifacts
   (dist/ + web/dist/)
         │
         ├─► npm run dist
         │   └─► electron-builder
         │
         ▼
┌─────────────────────────────────────┐
│      Platform Distributables        │
├─────────────────────────────────────┤
│                                     │
│  Windows:                           │
│    • NSIS Installer (.exe)          │
│    • Portable App (.exe)            │
│                                     │
│  macOS:                             │
│    • DMG Disk Image (.dmg)          │
│    • ZIP Archive (.zip)             │
│                                     │
│  Linux:                             │
│    • AppImage (.AppImage)           │
│    • Debian Package (.deb)          │
│    • RPM Package (.rpm)             │
│                                     │
└─────────────────────────────────────┘
         │
         └─► Distribute to Users
```

## Performance Characteristics

### IPC Performance
- **Synchronous IPC**: ~0.1-1 ms
- **Asynchronous IPC**: ~1-5 ms
- **Large Data Transfer**: ~10-50 ms (depends on size)

**Recommendation**: Prefer async IPC for all operations

### Memory Usage
- **Base Electron App**: ~50-100 MB
- **React App**: ~20-50 MB
- **Total Typical**: ~100-200 MB
- **Per Mod in Memory**: ~1-5 KB

### Startup Time
- **Cold Start**: ~2-5 seconds
- **Warm Start**: ~1-2 seconds
- **Initial Mod Scan**: Depends on mod count (~10-30s for 1000 mods)

## Summary

This Electron architecture provides:

✅ **Security** - Multi-layer security with process isolation
✅ **Type Safety** - Full TypeScript support end-to-end
✅ **Performance** - Fast IPC, efficient data transfer
✅ **Maintainability** - Clear separation of concerns
✅ **Scalability** - Service-based architecture
✅ **Developer Experience** - Hot reload, DevTools, debugging
✅ **Cross-Platform** - Windows, macOS, Linux support
✅ **Offline-First** - No server required

**Next Steps**: See IMPLEMENTATION_SUMMARY.md for Phase 2 (IPC handlers)
