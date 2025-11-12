/**
 * ModService.test.ts
 *
 * Comprehensive unit tests for the ModService class
 * Tests mod management, translation integration, and export functionality
 */

// Mock dependencies BEFORE imports
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      const path = require('path');
      if (name === 'userData') {
        return path.join(process.cwd(), 'test-data', 'userData');
      }
      return path.join(process.cwd(), 'test-data');
    }),
    isReady: jest.fn(() => true),
    on: jest.fn()
  }
}), { virtual: true });

// Mock @xenova/transformers
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
  env: {
    cacheDir: '',
    allowRemoteModels: true,
    allowLocalModels: true
  }
}));

import { ModService } from '../ModService';
import { Database } from '../../database/Database';
import { OfflineTranslationService } from '../OfflineTranslationService';
import { LocalModService } from '../LocalModService';
import { SteamWorkshopService } from '../SteamWorkshopService';
import {
  createTestDatabase,
  cleanupTestDb,
  createMockMod,
  createMockMods,
  createMockTranslatedMod,
  createTestWorkshopDir,
  createMockModFolder,
  cleanupTestWorkshopDir,
  suppressConsoleOutput
} from '../../__tests__/utils/testHelpers';
import path from 'path';
import fs from 'fs';

// Mock SteamWorkshopService
jest.mock('../SteamWorkshopService');

