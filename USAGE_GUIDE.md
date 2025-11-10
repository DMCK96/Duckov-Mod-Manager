# Offline Translation Service - Usage Guide

## Quick Start

### Basic Setup

```typescript
import { Database } from './database/Database';
import { OfflineTranslationService } from './services/OfflineTranslationService';
import { LocalModService } from './services/LocalModService';
import { ModService } from './services/ModService';

// Initialize services
const database = new Database();
await database.initialize();

const translationService = new OfflineTranslationService(database);
const localModService = new LocalModService('/path/to/workshop/folder');
const modService = new ModService(database, translationService, localModService);

// Initialize translation model (downloads on first run)
await translationService.initialize();
```

---

## OfflineTranslationService Examples

### 1. Simple Translation

```typescript
const translationService = new OfflineTranslationService(database);
await translationService.initialize();

// Translate a single text
const result = await translationService.translate("你好世界");
console.log(result); // "Hello World"
```

### 2. Batch Translation

```typescript
const texts = [
  "这是第一个模组",
  "这是第二个模组",
  "这是第三个模组"
];

const results = await translationService.translateBatch(texts);
console.log(results);
// ["This is the first mod", "This is the second mod", "This is the third mod"]
```

### 3. Translate Mod Content

```typescript
const mod = {
  title: "超级武器模组",
  description: "添加了许多新武器到游戏中"
};

const translation = await translationService.translateModContent(
  mod.title,
  mod.description
);

console.log(translation.translatedTitle);       // "Super Weapon Mod"
console.log(translation.translatedDescription);  // "Adds many new weapons to the game"
```

### 4. Monitor Translation Cache

```typescript
const stats = await translationService.getCacheStats();
console.log(`Cached translations: ${stats.cached}`);
console.log(`Total translations: ${stats.total}`);
console.log(`Cache hit rate: ${stats.hitRate}%`);
console.log(`Model load time: ${stats.modelLoadTime}ms`);
```

### 5. Clear Cache

```typescript
// Clear expired translations
await translationService.clearCache();

// Clear ALL translations (including non-expired)
await database.clearAllTranslations();
```

### 6. Check Service Status

```typescript
// Check if model is loaded
if (translationService.isReady()) {
  console.log("Translation service ready!");
} else {
  console.log("Model not loaded yet");
  await translationService.initialize();
}

// Get model information
const modelInfo = translationService.getModelInfo();
console.log(`Model: ${modelInfo.name}`);
console.log(`Size: ${modelInfo.size}`);
console.log(`Languages: ${modelInfo.languages.source} → ${modelInfo.languages.target}`);
```

### 7. Validate Configuration

```typescript
const validation = await translationService.validateConfiguration();
if (validation.valid) {
  console.log("✅ " + validation.message);
} else {
  console.error("❌ " + validation.message);
}
```

---

## ModService Examples

### 1. Scan Local Mods

```typescript
const result = await modService.scanAndSyncLocalMods();

console.log(`Scanned: ${result.scanned} mods`);
console.log(`Synced: ${result.synced.length} mods`);
console.log(`Errors: ${result.errors.length}`);

// Show synced mods
result.synced.forEach(mod => {
  console.log(`${mod.id}: ${mod.title}`);
  if (mod.translatedTitle) {
    console.log(`  → ${mod.translatedTitle}`);
  }
});

// Show errors
result.errors.forEach(error => {
  console.error(`Error: ${error}`);
});
```

### 2. Get a Specific Mod

```typescript
// Get mod without translation
const mod = await modService.getMod('12345', false);
if (mod) {
  console.log(`Title: ${mod.title}`);
  console.log(`Description: ${mod.description}`);
}

// Get mod with automatic translation
const modWithTranslation = await modService.getMod('12345', true);
if (modWithTranslation) {
  console.log(`Original: ${modWithTranslation.originalTitle}`);
  console.log(`Translated: ${modWithTranslation.translatedTitle}`);
}
```

### 3. Search Mods

```typescript
const results = await modService.searchMods("weapon", 20);
results.forEach(mod => {
  console.log(`${mod.id}: ${mod.title}`);
});
```

### 4. Get All Mods (Paginated)

