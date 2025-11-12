#!/usr/bin/env node

/**
 * Build Verification Script
 *
 * This script verifies the build output to ensure:
 * - dist/ contains compiled Electron code
 * - web/dist/ contains React app
 * - No test files in build
 * - No source maps in production
 * - No sensitive files (.env, .git, etc.)
 * - Bundle size is within acceptable limits
 * - All critical files are present
 *
 * Exit codes:
 * 0 - All checks passed
 * 1 - One or more checks failed
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
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
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');

// Production mode check
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

// Verification results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

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
          // Ignore errors
        }
      }
    }
  } catch (err) {
    // Ignore errors
  }

  return size;
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
 * Find files matching pattern recursively
 */
function findFiles(dirPath, pattern) {
  const matches = [];

  if (!fs.existsSync(dirPath)) {
    return matches;
  }

  function scan(dir) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          scan(itemPath);
        } else if (item.isFile() && pattern.test(item.name)) {
          matches.push(path.relative(ROOT_DIR, itemPath));
        }
      }
    } catch (err) {
      // Ignore errors
    }
  }

  scan(dirPath);
  return matches;
}

/**
 * Check if directory exists and has files
 */
function checkDirectoryExists(dirPath, name) {
  if (!fs.existsSync(dirPath)) {
    results.failed.push(`${name} directory does not exist: ${dirPath}`);
    return false;
  }

  const fileCount = countFiles(dirPath);
  if (fileCount === 0) {
    results.failed.push(`${name} directory is empty: ${dirPath}`);
    return false;
  }

  results.passed.push(`${name} directory exists with ${fileCount} files`);
  return true;
}

/**
 * Check for critical files
 */
function checkCriticalFiles() {
  log.section('Checking critical files');

  const criticalFiles = [
    { path: path.join(DIST_DIR, 'main.js'), name: 'Main process entry point' },
    { path: path.join(DIST_DIR, 'preload.js'), name: 'Preload script' },
    { path: path.join(WEB_DIST_DIR, 'index.html'), name: 'React app entry point' },
    { path: PACKAGE_JSON, name: 'package.json' },
  ];

  let allPresent = true;

  for (const file of criticalFiles) {
    if (fs.existsSync(file.path)) {
      const stat = fs.statSync(file.path);
      results.passed.push(`${file.name}: ${formatBytes(stat.size)}`);
      log.success(`${file.name}: ${formatBytes(stat.size)}`);
    } else {
      results.failed.push(`${file.name} is missing: ${file.path}`);
      log.error(`${file.name} is missing`);
      allPresent = false;
    }
  }

  return allPresent;
}

/**
 * Check for test files
 */
function checkForTestFiles() {
  log.section('Checking for test files');

  const testPatterns = [
    /\.spec\.(js|ts)$/,
    /\.test\.(js|ts)$/,
  ];

  let foundTestFiles = [];

  for (const pattern of testPatterns) {
    foundTestFiles.push(...findFiles(DIST_DIR, pattern));
    foundTestFiles.push(...findFiles(WEB_DIST_DIR, pattern));
  }

  if (foundTestFiles.length > 0) {
    results.failed.push(`Found ${foundTestFiles.length} test files in build`);
    log.error(`Found ${foundTestFiles.length} test files:`);
    foundTestFiles.slice(0, 10).forEach(file => log.error(`  ${file}`));
    if (foundTestFiles.length > 10) {
      log.error(`  ... and ${foundTestFiles.length - 10} more`);
    }
    return false;
  }

  results.passed.push('No test files found in build');
  log.success('No test files found');
  return true;
}

/**
 * Check for source maps in production
 */
