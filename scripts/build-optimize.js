#!/usr/bin/env node

/**
 * Build Optimization Script
 *
 * This script runs after builds to optimize the output by:
 * - Removing test files and fixtures
 * - Removing unnecessary map files
 * - Cleaning up node_modules (keeping only production)
 * - Generating build size report
 * - Verifying all dependencies are included
 * - Checking for files that should be excluded
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Use picomatch as an alternative to minimatch (already available via vite dependencies)
let picomatch;
try {
  picomatch = require('picomatch');
} catch {
  // Fallback: simple glob matching function
  picomatch = (pattern) => {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '[\\\\/]');
    const regex = new RegExp(`^${regexPattern}$`);
    return (str) => regex.test(str);
  };
}

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}▶ ${msg}${colors.reset}`),
};

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const WEB_DIST_DIR = path.join(ROOT_DIR, 'web', 'dist');
const NODE_MODULES_DIR = path.join(ROOT_DIR, 'node_modules');

// Patterns to remove
const PATTERNS_TO_REMOVE = [
  '**/*.spec.js',
  '**/*.test.js',
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/test/**',
  '**/tests/**',
  '**/fixtures/**',
  '**/*.d.ts.map',
];

// Production-only mode flag
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

// Stats tracking
const stats = {
  filesRemoved: 0,
  bytesFreed: 0,
  warnings: [],
  errors: [],
};

/**
 * Get directory size recursively
 */
function getDirectorySize(dirPath) {
  let size = 0;

  if (!fs.existsSync(dirPath)) {
    return size;
  }

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        size += getDirectorySize(itemPath);
      } else if (item.isFile()) {
        try {
          const stat = fs.statSync(itemPath);
          size += stat.size;
        } catch (err) {
          // Ignore errors for inaccessible files
        }
      }
    }
  } catch (err) {
    stats.warnings.push(`Could not read directory: ${dirPath}`);
  }

  return size;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Count files in directory recursively
 */
function countFiles(dirPath) {
  let count = 0;

  if (!fs.existsSync(dirPath)) {
    return count;
  }

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        count += countFiles(itemPath);
      } else if (item.isFile()) {
        count++;
      }
    }
  } catch (err) {
    // Ignore errors
  }

  return count;
}

/**
 * Remove files matching patterns
 */
function removeMatchingFiles(dirPath, patterns) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  // Create matchers for each pattern
  const matchers = patterns.map(pattern => {
    if (typeof picomatch === 'function') {
      return picomatch(pattern);
    }
    return picomatch(pattern);
  });

  function scanDirectory(dir, baseDir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      const relativePath = path.relative(baseDir, itemPath).replace(/\\/g, '/');

      if (item.isDirectory()) {
        // Check if directory matches any pattern
        const shouldRemove = matchers.some(matcher => matcher(relativePath));

        if (shouldRemove) {
          const size = getDirectorySize(itemPath);
          fs.rmSync(itemPath, { recursive: true, force: true });
          stats.filesRemoved++;
          stats.bytesFreed += size;
          log.info(`Removed directory: ${relativePath} (${formatBytes(size)})`);
        } else {
          scanDirectory(itemPath, baseDir);
        }
      } else if (item.isFile()) {
        // Check if file matches any pattern
        const shouldRemove = matchers.some(matcher => matcher(relativePath));

        if (shouldRemove) {
          try {
            const stat = fs.statSync(itemPath);
            fs.unlinkSync(itemPath);
            stats.filesRemoved++;
            stats.bytesFreed += stat.size;
            log.info(`Removed file: ${relativePath} (${formatBytes(stat.size)})`);
          } catch (err) {
            stats.warnings.push(`Could not remove file: ${relativePath}`);
          }
        }
      }
    }
  }

  scanDirectory(dirPath, dirPath);
}

/**
 * Remove source maps in production
 */
function removeSourceMaps() {
  if (!isProduction) {
    log.info('Skipping source map removal (development mode)');
    return;
  }

  log.section('Removing source maps for production');

  const mapPatterns = ['**/*.map', '**/*.js.map', '**/*.css.map'];

  if (fs.existsSync(DIST_DIR)) {
    removeMatchingFiles(DIST_DIR, mapPatterns);
  }

  if (fs.existsSync(WEB_DIST_DIR)) {
    removeMatchingFiles(WEB_DIST_DIR, mapPatterns);
  }
}

/**
 * Clean node_modules (production only)
 */
function cleanNodeModules() {
  log.section('Analyzing node_modules');

  if (!fs.existsSync(NODE_MODULES_DIR)) {
    log.warning('node_modules directory not found');
    return;
  }

  const beforeSize = getDirectorySize(NODE_MODULES_DIR);
  log.info(`node_modules size: ${formatBytes(beforeSize)}`);

  // Remove unnecessary files from node_modules
  const nodeModulesPatterns = [
    '**/node_modules/**/*.md',
    '**/node_modules/**/LICENSE',
    '**/node_modules/**/CHANGELOG*',
    '**/node_modules/**/test/**',
    '**/node_modules/**/tests/**',
    '**/node_modules/**/__tests__/**',
    '**/node_modules/**/example/**',
    '**/node_modules/**/examples/**',
    '**/node_modules/**/.bin/**',
    '**/node_modules/**/*.d.ts',
  ];

  removeMatchingFiles(NODE_MODULES_DIR, nodeModulesPatterns);

  const afterSize = getDirectorySize(NODE_MODULES_DIR);
  const saved = beforeSize - afterSize;

  if (saved > 0) {
    log.success(`Cleaned node_modules: saved ${formatBytes(saved)}`);
  }
}