```typescript
// Get first 100 mods
const page1 = await modService.getAllMods(100, 0);

// Get next 100 mods
const page2 = await modService.getAllMods(100, 100);

console.log(`Page 1: ${page1.length} mods`);
console.log(`Page 2: ${page2.length} mods`);
```

### 5. Translate a Specific Mod

```typescript
const mod = await modService.getMod('12345');
if (mod && mod.language !== 'en') {
  // Force retranslation
  await modService.translateMod(mod, true);
  console.log(`Translated: ${mod.translatedTitle}`);
}
```

### 6. Get Mod Statistics

```typescript
const stats = await modService.getModStatistics();
console.log(`Total mods: ${stats.totalMods}`);
console.log(`Translated: ${stats.translatedMods}`);
console.log(`Recent updates: ${stats.recentUpdates}`);
console.log(`Language breakdown:`, stats.languageBreakdown);
// { en: 50, zh: 120, ja: 30, ko: 20 }
```

### 7. Refresh All Translations

```typescript
// Refresh all non-English mods
const result = await modService.refreshModTranslations();
console.log(`Success: ${result.success}`);
console.log(`Errors: ${result.errors}`);

// Refresh only Chinese mods
const zhResult = await modService.refreshModTranslations('zh');
```

### 8. Export Mods as ZIP

```typescript
import path from 'path';
import { app } from 'electron';

// Export selected mods
const modIds = ['12345', '67890', '11111'];
const outputPath = path.join(app.getPath('downloads'), 'mods-export.zip');

const result = await modService.exportMods(modIds, outputPath);
console.log(`Exported: ${result.exportedCount} mods`);
console.log(`Zip file: ${result.zipPath}`);
console.log(`Missing: ${result.missingMods.join(', ')}`);
```

---

## LocalModService Examples

### 1. Scan Workshop Folder

```typescript
const localModService = new LocalModService('/path/to/workshop');

const modIds = await localModService.scanLocalMods();
console.log(`Found ${modIds.length} mods:`);
modIds.forEach(id => console.log(id));
```

### 2. Check if Mod Exists

```typescript
const exists = await localModService.modExists('12345');
if (exists) {
  console.log("Mod found locally!");
} else {
  console.log("Mod not found");
}
```

### 3. Get Mod Folder Info