function checkForSourceMaps() {
  log.section('Checking for source maps');

  if (!isProduction) {
    log.info('Skipping source map check (development mode)');
    return true;
  }

  const mapPattern = /\.map$/;
  const sourceMaps = [
    ...findFiles(DIST_DIR, mapPattern),
    ...findFiles(WEB_DIST_DIR, mapPattern),
  ];

  if (sourceMaps.length > 0) {
    results.failed.push(`Found ${sourceMaps.length} source map files in production build`);
    log.error(`Found ${sourceMaps.length} source map files:`);
    sourceMaps.slice(0, 10).forEach(file => log.error(`  ${file}`));
    if (sourceMaps.length > 10) {
      log.error(`  ... and ${sourceMaps.length - 10} more`);
    }
    return false;
  }

  results.passed.push('No source maps found in production build');
  log.success('No source maps found');
  return true;
}

/**
 * Check for sensitive files
 */
function checkForSensitiveFiles() {
  log.section('Checking for sensitive files');

  const sensitivePatterns = [
    { pattern: /\.env/, name: 'Environment files' },
    { pattern: /\.git/, name: 'Git files' },
    { pattern: /\.vscode/, name: 'VS Code files' },
    { pattern: /\.idea/, name: 'IDE files' },
    { pattern: /\.DS_Store/, name: 'macOS files' },
    { pattern: /thumbs\.db/i, name: 'Windows thumbnail cache' },
  ];

  let foundSensitive = false;

  for (const { pattern, name } of sensitivePatterns) {
    const files = [
      ...findFiles(DIST_DIR, pattern),
      ...findFiles(WEB_DIST_DIR, pattern),
    ];

    if (files.length > 0) {
      results.warnings.push(`Found ${files.length} ${name} files`);
      log.warning(`Found ${files.length} ${name} files (will be excluded by electron-builder)`);
      foundSensitive = true;
    }
  }

  if (!foundSensitive) {
    results.passed.push('No sensitive files found');
    log.success('No sensitive files found');
  }

  return true; // Don't fail build, just warn
}

/**
 * Check bundle sizes
 */
function checkBundleSizes() {
  log.section('Checking bundle sizes');

  const distSize = getDirectorySize(DIST_DIR);
  const webDistSize = getDirectorySize(WEB_DIST_DIR);
  const totalSize = distSize + webDistSize;

  // Size limits (in bytes)
  const limits = {
    dist: 10 * 1024 * 1024, // 10 MB for Electron code
    webDist: 50 * 1024 * 1024, // 50 MB for React app
    total: 100 * 1024 * 1024, // 100 MB total (excluding node_modules)
  };

  log.info(`dist/ size: ${formatBytes(distSize)}`);
  log.info(`web/dist/ size: ${formatBytes(webDistSize)}`);
  log.info(`Total size: ${formatBytes(totalSize)}`);

  let sizesOk = true;

  if (distSize > limits.dist) {
    results.warnings.push(`dist/ size (${formatBytes(distSize)}) exceeds recommended limit (${formatBytes(limits.dist)})`);
    log.warning(`dist/ size exceeds recommended limit`);
  } else {
    results.passed.push(`dist/ size is within limits`);
  }

  if (webDistSize > limits.webDist) {
    results.warnings.push(`web/dist/ size (${formatBytes(webDistSize)}) exceeds recommended limit (${formatBytes(limits.webDist)})`);
    log.warning(`web/dist/ size exceeds recommended limit`);
  } else {
    results.passed.push(`web/dist/ size is within limits`);
  }

  if (totalSize > limits.total) {
    results.warnings.push(`Total size (${formatBytes(totalSize)}) exceeds recommended limit (${formatBytes(limits.total)})`);
    log.warning(`Total size exceeds recommended limit`);
  } else {
    results.passed.push(`Total size is within limits`);
  }

  return sizesOk;
}

/**
 * Verify package.json configuration
 */
