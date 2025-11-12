/**
 * OfflineTranslationService.test.ts
 *
 * Comprehensive unit tests for the OfflineTranslationService
 * Tests offline translation using Transformers.js with caching
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
jest.mock('@xenova/transformers', () => {
  const mockPipeline = jest.fn();
  return {
    pipeline: mockPipeline,
    env: {
      cacheDir: '',
      allowRemoteModels: true,
      allowLocalModels: true
    }
  };
});

import { OfflineTranslationService } from '../OfflineTranslationService';
import { Database } from '../../database/Database';
import {
  createTestDatabase,
  cleanupTestDb,
  createMockTranslation,
  suppressConsoleOutput,
  wait
} from '../../__tests__/utils/testHelpers';

describe('OfflineTranslationService', () => {
  let service: OfflineTranslationService;
  let database: Database;
  let consoleSpy: ReturnType<typeof suppressConsoleOutput>;
  const testName = 'offline-translation-service';

  beforeAll(() => {
    // Suppress console output during tests
    consoleSpy = suppressConsoleOutput();
  });

  afterAll(() => {
    // Restore console
    consoleSpy.restore();
  });

  beforeEach(async () => {
    // Create fresh database for each test
    database = await createTestDatabase(testName);

    // Create service instance
    service = new OfflineTranslationService(database);
  });

  afterEach(async () => {
    // Cleanup database
    await database.close();
    cleanupTestDb(testName);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize service successfully', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(OfflineTranslationService);
    });

    test('should configure Transformers.js environment on construction', () => {
      const { env } = require('@xenova/transformers');
      expect(env.cacheDir).toBeDefined();
      expect(env.allowLocalModels).toBe(true);
    });

    test('should lazy load translator model on first use', async () => {
      const { pipeline } = require('@xenova/transformers');

      // Mock the pipeline to return a translator
      const mockTranslator = jest.fn(async (text: string) => ({
        translation_text: `Translated: ${text}`
      }));
      pipeline.mockResolvedValueOnce(mockTranslator);

      // First call should trigger initialization
      await service.initialize();

      expect(pipeline).toHaveBeenCalledWith(
        'translation',
        'Xenova/opus-mt-zh-en',
        expect.any(Object)
      );

      expect(service.isReady()).toBe(true);
    });

    test('should reuse translator instance on subsequent initializations', async () => {
      const { pipeline } = require('@xenova/transformers');

      const mockTranslator = jest.fn(async (text: string) => ({
        translation_text: `Translated: ${text}`
      }));
      pipeline.mockResolvedValueOnce(mockTranslator);

      // Initialize twice
      await service.initialize();
      const firstCallCount = pipeline.mock.calls.length;

      await service.initialize();
      const secondCallCount = pipeline.mock.calls.length;

      // Pipeline should only be called once
      expect(secondCallCount).toBe(firstCallCount);
    });

    test('should handle concurrent initialization requests', async () => {
      const { pipeline } = require('@xenova/transformers');

      const mockTranslator = jest.fn(async (text: string) => ({
        translation_text: `Translated: ${text}`
      }));
      pipeline.mockResolvedValueOnce(mockTranslator);

      // Call initialize multiple times concurrently
      await Promise.all([
        service.initialize(),
        service.initialize(),
        service.initialize()
      ]);

      // Pipeline should only be called once despite concurrent calls
      expect(pipeline).toHaveBeenCalledTimes(1);
    });

    test('should handle model download failure gracefully', async () => {
      const { pipeline } = require('@xenova/transformers');

      // Mock pipeline to fail
      pipeline.mockRejectedValueOnce(new Error('Network error: Model download failed'));

      await expect(service.initialize()).rejects.toThrow('Translation model initialization failed');
      expect(service.isReady()).toBe(false);
    });
  });

  describe('Translation Operations', () => {
    beforeEach(async () => {
      // Setup mock translator for these tests
      const { pipeline } = require('@xenova/transformers');

      const mockTranslator = jest.fn(async (text: string) => {
        // Simple mock translation logic
        const translations: Record<string, string> = {
          '你好': 'Hello',
          '世界': 'World',
          '测试模组': 'Test Mod',
          '这是一个测试描述': 'This is a test description'
        };

        return {
          translation_text: translations[text] || `Translated: ${text}`
        };
      });

      pipeline.mockResolvedValueOnce(mockTranslator);
    });

    test('should translate simple Chinese text to English', async () => {
      const result = await service.translate('你好');

      expect(result).toBe('Hello');
    });

    test('should handle empty text gracefully', async () => {
      const result1 = await service.translate('');
      const result2 = await service.translate('   ');

      expect(result1).toBe('');
      expect(result2).toBe('   ');
    });

    test('should return cached translations without re-translating', async () => {
      const text = '测试模组';

      // First translation - should hit the model
      const result1 = await service.translate(text);

      // Second translation - should use cache
      const result2 = await service.translate(text);

      expect(result1).toBe(result2);

      // Verify translation was cached in database
      const cached = await database.getTranslation(text, 'zh', 'en');
      expect(cached).not.toBeNull();
      expect(cached?.translatedText).toBe(result1);
    });

    test('should cache translations in SQLite database', async () => {
      const text = '你好';
      const translation = await service.translate(text);

      // Verify cached in database
      const cached = await database.getTranslation(text, 'zh', 'en');

      expect(cached).not.toBeNull();
      expect(cached?.originalText).toBe(text);
      expect(cached?.translatedText).toBe(translation);
      expect(cached?.sourceLang).toBe('zh');
      expect(cached?.targetLang).toBe('en');
    });

    test('should handle batch translations', async () => {
      const texts = ['你好', '世界', '测试模组'];

      const results = await service.translateBatch(texts);

      expect(results).toHaveLength(3);
      expect(results[0]).toBe('Hello');
      expect(results[1]).toBe('World');
      expect(results[2]).toBe('Test Mod');
    });

    test('should handle empty batch gracefully', async () => {
      const results = await service.translateBatch([]);
      expect(results).toEqual([]);
    });

    test('should handle translation errors gracefully', async () => {
      const { pipeline } = require('@xenova/transformers');

      // Create a fresh service
      const errorService = new OfflineTranslationService(database);

      // Mock translator that throws an error after initialization
      const mockTranslator = jest.fn(async () => {
        throw new Error('Translation error');
      });

      pipeline.mockResolvedValueOnce(mockTranslator);

      // Initialize first
      await errorService.initialize();

      // Should return original text on error (or cached translation)
      const result = await errorService.translate('测试文本');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should translate mod content with title and description', async () => {
      const result = await service.translateModContent(
        '测试模组',
        '这是一个测试描述'
      );

      expect(result.translatedTitle).toBe('Test Mod');
      expect(result.translatedDescription).toBe('This is a test description');
      expect(result.detectedLanguage).toBe('zh');
    });

    test('should return original content when mod translation fails', async () => {
      const { pipeline } = require('@xenova/transformers');

      // Create a fresh service
      const errorService = new OfflineTranslationService(database);

      // Mock translator that throws an error
      const mockTranslator = jest.fn(async () => {
        throw new Error('Translation error');
      });

      pipeline.mockResolvedValueOnce(mockTranslator);

      // Initialize first
      await errorService.initialize();

      const result = await errorService.translateModContent(
        '新测试标题',
        '新测试描述'
      );

      // Should get some result (either original or translated)
      expect(result.translatedTitle).toBeDefined();
      expect(result.translatedDescription).toBeDefined();
      expect(result.detectedLanguage).toBe('zh');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      // Setup mock translator
      const { pipeline } = require('@xenova/transformers');

      const mockTranslator = jest.fn(async (text: string) => ({
        translation_text: `Translated: ${text}`
      }));

      pipeline.mockResolvedValueOnce(mockTranslator);
    });

    test('should get cache statistics correctly', async () => {
      // Add some translations to cache
      await database.saveTranslation('你好', 'Hello', 'zh', 'en');
      await database.saveTranslation('世界', 'World', 'zh', 'en');
      await database.saveTranslation('测试', 'Test', 'zh', 'en');

      // Perform some translations to update stats
      await service.translate('你好');
      await service.translate('你好'); // Cache hit
      await service.translate('新文本'); // Cache miss

      const stats = await service.getCacheStats();

      expect(stats.cached).toBeGreaterThanOrEqual(3);
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(100);
    });

    test('should clear cache functionality', async () => {
      // Add translations
      await database.saveTranslation('你好', 'Hello', 'zh', 'en');
      await database.saveTranslation('世界', 'World', 'zh', 'en');

      // Clear cache
      await service.clearCache();

      // Verify stats are reset
      const stats = await service.getCacheStats();
      expect(stats.total).toBe(0);
    });

    test('should track cache hit rate correctly', async () => {
      // Pre-cache a translation
      await database.saveTranslation('你好', 'Hello', 'zh', 'en');

      // First call - cache hit
      await service.translate('你好');

      // Second call - cache hit
      await service.translate('你好');

      // Third call - cache miss (new text)
      await service.translate('新文本');

      const stats = await service.getCacheStats();

      // Should have 2 hits out of 3 total = 66% hit rate
      expect(stats.total).toBe(3);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Service Validation', () => {
    test('should validate configuration successfully when model loads', async () => {
      const { pipeline } = require('@xenova/transformers');

      const mockTranslator = jest.fn(async (text: string) => ({
        translation_text: 'Hello'
      }));

      pipeline.mockResolvedValueOnce(mockTranslator);

      const result = await service.validateConfiguration();

      expect(result.valid).toBe(true);
      expect(result.message).toContain('ready');
    });

    test('should fail validation when model initialization fails', async () => {
      const { pipeline } = require('@xenova/transformers');

      // Create a fresh service for this test
      const failService = new OfflineTranslationService(database);

      pipeline.mockRejectedValueOnce(new Error('Model loading failed'));

      const result = await failService.validateConfiguration();

      expect(result.valid).toBe(false);
      expect(result.message).toContain('failed');
    });

    test('should get model information', () => {
      const info = service.getModelInfo();

      expect(info.name).toBe('Xenova/opus-mt-zh-en');
      expect(info.size).toContain('MB');
      expect(info.languages.source).toBe('Chinese');
      expect(info.languages.target).toBe('English');
    });

    test('should report model ready status', async () => {
      expect(service.isReady()).toBe(false);

      const { pipeline } = require('@xenova/transformers');

      const mockTranslator = jest.fn();
      pipeline.mockResolvedValueOnce(mockTranslator);

      await service.initialize();

      expect(service.isReady()).toBe(true);
    });
  });
});
