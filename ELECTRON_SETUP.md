# Electron Setup Documentation

This document describes the Electron setup for the Duckov Mod Manager application, which transitions the app from a Node.js/Express server + React frontend to a unified Electron desktop application.

## Architecture Overview

The application uses a **multi-process architecture**:

1. **Main Process** (`src/main.ts`) - Node.js process that manages application lifecycle and creates windows
2. **Renderer Process** (React app in `web/`) - Chromium-based UI that displays the interface
3. **Preload Script** (`src/preload.ts`) - Secure bridge between main and renderer processes

## File Structure

```
E:\Repositories\Duckov-Mod-Manager\
├── src/
│   ├── main.ts                 # Electron main process entry point
│   ├── preload.ts              # IPC bridge with security controls
│   ├── types/
│   │   ├── electron.ts         # Electron-specific type definitions
│   │   └── index.ts            # Shared type definitions
│   ├── services/               # Business logic services (shared)
│   ├── database/               # Database layer (shared)
│   └── utils/                  # Utilities (shared)
├── web/                        # React frontend
│   └── dist/                   # Built React app (production)
├── dist/                       # Compiled TypeScript output
│   ├── main.js                 # Compiled main process
│   ├── preload.js              # Compiled preload script
│   └── ...                     # Other compiled files
├── release/                    # Electron-builder output
├── tsconfig.json               # TypeScript config for services/utilities
├── tsconfig.electron.json      # TypeScript config for Electron main/preload
├── electron-builder.json       # Electron build configuration
├── vite.config.ts              # Vite config for React app
└── package.json                # NPM scripts and dependencies
```

## Security Model

The application implements Electron security best practices:

### 1. Context Isolation
- **Enabled**: Renderer process cannot access Node.js APIs directly
- **Implementation**: `contextIsolation: true` in `BrowserWindow` webPreferences

### 2. Node Integration Disabled
- **Disabled**: Prevents direct Node.js API access from renderer
- **Implementation**: `nodeIntegration: false` in webPreferences

### 3. Sandbox Mode
- **Enabled**: Renderer process runs in a restricted sandbox
- **Implementation**: `sandbox: true` in webPreferences

### 4. Context Bridge
- **Purpose**: Exposes only whitelisted APIs to renderer
- **Implementation**: `contextBridge.exposeInMainWorld()` in preload script
- **Validation**: All IPC channels are validated against whitelist

### 5. IPC Channel Whitelist
- **Location**: `src/types/electron.ts` - `IpcChannels` constant
- **Validation**: Preload script validates all channels before forwarding

## TypeScript Configuration

### Main Process Configuration (`tsconfig.electron.json`)

Compiles Electron-specific files (main process and preload script):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "electron"],
    "outDir": "./dist"
  },
  "include": [
    "src/main.ts",
    "src/preload.ts",
    "src/types/**/*",
    "src/database/**/*",
    "src/services/**/*",
    "src/utils/**/*"
  ],
  "exclude": [
    "src/routes/**/*",      // Express routes not needed
    "src/middleware/**/*",  // Express middleware not needed
    "src/index.ts"          // Old Express server entry point
  ]
}
```

## NPM Scripts

### Development

```bash
# Start Vite dev server only (for frontend development)
npm run dev
# or
npm run web:dev

# Build Electron main process and run Electron (manual)
npm run electron:dev

# Watch mode for Electron main process (auto-rebuild)
npm run electron:watch
```

**Development Workflow:**
1. Terminal 1: `npm run web:dev` - Starts Vite dev server on port 3001
2. Terminal 2: `npm run electron:watch` - Watches and rebuilds main process
3. Terminal 3: `npm run electron:dev` - Runs Electron (restart when needed)

### Production Build

```bash
# Build everything (web + electron)
npm run build

# Run production build
npm start

# Full build and run
npm run start:full
```

### Distribution

```bash
# Build distributable for all platforms
npm run dist

# Platform-specific builds
npm run dist:win     # Windows
npm run dist:mac     # macOS
npm run dist:linux   # Linux
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Development mode
NODE_ENV=development

# Vite dev server URL (for development)
VITE_DEV_SERVER_URL=http://localhost:3001

# Steam Workshop configuration
STEAM_API_KEY=your_steam_api_key_here
STEAM_APP_ID=1949770

# Workshop folder path
WORKSHOP_DATA_PATH=E:\path\to\workshop\folder

# DeepL Translation API
DEEPL_API_KEY=your_deepl_api_key_here

