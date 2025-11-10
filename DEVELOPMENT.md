# Development Guide - Duckov Mod Manager (Electron)

## Quick Start

### First Time Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Copy .env.example to .env
   copy .env.example .env  # Windows
   # or
   cp .env.example .env    # Linux/Mac

   # Edit .env and fill in your configuration
   ```

3. **Build Electron Main Process**
   ```bash
   npm run build:electron
   ```

### Running in Development Mode

**Option 1: Manual (Recommended for debugging)**

Open 3 terminal windows:

```bash
# Terminal 1: Start Vite dev server for React frontend
npm run web:dev

# Terminal 2: Watch and rebuild Electron main process on changes
npm run electron:watch

# Terminal 3: Run Electron (restart manually when main process changes)
npm run electron:dev
```

**Option 2: Quick Start (Less flexible)**

```bash
# Build once and run
npm run build:electron && npm start
```

### Development Workflow

1. **Frontend (React) Changes**
   - Edit files in `web/src/`
   - Changes hot-reload automatically in Electron window
   - No restart needed

2. **Main Process (Electron) Changes**
   - Edit files in `src/main.ts`, `src/preload.ts`, or services
   - `electron:watch` rebuilds automatically
   - **Restart Electron manually** (close and `npm run electron:dev` again)

3. **Type Definition Changes**
   - Edit `src/types/electron.ts` or `src/types/index.ts`
   - Rebuild main process: `npm run build:electron`
   - Restart Electron

## Project Structure

```
Duckov-Mod-Manager/
├── src/                          # Backend/Electron code
│   ├── main.ts                   # Electron main process ⚡ Entry point
│   ├── preload.ts                # IPC bridge 🔒 Security layer
│   ├── types/
│   │   ├── electron.ts           # Electron IPC types
│   │   └── index.ts              # Shared types
│   ├── services/                 # Business logic
│   │   ├── ModService.ts
│   │   ├── TranslationService.ts
│   │   ├── SteamWorkshopService.ts
│   │   └── LocalModService.ts
│   ├── database/
│   │   └── Database.ts
│   └── utils/
│       └── logger.ts
│
├── web/                          # Frontend React code
│   ├── src/                      # React source
│   ├── dist/                     # Built React app (production)
│   └── index.html
│
├── dist/                         # Compiled TypeScript (Electron)
│   ├── main.js                   # Compiled from src/main.ts
│   ├── preload.js                # Compiled from src/preload.ts
│   └── ...
│
└── release/                      # Built Electron packages
```

## Available Scripts

### Development
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (React only) |
| `npm run web:dev` | Same as above |
| `npm run electron:watch` | Watch and rebuild Electron main process |
| `npm run electron:dev` | Build and run Electron once |
| `npm start` | Run Electron (production mode) |

### Building
| Command | Purpose |
|---------|---------|
| `npm run build` | Build everything (web + electron) |
| `npm run build:electron` | Build Electron main process only |
| `npm run web:build` | Build React frontend only |

### Distribution
| Command | Purpose |
|---------|---------|
| `npm run dist` | Create distributable for all platforms |
| `npm run dist:win` | Create Windows installer/portable |
| `npm run dist:mac` | Create macOS DMG |
| `npm run dist:linux` | Create Linux AppImage/DEB/RPM |

### Other
| Command | Purpose |
|---------|---------|
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

## Key Files

### Configuration Files

- **`package.json`** - Dependencies and scripts
- **`tsconfig.json`** - TypeScript config for shared code
- **`tsconfig.electron.json`** - TypeScript config for Electron main/preload
- **`vite.config.ts`** - Vite config for React frontend
- **`electron-builder.json`** - Electron build/packaging config
- **`.env`** - Environment variables (create from `.env.example`)

### Source Files

- **`src/main.ts`** - Electron main process entry point
- **`src/preload.ts`** - Secure IPC bridge
- **`src/types/electron.ts`** - IPC type definitions and channel names
- **`web/src/App.tsx`** - React app entry point (assumed)

## IPC Communication

### From Renderer (React) to Main Process

All communication uses the `window.electronAPI` object exposed by the preload script.

```typescript
// Example: Scan mods
try {
  const result = await window.electronAPI.scanMods();
  console.log(`Scanned ${result.scanned} mods`);
} catch (error) {
  console.error('Failed to scan mods:', error);
}

// Example: Get mod details
const mod = await window.electronAPI.getModById('123456789');

// Example: Show folder picker
const result = await window.electronAPI.showOpenDialog({
  title: 'Select Workshop Folder',
  properties: ['openDirectory']
});