function verifyPackageJson() {
  log.section('Verifying package.json');

  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));

    // Check main entry point
    if (pkg.main !== 'dist/main.js') {
      results.failed.push(`package.json main field should be "dist/main.js", got "${pkg.main}"`);
      log.error(`Incorrect main entry point: ${pkg.main}`);
      return false;
    }

    results.passed.push('package.json main entry point is correct');
    log.success('package.json configuration is correct');

    return true;
  } catch (err) {
    results.failed.push(`Failed to read package.json: ${err.message}`);
    log.error(`Failed to read package.json: ${err.message}`);
    return false;
  }
}

/**
 * Generate verification report
 */
function generateReport() {
  log.section('Verification Summary');

  const distSize = getDirectorySize(DIST_DIR);
  const webDistSize = getDirectorySize(WEB_DIST_DIR);
  const distFiles = countFiles(DIST_DIR);
  const webDistFiles = countFiles(WEB_DIST_DIR);

  console.log(`
  ${colors.bright}Build Statistics:${colors.reset}
    dist/         ${formatBytes(distSize).padStart(12)} (${distFiles} files)
    web/dist/     ${formatBytes(webDistSize).padStart(12)} (${webDistFiles} files)
    ${colors.dim}─────────────────────────────────────${colors.reset}
    ${colors.bright}Total:        ${formatBytes(distSize + webDistSize).padStart(12)} (${distFiles + webDistFiles} files)${colors.reset}

  ${colors.bright}Verification Results:${colors.reset}
    ${colors.green}Passed:       ${results.passed.length}${colors.reset}
    ${colors.yellow}Warnings:     ${results.warnings.length}${colors.reset}
    ${colors.red}Failed:       ${results.failed.length}${colors.reset}
  `);

  if (results.warnings.length > 0) {
    console.log(`${colors.yellow}${colors.bright}Warnings:${colors.reset}`);
    results.warnings.forEach(warning => log.warning(warning));
  }

  if (results.failed.length > 0) {
    console.log(`\n${colors.red}${colors.bright}Failed Checks:${colors.reset}`);
    results.failed.forEach(failure => log.error(failure));
  }

  // Save verification report
  const report = {
    timestamp: new Date().toISOString(),
    mode: isProduction ? 'production' : 'development',
    passed: results.passed.length,
    warnings: results.warnings.length,
    failed: results.failed.length,
    details: {
      passed: results.passed,
      warnings: results.warnings,
      failed: results.failed,
    },
    stats: {
      distSize: distSize,
      distSizeFormatted: formatBytes(distSize),
      distFiles: distFiles,
      webDistSize: webDistSize,
      webDistSizeFormatted: formatBytes(webDistSize),
      webDistFiles: webDistFiles,
      totalSize: distSize + webDistSize,
      totalSizeFormatted: formatBytes(distSize + webDistSize),
      totalFiles: distFiles + webDistFiles,
    },
  };

  const reportPath = path.join(ROOT_DIR, 'verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log.success(`Verification report saved to: verification-report.json`);
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════╗
║   Duckov Mod Manager - Build Verifier     ║
╚════════════════════════════════════════════╝${colors.reset}
  `);

  log.info(`Mode: ${isProduction ? 'Production' : 'Development'}`);
  log.info(`Root: ${ROOT_DIR}`);

  try {
    // Run all verification checks
    checkDirectoryExists(DIST_DIR, 'dist');
    checkDirectoryExists(WEB_DIST_DIR, 'web/dist');
    checkCriticalFiles();
    checkForTestFiles();
    checkForSourceMaps();
    checkForSensitiveFiles();
    checkBundleSizes();
    verifyPackageJson();

    // Generate report
    generateReport();

    // Exit with appropriate code
    if (results.failed.length > 0) {
      console.log(`\n${colors.red}${colors.bright}✗ Build verification failed!${colors.reset}\n`);
      process.exit(1);
    } else if (results.warnings.length > 0) {
      console.log(`\n${colors.yellow}${colors.bright}⚠ Build verification completed with warnings${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.green}${colors.bright}✓ Build verification passed!${colors.reset}\n`);
      process.exit(0);
    }
  } catch (error) {
    log.error(`Build verification failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
