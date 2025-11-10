/**
 * Electron Setup Verification Script
 * Checks that all required files and configurations are in place
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
let errors = 0;
let warnings = 0;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, required = true) {
  const absolutePath = path.join(ROOT_DIR, filePath);
  const exists = fs.existsSync(absolutePath);

  if (exists) {
    log(`✓ ${filePath}`, 'green');
    return true;
  } else {
    if (required) {
      log(`✗ ${filePath} - MISSING (required)`, 'red');
      errors++;
    } else {
      log(`⚠ ${filePath} - MISSING (optional)`, 'yellow');
      warnings++;
    }
    return false;
  }
}

function checkPackageJson() {
  log('\n📦 Checking package.json...', 'blue');

  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    log('✗ package.json not found', 'red');
    errors++;
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Check main entry point
  if (pkg.main === 'dist/main.js') {
    log('✓ Main entry point: dist/main.js', 'green');
  } else {
    log(`✗ Main entry point should be "dist/main.js", got "${pkg.main}"`, 'red');
    errors++;
  }

  // Check Electron dependencies
  const requiredDeps = {
    devDependencies: ['electron', 'electron-builder'],
    dependencies: ['electron-squirrel-startup']
  };

  for (const [depType, deps] of Object.entries(requiredDeps)) {
    for (const dep of deps) {
      if (pkg[depType] && pkg[depType][dep]) {
        log(`✓ ${dep} in ${depType}`, 'green');
      } else {
        log(`✗ ${dep} missing from ${depType}`, 'red');
        errors++;
      }
    }
  }

  // Check scripts
  const requiredScripts = [
    'build:electron',
    'electron:dev',
    'web:build',
    'web:dev',
    'dist'
  ];

  for (const script of requiredScripts) {
    if (pkg.scripts && pkg.scripts[script]) {
      log(`✓ Script: ${script}`, 'green');
    } else {
      log(`✗ Missing script: ${script}`, 'red');
      errors++;
    }
  }
}

function checkTsConfigs() {
  log('\n⚙️  Checking TypeScript configurations...', 'blue');

  // Check tsconfig.electron.json
  const electronTsConfigPath = path.join(ROOT_DIR, 'tsconfig.electron.json');
  if (fs.existsSync(electronTsConfigPath)) {
    log('✓ tsconfig.electron.json exists', 'green');

    try {
      const config = JSON.parse(fs.readFileSync(electronTsConfigPath, 'utf8'));

      // Check it includes main.ts and preload.ts
      if (config.include &&
          config.include.includes('src/main.ts') &&
          config.include.includes('src/preload.ts')) {
        log('✓ Includes main.ts and preload.ts', 'green');
      } else {
        log('⚠ Should include src/main.ts and src/preload.ts', 'yellow');
        warnings++;
      }

      // Check outDir
      if (config.compilerOptions && config.compilerOptions.outDir === './dist') {
        log('✓ Output directory: ./dist', 'green');
      } else {
        log('⚠ Output directory should be ./dist', 'yellow');
        warnings++;
      }
    } catch (e) {
      log(`✗ Invalid JSON in tsconfig.electron.json: ${e.message}`, 'red');
      errors++;
    }
  } else {
    log('✗ tsconfig.electron.json missing', 'red');
    errors++;
  }
}

function checkElectronBuilder() {
  log('\n🔨 Checking Electron Builder configuration...', 'blue');

  const builderConfigPath = path.join(ROOT_DIR, 'electron-builder.json');
  if (fs.existsSync(builderConfigPath)) {
    log('✓ electron-builder.json exists', 'green');

    try {
      const config = JSON.parse(fs.readFileSync(builderConfigPath, 'utf8'));

      // Check appId
      if (config.appId) {
        log(`✓ App ID: ${config.appId}`, 'green');
      } else {
        log('✗ Missing appId in electron-builder.json', 'red');
        errors++;
      }

      // Check files include
      if (config.files &&
          config.files.includes('dist/**/*') &&
          config.files.includes('web/dist/**/*')) {
        log('✓ Files include dist/**/* and web/dist/**/*', 'green');
      } else {
        log('⚠ Files should include dist/**/* and web/dist/**/*', 'yellow');
        warnings++;
      }

      // Check extraMetadata.main
      if (config.extraMetadata && config.extraMetadata.main === 'dist/main.js') {
        log('✓ Extra metadata main: dist/main.js', 'green');
      } else {
        log('⚠ extraMetadata.main should be dist/main.js', 'yellow');
        warnings++;
      }
    } catch (e) {
      log(`✗ Invalid JSON in electron-builder.json: ${e.message}`, 'red');
      errors++;
    }
  } else {
    log('✗ electron-builder.json missing', 'red');
    errors++;
  }
}