```typescript
const info = await localModService.getModFolderInfo('12345');
if (info.exists) {
  console.log(`Path: ${info.path}`);
  console.log(`Files: ${info.fileCount}`);
  console.log(`Size: ${(info.totalSize! / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Last modified: ${info.lastModified}`);
}
```

### 4. Update Workshop Path

```typescript
// Change workshop path at runtime
localModService.setWorkshopPath('D:/Steam/workshop/content/12345');
console.log(`New path: ${localModService.getWorkshopPath()}`);
```

### 5. Validate Configuration

```typescript
const validation = await localModService.validateConfiguration();
if (validation.valid) {
  console.log("✅ " + validation.message);
} else {
  console.error("❌ " + validation.message);
}
```

---

## Database Examples

### 1. Direct Translation Operations

```typescript
// Save a translation
await database.saveTranslation(
  "你好",           // original text
  "Hello",          // translated text
  "zh",             // source language
  "en"              // target language
);

// Get a translation
const cached = await database.getTranslation("你好", "zh", "en");
if (cached) {
  console.log(cached.translatedText); // "Hello"
  console.log(`Cached at: ${cached.createdAt}`);
  console.log(`Expires at: ${cached.expiresAt}`);
}

// Get translation count
const count = await database.getTranslationCount();
console.log(`${count} translations in cache`);

// Clear expired translations
const deleted = await database.clearExpiredTranslations();
console.log(`Deleted ${deleted} expired translations`);
```

### 2. Mod Operations

```typescript
// Save a mod
await database.saveMod(modInfo);

// Get a mod
const mod = await database.getMod('12345');

// Search mods
const results = await database.searchMods("weapon", 50);

// Get all mods
const allMods = await database.getAllMods(1000, 0);
```

---

## Error Handling

### Handle Translation Errors

```typescript
try {
  const result = await translationService.translate("你好");
  console.log(result);
} catch (error) {
  console.error("Translation failed:", error);
  // Service returns original text on error, so this rarely throws
}
```

### Handle Model Loading Errors

```typescript
try {
  await translationService.initialize();
} catch (error) {
  if (error.message.includes("download")) {
    console.error("Failed to download model. Check internet connection.");
  } else {
    console.error("Model initialization failed:", error);
  }
}
```

### Handle Mod Scanning Errors

```typescript
try {
  const result = await modService.scanAndSyncLocalMods();
  if (result.errors.length > 0) {
    console.warn("Some mods failed to process:");
    result.errors.forEach(err => console.warn(err));
  }
} catch (error) {
  console.error("Scan failed completely:", error);
}
```

---

## Progress Tracking

### Monitor Model Download

```typescript
// The service logs progress automatically
// You can listen to log events if needed
import { logger } from './utils/logger';

// Model download progress is logged:
// "Downloading model: model.safetensors - 45%"
// "Downloaded: model.safetensors"
```

### Track Translation Progress

```typescript
const mods = await modService.getAllMods(1000);
const chineseMods = mods.filter(m => m.language === 'zh');

console.log(`Translating ${chineseMods.length} mods...`);

let completed = 0;
for (const mod of chineseMods) {
  await modService.translateMod(mod);
  completed++;
  console.log(`Progress: ${completed}/${chineseMods.length}`);
}
```

---

## Performance Tips

### 1. Use Batch Translation
```typescript
// BAD: Translate one by one
for (const text of texts) {
  await translationService.translate(text);
}

// GOOD: Use batch translation
await translationService.translateBatch(texts);
```

### 2. Check Cache First
```typescript
// Check if already translated before calling service
const mod = await database.getMod(modId);
if (mod.translatedTitle && mod.lastTranslated) {
  // Already translated, use cached version
  return mod;
}
```

### 3. Initialize Model Once
```typescript
// Initialize at app startup, not per-request
await translationService.initialize(); // Only call once!
```

### 4. Use Pagination
```typescript
// Don't load all mods at once
const PAGE_SIZE = 100;
let offset = 0;
let hasMore = true;

while (hasMore) {
  const mods = await modService.getAllMods(PAGE_SIZE, offset);
  // Process mods...
  hasMore = mods.length === PAGE_SIZE;
  offset += PAGE_SIZE;
}
```

---

## Integration with Electron IPC

### Main Process

```typescript
import { ipcMain } from 'electron';

// Initialize services
const modService = new ModService(database, translationService, localModService);

// Handle scan request
ipcMain.handle('scan-mods', async () => {
  const result = await modService.scanAndSyncLocalMods();
  return result;
});

// Handle translation request
ipcMain.handle('translate-mod', async (event, modId) => {
  const mod = await modService.getMod(modId);
  if (mod) {
    await modService.translateMod(mod);
    return mod;
  }
  return null;
});

// Handle export request
ipcMain.handle('export-mods', async (event, modIds, outputPath) => {
  const result = await modService.exportMods(modIds, outputPath);
  return result;
});
```

### Renderer Process

```typescript
// Scan mods
const result = await window.electron.ipcRenderer.invoke('scan-mods');
console.log(`Scanned: ${result.scanned} mods`);

// Translate mod
const mod = await window.electron.ipcRenderer.invoke('translate-mod', '12345');
console.log(`Translated: ${mod.translatedTitle}`);

// Export mods
const exportResult = await window.electron.ipcRenderer.invoke(
  'export-mods',
  ['12345', '67890'],
  '/path/to/output.zip'
);
console.log(`Exported: ${exportResult.exportedCount} mods`);
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Workshop folder path
WORKSHOP_DATA_PATH="C:/Program Files (x86)/Steam/steamapps/workshop/content/YOUR_APP_ID"

# Translation cache TTL (optional, default: 30 days)
TRANSLATION_CACHE_TTL_DAYS=30

# Database path (optional, uses userData by default)
DB_PATH="./data/mods.db"
```

### Example .env File

```env
WORKSHOP_DATA_PATH=C:/Program Files (x86)/Steam/steamapps/workshop/content/12345
TRANSLATION_CACHE_TTL_DAYS=30
NODE_ENV=production
```

---

## Troubleshooting

### Model Not Downloading
```typescript
// Check model cache directory
import { env } from '@xenova/transformers';
console.log(`Model cache: ${env.cacheDir}`);

// Check if download is allowed
console.log(`Allow remote models: ${env.allowRemoteModels}`);
```

### Translation Returns Original Text
```typescript
// Check if model is loaded
if (!translationService.isReady()) {
  console.log("Model not loaded yet");
  await translationService.initialize();
}

// Validate service
const validation = await translationService.validateConfiguration();
console.log(validation.message);
```

### Database Errors
```typescript
// Check database path
console.log(`Database path: ${database.dbPath}`);

// Try to initialize
try {
  await database.initialize();
} catch (error) {
  console.error("Database initialization failed:", error);
}
```

---

## Complete Example

Here's a complete example showing the full workflow:

```typescript
import { app } from 'electron';
import { Database } from './database/Database';
import { OfflineTranslationService } from './services/OfflineTranslationService';
import { LocalModService } from './services/LocalModService';
import { ModService } from './services/ModService';

async function main() {
  // 1. Initialize database
  console.log("Initializing database...");
  const database = new Database();
  await database.initialize();

  // 2. Initialize translation service
  console.log("Initializing translation service...");
  const translationService = new OfflineTranslationService(database);
  await translationService.initialize(); // Downloads model if needed

  // 3. Initialize local mod service
  const workshopPath = process.env.WORKSHOP_DATA_PATH;
  if (!workshopPath) {
    throw new Error("WORKSHOP_DATA_PATH not configured");
  }
  const localModService = new LocalModService(workshopPath);

  // 4. Initialize mod service
  const modService = new ModService(database, translationService, localModService);

  // 5. Scan local mods
  console.log("Scanning local mods...");
  const scanResult = await modService.scanAndSyncLocalMods();
  console.log(`Found ${scanResult.scanned} mods`);
  console.log(`Synced ${scanResult.synced.length} mods`);

  // 6. Get statistics
  const stats = await modService.getModStatistics();
  console.log(`Total mods: ${stats.totalMods}`);
  console.log(`Translated: ${stats.translatedMods}`);

  // 7. Export mods
  const outputPath = path.join(app.getPath('downloads'), 'mods-export.zip');
  const modIds = scanResult.synced.slice(0, 5).map(m => m.id);
  const exportResult = await modService.exportMods(modIds, outputPath);
  console.log(`Exported ${exportResult.exportedCount} mods to ${exportResult.zipPath}`);

  // 8. Check translation cache
  const cacheStats = await translationService.getCacheStats();
  console.log(`Translation cache hit rate: ${cacheStats.hitRate}%`);
}

app.whenReady().then(main).catch(console.error);
```

---

## API Reference Summary

### OfflineTranslationService
- `initialize()` - Load translation model
- `translate(text)` - Translate single text
- `translateBatch(texts)` - Translate multiple texts
- `translateModContent(title, desc)` - Translate mod content
- `getCacheStats()` - Get cache statistics
- `clearCache()` - Clear expired translations
- `validateConfiguration()` - Validate service
- `getModelInfo()` - Get model information
- `isReady()` - Check if model loaded

### ModService
- `scanAndSyncLocalMods()` - Scan and process local mods
- `getMod(id, translate?)` - Get specific mod
- `getAllMods(limit, offset)` - Get all mods (paginated)
- `searchMods(term, limit)` - Search mods
- `translateMod(mod, force?)` - Translate a mod
- `getModStatistics()` - Get mod statistics
- `refreshModTranslations(lang?)` - Refresh translations
- `exportMods(ids, path)` - Export mods as ZIP

### LocalModService
- `scanLocalMods()` - Scan workshop folder
- `modExists(id)` - Check if mod exists
- `getModFolderInfo(id)` - Get folder information
- `setWorkshopPath(path)` - Update workshop path
- `getWorkshopPath()` - Get current path
- `validateConfiguration()` - Validate configuration

### Database
- `initialize()` - Initialize database
- `saveMod(mod)` - Save mod to database
- `getMod(id)` - Get mod by ID
- `getAllMods(limit, offset)` - Get all mods
- `searchMods(term, limit)` - Search mods
- `saveTranslation(...)` - Save translation
- `getTranslation(...)` - Get cached translation
- `getTranslationCount()` - Get cache count
- `clearExpiredTranslations()` - Clear expired cache
- `close()` - Close database connection

---

**Last Updated:** 2025-11-10
