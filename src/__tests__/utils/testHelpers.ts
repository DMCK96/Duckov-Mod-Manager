/**
 * Test Helpers - Utilities for testing Duckov Mod Manager
 *
 * Provides mock objects, database helpers, and cleanup utilities
 * for comprehensive unit testing.
 */

import { ModInfo, CachedTranslation } from '../../types';
import path from 'path';
import fs from 'fs';
import { Database } from '../../database/Database';

/**
 * Creates a temporary test database path
 * Each test gets its own isolated database
 */
export function createTestDbPath(testName: string): string {
  const testDir = path.join(process.cwd(), 'test-data', testName);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  return path.join(testDir, 'test.db');
}

/**
 * Cleans up test database and directory
 */
export function cleanupTestDb(testName: string): void {
  const testDir = path.join(process.cwd(), 'test-data', testName);
  if (fs.existsSync(testDir)) {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup test directory: ${testDir}`, error);
    }
  }
}

/**
 * Initializes a test database instance
 */
export async function createTestDatabase(testName: string): Promise<Database> {
  const dbPath = createTestDbPath(testName);
  process.env.DB_PATH = dbPath;

  const db = new Database();
  await db.initialize();
  return db;
}

/**
 * Creates a mock ModInfo object for testing
 */
export function createMockMod(overrides: Partial<ModInfo> = {}): ModInfo {
  const now = new Date();

  return {
    id: '12345',
    title: '测试模组',
    description: '这是一个测试模组的描述',
    originalTitle: undefined,
    originalDescription: undefined,
    translatedTitle: undefined,
    translatedDescription: undefined,
    creator: 'TestCreator',
    previewUrl: 'https://example.com/preview.jpg',
    fileSize: 1024000,
    subscriptions: 100,
    rating: 4.5,
    tags: ['gameplay', 'weapons'],
    timeCreated: now,
    timeUpdated: now,
    language: 'zh',
    ...overrides
  };
}

/**
 * Creates a mock translated ModInfo object
 */
export function createMockTranslatedMod(overrides: Partial<ModInfo> = {}): ModInfo {
  const mock = createMockMod(overrides);

  return {
    ...mock,
    originalTitle: mock.title,
    originalDescription: mock.description,
    translatedTitle: 'Test Mod',
    translatedDescription: 'This is a test mod description',
    lastTranslated: new Date(),
    ...overrides
  };
}

/**
 * Creates a mock CachedTranslation object
 */
export function createMockTranslation(overrides: Partial<CachedTranslation> = {}): CachedTranslation {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

  return {
    originalText: '你好世界',
    translatedText: 'Hello World',
    sourceLang: 'zh',
    targetLang: 'en',
    createdAt: now,
    expiresAt: expiresAt,
    ...overrides
  };
}

/**
 * Creates multiple mock mods for batch testing
 */
export function createMockMods(count: number): ModInfo[] {
  const mods: ModInfo[] = [];

  for (let i = 0; i < count; i++) {
    mods.push(createMockMod({
      id: `${10000 + i}`,
      title: `测试模组 ${i + 1}`,
      description: `模组描述 ${i + 1}`,
      subscriptions: 100 + i * 10
    }));
  }

  return mods;
}

/**
 * Creates a temporary workshop directory for testing
 */
export function createTestWorkshopDir(testName: string): string {
  const workshopDir = path.join(process.cwd(), 'test-data', testName, 'workshop');
  if (!fs.existsSync(workshopDir)) {
    fs.mkdirSync(workshopDir, { recursive: true });
  }
  return workshopDir;
}

/**
 * Creates a mock mod folder in the workshop directory
 */
export function createMockModFolder(workshopDir: string, modId: string, fileCount: number = 5): string {
  const modPath = path.join(workshopDir, modId);
  fs.mkdirSync(modPath, { recursive: true });

  // Create some dummy files
  for (let i = 0; i < fileCount; i++) {
    const filePath = path.join(modPath, `file${i}.txt`);
    fs.writeFileSync(filePath, `Mock file content ${i}`);
  }

  return modPath;
}

/**
 * Cleans up test workshop directory
 */
export function cleanupTestWorkshopDir(testName: string): void {
  const testDir = path.join(process.cwd(), 'test-data', testName);
  if (fs.existsSync(testDir)) {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup test workshop directory: ${testDir}`, error);
    }
  }
}

/**
 * Waits for a specified amount of time (useful for async tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock logger for tests (suppresses console output)
 */
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

/**
 * Creates a mock Pipeline for translation testing
 */
export function createMockTranslationPipeline(mockTranslations: Record<string, string> = {}) {
  const defaultTranslations: Record<string, string> = {
    '你好': 'Hello',
    '世界': 'World',
    '测试': 'Test',
    '这是一个测试': 'This is a test',
    ...mockTranslations
  };

  return jest.fn(async (text: string) => {
    // Simulate some processing time
    await wait(10);

    const translation = defaultTranslations[text] || `Translated: ${text}`;
    return {
      translation_text: translation
    };
  });
}

/**
 * Mock electron app object for testing
 */
export const mockElectronApp = {
  getPath: jest.fn((name: string) => {
    if (name === 'userData') {
      return path.join(process.cwd(), 'test-data', 'userData');
    }
    return path.join(process.cwd(), 'test-data');
  }),
  isReady: jest.fn(() => true),
  on: jest.fn()
};

/**
 * Setup mock electron environment
 */
export function setupMockElectron(): void {
  // Mock electron module
  jest.mock('electron', () => ({
    app: mockElectronApp
  }), { virtual: true });
}

/**
 * Cleanup all test data
 */
export function cleanupAllTestData(): void {
  const testDataDir = path.join(process.cwd(), 'test-data');
  if (fs.existsSync(testDataDir)) {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test-data directory:', error);
    }
  }
}

/**
 * Assert that a value is defined (TypeScript type guard)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

/**
 * Creates a spy on console methods to suppress output during tests
 */
export function suppressConsoleOutput(): {
  restore: () => void;
} {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalDebug = console.debug;

  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();

  return {
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.debug = originalDebug;
    }
  };
}