function checkEnvironment() {
  log('\n🌍 Checking environment configuration...', 'blue');

  // Check .env.example exists
  checkFileExists('.env.example', true);

  // Check .env exists (optional but recommended)
  if (!checkFileExists('.env', false)) {
    log('  ℹ️  Create .env from .env.example for local development', 'gray');
  }

  // Check .env.example has required variables
  const envExamplePath = path.join(ROOT_DIR, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    const requiredVars = [
      'NODE_ENV',
      'VITE_DEV_SERVER_URL',
      'STEAM_APP_ID',
      'WORKSHOP_DATA_PATH'
    ];

    for (const varName of requiredVars) {
      if (envContent.includes(varName)) {
        log(`✓ .env.example includes ${varName}`, 'green');
      } else {
        log(`⚠ .env.example missing ${varName}`, 'yellow');
        warnings++;
      }
    }
  }
}

function checkDirectoryStructure() {
  log('\n📁 Checking directory structure...', 'blue');

  const requiredDirs = [
    'src',
    'src/types',
    'src/services',
    'src/database',
    'src/utils',
    'web'
  ];

  for (const dir of requiredDirs) {
    checkFileExists(dir, true);
  }

  const optionalDirs = [
    'dist',
    'data',
    'build',
    'release'
  ];

  for (const dir of optionalDirs) {
    checkFileExists(dir, false);
  }
}

function checkSourceFiles() {
  log('\n📄 Checking source files...', 'blue');

  const requiredFiles = [
    'src/main.ts',
    'src/preload.ts',
    'src/types/electron.ts',
    'src/types/index.ts',
    'src/database/Database.ts',
    'src/services/ModService.ts',
    'src/utils/logger.ts'
  ];

  for (const file of requiredFiles) {
    checkFileExists(file, true);
  }
}

function checkGitIgnore() {
  log('\n🚫 Checking .gitignore...', 'blue');

  const gitignorePath = path.join(ROOT_DIR, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    log('✓ .gitignore exists', 'green');

    const content = fs.readFileSync(gitignorePath, 'utf8');
    const requiredEntries = [
      'dist',
      'release',
      'node_modules',
      '.env'
    ];

    for (const entry of requiredEntries) {
      if (content.includes(entry)) {
        log(`✓ .gitignore includes ${entry}`, 'green');
      } else {
        log(`⚠ .gitignore should include ${entry}`, 'yellow');
        warnings++;
      }
    }
  } else {
    log('⚠ .gitignore not found', 'yellow');
    warnings++;
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), 'blue');
  log('VERIFICATION SUMMARY', 'blue');
  log('='.repeat(60), 'blue');

  if (errors === 0 && warnings === 0) {
    log('\n✅ All checks passed! Your Electron setup is ready.', 'green');
    log('\nNext steps:', 'blue');
    log('  1. Copy .env.example to .env and configure it', 'gray');
    log('  2. Run: npm install', 'gray');
    log('  3. Run: npm run build:electron', 'gray');
    log('  4. Run: npm run web:dev (in one terminal)', 'gray');
    log('  5. Run: npm run electron:dev (in another terminal)', 'gray');
  } else {
    if (errors > 0) {
      log(`\n❌ ${errors} error(s) found. Please fix them before proceeding.`, 'red');
    }
    if (warnings > 0) {
      log(`⚠️  ${warnings} warning(s) found. Review recommended.`, 'yellow');
    }

    log('\nRefer to ELECTRON_SETUP.md for detailed setup instructions.', 'gray');
  }

  log('');
}

// Run all checks
function runAllChecks() {
  log('🔍 Verifying Electron Setup...', 'blue');
  log('='.repeat(60) + '\n', 'blue');

  checkPackageJson();
  checkTsConfigs();
  checkElectronBuilder();
  checkEnvironment();
  checkDirectoryStructure();
  checkSourceFiles();
  checkGitIgnore();
  printSummary();

  // Exit with error code if there are errors
  process.exit(errors > 0 ? 1 : 0);
}

runAllChecks();