describe('ModService', () => {
  let modService: ModService;
  let database: Database;
  let translationService: OfflineTranslationService;
  let localModService: LocalModService;
  let steamWorkshopService: jest.Mocked<SteamWorkshopService>;
  let consoleSpy: ReturnType<typeof suppressConsoleOutput>;
  let workshopDir: string;
  const testName = 'mod-service';

  beforeAll(() => {
    consoleSpy = suppressConsoleOutput();
  });

  afterAll(() => {
    consoleSpy.restore();
  });

  beforeEach(async () => {
    // Create test database
    database = await createTestDatabase(testName);

    // Create test workshop directory
    workshopDir = createTestWorkshopDir(testName);

    // Setup mock translation pipeline
    const { pipeline } = require('@xenova/transformers');
    const mockTranslator = jest.fn(async (text: string) => {
      const translations: Record<string, string> = {
        '测试模组': 'Test Mod',
        '模组描述': 'Mod Description',
        '这是测试': 'This is test'
      };
      return { translation_text: translations[text] || `Translated: ${text}` };
    });
    pipeline.mockResolvedValue(mockTranslator);

    // Initialize services
    translationService = new OfflineTranslationService(database);
    localModService = new LocalModService(workshopDir);
    
    // Create mock Steam Workshop Service
    steamWorkshopService = new SteamWorkshopService() as jest.Mocked<SteamWorkshopService>;
    steamWorkshopService.getWorkshopItems = jest.fn().mockResolvedValue(new Map());
    steamWorkshopService.getWorkshopItem = jest.fn().mockResolvedValue(null);
    
    modService = new ModService(database, translationService, localModService, steamWorkshopService);
  });

  afterEach(async () => {
    await database.close();
    cleanupTestDb(testName);
    cleanupTestWorkshopDir(testName);
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    test('should initialize ModService with dependencies', () => {
      expect(modService).toBeDefined();
      expect(modService).toBeInstanceOf(ModService);
    });

    test('should work with injected dependencies', async () => {
      // Verify services are properly injected
      const mod = createMockMod({ id: '12345' });
      await database.saveMod(mod);

      const retrieved = await modService.getMod('12345', false);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('12345');
    });
  });

  describe('Local Mod Scanning', () => {
    test('should scan local workshop folder', async () => {
      // Create mock mod folders
      createMockModFolder(workshopDir, '12345');
      createMockModFolder(workshopDir, '67890');
      createMockModFolder(workshopDir, '11111');

      const result = await modService.scanAndSyncLocalMods();

      expect(result.scanned).toBe(3);
      expect(result.synced.length).toBeLessThanOrEqual(3);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty workshop folder', async () => {
      const result = await modService.scanAndSyncLocalMods();

      expect(result.scanned).toBe(0);
      expect(result.synced).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    test('should create database entries for new mods', async () => {
      createMockModFolder(workshopDir, '99999');

      await modService.scanAndSyncLocalMods();

      const mod = await database.getMod('99999');
      expect(mod).not.toBeNull();
      expect(mod?.id).toBe('99999');
    });

    test('should handle scan errors gracefully', async () => {
      // Use non-existent workshop path
      const invalidService = new ModService(
        database,
        translationService,
        new LocalModService('/invalid/path'),
        steamWorkshopService
      );

      await expect(invalidService.scanAndSyncLocalMods()).rejects.toThrow();
    });
  });

  describe('Mod Translation', () => {
    test('should translate mod titles and descriptions', async () => {
      const mod = createMockMod({
        id: '12345',
        title: '测试模组',
        description: '模组描述',
        language: 'zh'
      });

      await database.saveMod(mod);

      const translatedMod = await modService.translateMod(mod);

      expect(translatedMod.translatedTitle).toBe('Test Mod');
      expect(translatedMod.translatedDescription).toBe('Mod Description');
      expect(translatedMod.lastTranslated).toBeInstanceOf(Date);
    });

    test('should mark mods with translations', async () => {
      const mod = createMockMod({
        id: '12345',
        title: '测试模组',
        language: 'zh'
      });

      await database.saveMod(mod);
      await modService.translateMod(mod);

      const retrieved = await database.getMod('12345');

      expect(retrieved?.originalTitle).toBe('测试模组');
      expect(retrieved?.translatedTitle).toBeDefined();
      expect(retrieved?.lastTranslated).toBeInstanceOf(Date);
    });

    test('should skip translation if already translated recently', async () => {
      const mod = createMockTranslatedMod({
        id: '12345',
        lastTranslated: new Date() // Just translated
      });

      const { pipeline } = require('@xenova/transformers');
      const callCountBefore = pipeline.mock.calls.length;

      await modService.translateMod(mod, false);

      const callCountAfter = pipeline.mock.calls.length;

      // Should not call pipeline again if recent translation exists
      expect(callCountAfter).toBe(callCountBefore);
    });

    test('should force retranslation when requested', async () => {
      const mod = createMockTranslatedMod({
        id: '12345',
        title: '测试模组',
        translatedTitle: 'Old Translation',
        lastTranslated: new Date()
      });

      await database.saveMod(mod);

      // Force retranslation
      const retranslated = await modService.translateMod(mod, true);

      expect(retranslated.translatedTitle).toBe('Test Mod');
      expect(retranslated.lastTranslated).toBeInstanceOf(Date);
    });

    test('should handle translation errors gracefully', async () => {
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValueOnce(new Error('Translation failed'));

      const mod = createMockMod({
        id: '12345',
        title: '测试',
        language: 'zh'
      });

      // Should not throw, just return mod without translation
      const result = await modService.translateMod(mod);
      expect(result).toBeDefined();
    });
  });

  describe('Mod Retrieval', () => {
    test('should get mod by ID', async () => {
      const mod = createMockMod({ id: '12345' });
      await database.saveMod(mod);

      const retrieved = await modService.getMod('12345', false);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('12345');
    });

    test('should return null for non-existent mod', async () => {
      const retrieved = await modService.getMod('non-existent', false);
      expect(retrieved).toBeNull();
    });

    test('should auto-translate when requested', async () => {
      const mod = createMockMod({
        id: '12345',
        title: '测试模组',
        language: 'zh'
      });
      await database.saveMod(mod);

      const retrieved = await modService.getMod('12345', true);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.translatedTitle).toBeDefined();
    });

    test('should get all mods with sorting', async () => {
      const mods = createMockMods(5);
      for (const mod of mods) {
        await database.saveMod(mod);
      }

      const allMods = await modService.getAllMods(10, 0);

      expect(allMods.length).toBeGreaterThanOrEqual(5);
    });

    test('should search mods by keyword', async () => {
      await database.saveMod(createMockMod({ id: '1', title: 'Weapons Mod' }));
      await database.saveMod(createMockMod({ id: '2', title: 'Armor Mod' }));

      const results = await modService.searchMods('Weapons');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(m => m.id === '1')).toBe(true);
    });
  });

  describe('Mod Export', () => {
    test('should export mods to ZIP file', async () => {
      // Create mod folders
      createMockModFolder(workshopDir, '12345', 3);
      createMockModFolder(workshopDir, '67890', 3);

      const outputPath = path.join(workshopDir, 'export.zip');

      const result = await modService.exportMods(['12345', '67890'], outputPath);

      expect(result.zipPath).toBe(outputPath);
      expect(result.exportedCount).toBe(2);
      expect(result.missingMods).toEqual([]);
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should handle missing mods in export', async () => {
      createMockModFolder(workshopDir, '12345', 3);

      const outputPath = path.join(workshopDir, 'export.zip');

      const result = await modService.exportMods(
        ['12345', 'missing-mod'],
        outputPath
      );

      expect(result.exportedCount).toBe(1);
      expect(result.missingMods).toContain('missing-mod');
    });

    test('should throw error when no mods found for export', async () => {
      const outputPath = path.join(workshopDir, 'export.zip');

      await expect(
        modService.exportMods(['non-existent'], outputPath)
      ).rejects.toThrow('No local mod folders found');
    });

    test('should handle empty mod list', async () => {
      const outputPath = path.join(workshopDir, 'export.zip');

      await expect(
        modService.exportMods([], outputPath)
      ).rejects.toThrow();
    });
  });

  describe('Mod Statistics', () => {
    test('should get mod statistics', async () => {
      const mods = createMockMods(10);
      for (const mod of mods) {
        await database.saveMod(mod);
      }

      const stats = await modService.getModStatistics();

      expect(stats.totalMods).toBeGreaterThanOrEqual(10);
      expect(stats.languageBreakdown).toBeDefined();
      expect(stats.recentUpdates).toBeGreaterThanOrEqual(0);
    });

    test('should track translated mods count', async () => {
      const untranslated = createMockMod({ id: 'stat-untranslated', language: 'zh' });
      const translated = createMockTranslatedMod({ id: 'stat-translated', language: 'zh' });

      await database.saveMod(untranslated);
      await database.saveMod(translated);

      const stats = await modService.getModStatistics();

      expect(stats.totalMods).toBeGreaterThanOrEqual(2);
      expect(stats.translatedMods).toBeGreaterThanOrEqual(1);
    });

    test('should calculate language breakdown', async () => {
      await database.saveMod(createMockMod({ id: 'lang-zh-1', language: 'zh' }));
      await database.saveMod(createMockMod({ id: 'lang-zh-2', language: 'zh' }));
      await database.saveMod(createMockMod({ id: 'lang-en-1', language: 'en' }));

      const stats = await modService.getModStatistics();

      expect(stats.languageBreakdown['zh']).toBeGreaterThanOrEqual(2);
      expect(stats.languageBreakdown['en']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Bulk Translation Operations', () => {
    test('should refresh all mod translations', async () => {
      const mods = [
        createMockMod({ id: 'refresh-1', title: '测试1', language: 'zh' }),
        createMockMod({ id: 'refresh-2', title: '测试2', language: 'zh' })
      ];

      for (const mod of mods) {
        await database.saveMod(mod);
      }

      const result = await modService.refreshModTranslations();

      expect(result.success).toBeGreaterThanOrEqual(2);
      expect(result.errors).toBeGreaterThanOrEqual(0);
    });

    test('should filter by language when refreshing', async () => {
      await database.saveMod(createMockMod({ id: 'refresh-zh', language: 'zh' }));
      await database.saveMod(createMockMod({ id: 'refresh-en', language: 'en' }));

      const result = await modService.refreshModTranslations('zh');

      expect(result.success).toBeGreaterThanOrEqual(1);
    });

    test('should handle translation errors in bulk refresh', async () => {
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValueOnce(new Error('Translation failed'));

      await database.saveMod(createMockMod({ id: 'refresh-error', language: 'zh' }));

      const result = await modService.refreshModTranslations();

      // With error handling, it should complete but might have errors
      expect(result.success + result.errors).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid inputs gracefully', async () => {
      await expect(modService.getMod('')).resolves.toBeNull();
    });

    test('should handle database errors', async () => {
      await database.close();

      await expect(modService.getAllMods()).rejects.toThrow();
    });

    test('should handle translation service errors', async () => {
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValue(new Error('Service unavailable'));

      const mod = createMockMod({ language: 'zh' });
      await database.saveMod(mod);

      // Should not throw, just handle gracefully
      const result = await modService.translateMod(mod);
      expect(result).toBeDefined();
    });
  });
});