if (!result.canceled) {
  console.log('Selected folder:', result.filePaths[0]);
}
```

### TypeScript Support in Renderer

The renderer process has full TypeScript support for the Electron API. The types are automatically available via `src/types/electron.ts`:

```typescript
// Types are inferred automatically
const mods = await window.electronAPI.getAllMods(100, 0);
// mods is typed as ModListResult

// Or explicitly type
import type { ModListResult } from '../types/electron';
const result: ModListResult = await window.electronAPI.getAllMods();
```

## Adding New IPC Channels

### 1. Define Channel in Types

Edit `src/types/electron.ts`:

```typescript
export const IpcChannels = {
  // ... existing channels
  MY_NEW_CHANNEL: 'my:newChannel',
} as const;
```

### 2. Add to ElectronAPI Interface

```typescript
export interface ElectronAPI {
  // ... existing methods
  myNewMethod: (arg: string) => Promise<SomeType>;
}
```

### 3. Implement in Preload

Edit `src/preload.ts`:

```typescript
const electronAPI: ElectronAPI = {
  // ... existing methods
  myNewMethod: async (arg: string) => {
    if (typeof arg !== 'string') {
      throw new Error('Invalid argument');
    }
    return await safeInvoke(IpcChannels.MY_NEW_CHANNEL, { arg });
  },
};
```

### 4. Implement Handler in Main Process

Edit `src/main.ts` (in the `registerIpcHandlers` function):

```typescript
ipcMain.handle(IpcChannels.MY_NEW_CHANNEL, async (event, { arg }) => {
  // Implementation
  return { result: 'success' };
});
```

### 5. Use in Renderer

```typescript
const result = await window.electronAPI.myNewMethod('test');
```

## Debugging

### Debugging Renderer Process (React)

1. Open DevTools: Automatically opened in development mode
2. Or manually: View → Toggle Developer Tools in Electron window
3. Use Console, Network, Elements tabs as normal

### Debugging Main Process

1. **Console Logging**
   ```typescript
   import { logger } from './utils/logger';
   logger.info('Debug message');
   logger.error('Error message');
   ```

2. **VS Code Debugger**
   Add to `.vscode/launch.json`:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Debug Electron Main",
         "type": "node",
         "request": "launch",
         "cwd": "${workspaceFolder}",
         "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
         "windows": {
           "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
         },
         "args": ["."],
         "outputCapture": "std"
       }
     ]
   }
   ```

3. **Chrome DevTools for Main Process**
   ```bash
   electron --inspect=5858 .
   ```
   Then open `chrome://inspect` in Chrome.

## Common Issues

### Issue: "Cannot find module" errors
**Solution**: Run `npm run build:electron` to compile TypeScript

### Issue: Changes not reflected
**Solution**:
- Frontend changes: Check Vite dev server is running
- Main process changes: Rebuild (`npm run build:electron`) and restart Electron

### Issue: Electron window is blank
**Solution**:
1. Check DevTools console for errors
2. Verify Vite dev server is running on port 3001
3. Check `.env` has `VITE_DEV_SERVER_URL=http://localhost:3001`

### Issue: IPC calls fail with "channel not found"
**Solution**:
1. Verify channel is defined in `IpcChannels` in `src/types/electron.ts`
2. Verify handler is registered in `src/main.ts`
3. Rebuild main process and restart

### Issue: SQLite errors
**Solution**:
1. Check database path in `.env` is correct
2. Ensure `data/` folder exists
3. Check file permissions

## Performance Tips

1. **Limit IPC Calls**: Batch operations when possible
2. **Use Pagination**: Don't load all mods at once
3. **Cache Translations**: Use the built-in translation cache
4. **Optimize Images**: Compress preview images
5. **Lazy Load**: Load mod details on demand, not upfront

## Security Reminders

1. **Never expose Node.js APIs directly to renderer**
2. **Always validate IPC inputs in preload script**
3. **Use contextBridge for all renderer-accessible APIs**
4. **Keep dependencies updated** for security patches
5. **Sanitize user input** before database queries or file operations

## Production Build Checklist

- [ ] Update version in `package.json`
- [ ] Test all features in development mode
- [ ] Run `npm run build` successfully
- [ ] Test production build with `npm start`
- [ ] Verify database migrations work
- [ ] Test on target platforms (Windows/Mac/Linux)
- [ ] Create distributable with `npm run dist`
- [ ] Test installer/portable versions
- [ ] Update CHANGELOG.md
- [ ] Tag release in git

## Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **React Docs**: https://react.dev/
- **Vite Docs**: https://vitejs.dev/
- **Electron Builder Docs**: https://www.electron.build/