# Database path
DB_PATH=./data/mods.db
```

## IPC Communication

### Available IPC Channels

All IPC channels are defined in `src/types/electron.ts`:

#### Mod Operations
- `mods:scan` - Scan and sync local mods
- `mods:getAll` - Get all mods with pagination
- `mods:getById` - Get mod details by ID
- `mods:search` - Search mods by query
- `mods:sync` - Sync with Steam Workshop
- `mods:export` - Export mods to file

#### Translation Operations
- `translation:translate` - Translate text
- `translation:getCached` - Get cached translation
- `translation:clearCache` - Clear translation cache

#### File Dialog Operations
- `dialog:open` - Show open file/folder dialog
- `dialog:save` - Show save file dialog

#### App Operations
- `app:getInfo` - Get app information
- `app:getPath` - Get system paths
- `app:quit` - Quit application
- `app:relaunch` - Relaunch application
- `app:minimize` - Minimize window
- `app:maximize` - Maximize/restore window
- `app:close` - Close window

### Using IPC from Renderer Process

The `window.electronAPI` object is available in the renderer process:

```typescript
// Example: Scan mods
const result = await window.electronAPI.scanMods();

// Example: Get all mods
const mods = await window.electronAPI.getAllMods(100, 0);

// Example: Translate text
const translation = await window.electronAPI.translate({
  text: 'Hello',
  targetLang: 'es'
});

// Example: Show open dialog
const result = await window.electronAPI.showOpenDialog({
  title: 'Select Workshop Folder',
  properties: ['openDirectory']
});
```

## Development vs Production Mode

### Development Mode
- **Trigger**: `NODE_ENV=development` or `app.isPackaged === false`
- **Frontend**: Loads from Vite dev server (`http://localhost:3001`)
- **Features**:
  - DevTools open automatically
  - Hot module replacement for React
  - Manual restart needed for main process changes (unless using watch mode)
  - Detailed console logging

### Production Mode
- **Trigger**: `NODE_ENV=production` or `app.isPackaged === true`
- **Frontend**: Loads from built files (`web/dist/index.html`)
- **Features**:
  - Optimized and minified code
  - No DevTools by default
  - Single executable package

## Build Process

### 1. Build React Frontend
```bash
npm run web:build
```
- Compiles React app using Vite
- Output: `web/dist/`
- Includes: HTML, JS, CSS, assets

### 2. Build Electron Main Process
```bash
npm run build:electron
```
- Compiles TypeScript to JavaScript
- Uses `tsconfig.electron.json`
- Output: `dist/main.js`, `dist/preload.js`, etc.

### 3. Package with Electron Builder
```bash
npm run dist
```
- Creates distributable packages
- Output: `release/`
- Includes: Installers, portable apps, etc.

## Electron Builder Configuration

Configuration in `electron-builder.json`:

### Key Settings

- **App ID**: `com.dmck96.duckov-mod-manager`
- **Product Name**: Duckov Mod Manager
- **Output Directory**: `release/`
- **Main Entry**: `dist/main.js`

### Windows Build
- **Targets**: NSIS installer (x64, ia32), Portable (x64)
- **Icon**: `build/icon.ico`
- **Installer**: Allows custom install directory, creates shortcuts

### macOS Build
- **Targets**: DMG, ZIP
- **Icon**: `build/icon.icns`
- **Code Signing**: Configured (requires certificates)

### Linux Build
- **Targets**: AppImage, DEB, RPM
- **Icon**: `build/icons/`

### Native Dependencies

SQLite3 requires special handling:
- **ASAR Unpack**: `node_modules/sqlite3/**/*`
- **Reason**: Native bindings must be unpacked from ASAR archive

## Next Steps

### Phase 2: IPC Handler Implementation

The current setup provides the structure. Next phase will:

1. Implement IPC handlers in `src/main.ts`
2. Connect handlers to existing services
3. Add error handling and validation
4. Create a separate IPC handlers module for organization

Example structure for Phase 2:
```typescript
// src/ipc/handlers.ts
import { ipcMain } from 'electron';
import { IpcChannels } from '../types/electron';
import { getServices } from '../main';

export function registerModHandlers() {
  ipcMain.handle(IpcChannels.MODS_SCAN, async () => {
    const { modService } = getServices();
    return await modService.scanAndSyncLocalMods();
  });

  // ... more handlers
}
```

### Phase 3: Frontend Integration

Update React components to use `window.electronAPI` instead of `fetch('/api/...')`:

```typescript
// Before (Express API)
const response = await fetch('/api/mods');
const mods = await response.json();

// After (Electron IPC)
const result = await window.electronAPI.getAllMods();
const mods = result.mods;
```

## Troubleshooting

### Issue: Electron won't start
- Ensure Vite dev server is running (development mode)
- Check that build completed successfully
- Verify `.env` file exists with correct configuration

### Issue: "Cannot find module" errors
- Run `npm run build:electron` to compile TypeScript
- Ensure all dependencies are installed: `npm install`

### Issue: SQLite errors in packaged app
- Verify `asarUnpack` includes sqlite3 in `electron-builder.json`
- Rebuild native modules: `npm rebuild`

### Issue: Hot reload not working
- Restart Vite dev server
- Clear browser cache
- Check console for errors

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Builder Documentation](https://www.electron.build/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
