/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment - Node.js for Electron main process
  testEnvironment: 'node',

  // Root directory for tests
  roots: ['<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        // Override tsconfig for tests
        target: 'ES2020',
        module: 'commonjs',
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        moduleResolution: 'node',
        types: ['jest', 'node']
      }
    }]
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Module paths for absolute imports
  modulePaths: ['<rootDir>/src'],

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },

  // Coverage collection
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/types/**',
    '!src/index.ts',
    '!src/main.ts',
    '!src/preload.ts'
  ],

  // Coverage thresholds (optional - can be enforced)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup files to run before tests
  setupFilesAfterEnv: [],

  // Test timeout (30 seconds for model loading tests)
  testTimeout: 30000,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/web/'
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Detect open handles (useful for debugging)
  detectOpenHandles: false,

  // Force exit after tests complete
  forceExit: true,

  // Global setup/teardown
  // globalSetup: undefined,
  // globalTeardown: undefined,
};