/**
 * Verify critical dependencies are present
 */
function verifyDependencies() {
  log.section('Verifying dependencies');

  const criticalDeps = [
    'electron',
    'better-sqlite3',
    'axios',
    'cheerio',
    'archiver',
    'xml2js',
    '@xenova/transformers',
    'node-cache',
  ];

  let allPresent = true;

  for (const dep of criticalDeps) {
    const depPath = path.join(NODE_MODULES_DIR, dep);
    if (fs.existsSync(depPath)) {
      log.success(`Found: ${dep}`);
    } else {
      log.error(`Missing: ${dep}`);
      stats.errors.push(`Critical dependency missing: ${dep}`);
      allPresent = false;
    }
  }

  return allPresent;
}

/**
 * Check for files that shouldn't be in the build
 */
function checkForExcludedFiles() {
  log.section('Checking for excluded files');

  const shouldNotExist = [
    '.env',
    '.env.local',
    '.env.production',
    '.git',
    'test-data',
    'coverage',
    '.vscode',
    '.idea',
    'tsconfig.json',
    'tsconfig.electron.json',
    'vite.config.ts',
  ];

  for (const item of shouldNotExist) {
    const itemPath = path.join(ROOT_DIR, item);
    if (fs.existsSync(itemPath)) {
      stats.warnings.push(`Found file that should be excluded: ${item}`);
      log.warning(`Found: ${item} (will be excluded by electron-builder)`);
    }
  }
}

/**
 * Generate build size report
 */
function generateSizeReport() {
  log.section('Build Size Report');

  const distSize = getDirectorySize(DIST_DIR);
  const webDistSize = getDirectorySize(WEB_DIST_DIR);
  const nodeModulesSize = getDirectorySize(NODE_MODULES_DIR);
  const totalSize = distSize + webDistSize + nodeModulesSize;

  const distFiles = countFiles(DIST_DIR);
  const webDistFiles = countFiles(WEB_DIST_DIR);
  const nodeModulesFiles = countFiles(NODE_MODULES_DIR);
  const totalFiles = distFiles + webDistFiles + nodeModulesFiles;

  const report = {
    timestamp: new Date().toISOString(),
    directories: {
      dist: {
        size: distSize,
        sizeFormatted: formatBytes(distSize),
        files: distFiles,
      },
      webDist: {
        size: webDistSize,
        sizeFormatted: formatBytes(webDistSize),
        files: webDistFiles,
      },
      nodeModules: {
        size: nodeModulesSize,
        sizeFormatted: formatBytes(nodeModulesSize),
        files: nodeModulesFiles,
      },
    },
    total: {
      size: totalSize,
      sizeFormatted: formatBytes(totalSize),
      files: totalFiles,
    },
    optimization: {
      filesRemoved: stats.filesRemoved,
      bytesFreed: stats.bytesFreed,
      bytesFreedFormatted: formatBytes(stats.bytesFreed),
    },
  };

  console.log(`
  ${colors.bright}Directory Breakdown:${colors.reset}
    dist/           ${formatBytes(distSize).padStart(12)} (${distFiles} files)
    web/dist/       ${formatBytes(webDistSize).padStart(12)} (${webDistFiles} files)
    node_modules/   ${formatBytes(nodeModulesSize).padStart(12)} (${nodeModulesFiles} files)
    ${colors.dim}─────────────────────────────────────${colors.reset}
    ${colors.bright}Total:          ${formatBytes(totalSize).padStart(12)} (${totalFiles} files)${colors.reset}

  ${colors.bright}Optimization Results:${colors.reset}
    Files removed:  ${stats.filesRemoved}
    Space freed:    ${formatBytes(stats.bytesFreed)}
  `);

  // Save report to file
  const reportPath = path.join(ROOT_DIR, 'build-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.success(`Build report saved to: build-report.json`);

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════╗
║   Duckov Mod Manager - Build Optimizer    ║
╚════════════════════════════════════════════╝${colors.reset}
  `);

  log.info(`Mode: ${isProduction ? 'Production' : 'Development'}`);
  log.info(`Root: ${ROOT_DIR}`);

  try {
    // Ensure minimatch is installed
    try {
      require('minimatch');
    } catch (err) {
      log.info('Installing minimatch for pattern matching...');
      execSync('npm install minimatch', { stdio: 'inherit', cwd: ROOT_DIR });
    }

    // Remove test files and fixtures
    log.section('Removing test files and fixtures');
    if (fs.existsSync(DIST_DIR)) {
      removeMatchingFiles(DIST_DIR, PATTERNS_TO_REMOVE);
    }
    if (fs.existsSync(WEB_DIST_DIR)) {
      removeMatchingFiles(WEB_DIST_DIR, PATTERNS_TO_REMOVE);
    }

    // Remove source maps in production
    removeSourceMaps();

    // Clean node_modules
    cleanNodeModules();

    // Verify dependencies
    const depsOk = verifyDependencies();

    // Check for excluded files
    checkForExcludedFiles();

    // Generate size report
    generateSizeReport();

    // Print warnings
    if (stats.warnings.length > 0) {
      log.section('Warnings');
      stats.warnings.forEach(warning => log.warning(warning));
    }

    // Print errors
    if (stats.errors.length > 0) {
      log.section('Errors');
      stats.errors.forEach(error => log.error(error));
      process.exit(1);
    }

    console.log(`\n${colors.green}${colors.bright}✓ Build optimization completed successfully!${colors.reset}\n`);
  } catch (error) {
    log.error(`Build optimization failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
