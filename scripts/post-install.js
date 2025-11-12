#!/usr/bin/env node

/**
 * Post-Installation Setup Script
 *
 * This script runs after npm install to:
 * - Verify the installation
 * - Set up necessary directories
 * - Check dependencies
 * - Provide setup guidance
 *
 * This is NOT the Electron app installer script.
 * This runs during development setup (npm install).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
const REQUIRED_DIRS = [
  'dist',
  'web/dist',
  'data',
  'build',
];

const REQUIRED_FILES = [
  'package.json',
  'tsconfig.json',
  'tsconfig.electron.json',
  'electron-builder.json',
  'vite.config.ts',
];

/**
 * Check if we're in a development environment
 */
function isDevelopmentEnvironment() {
  // Check if we're in a production npm install (user installing the app)
  // vs development install (developer setting up the project)
  const isProduction = process.env.NODE_ENV === 'production';
  const hasDevDependencies = fs.existsSync(path.join(ROOT_DIR, 'node_modules', '@types'));

  // If we have dev dependencies, we're in development
  return hasDevDependencies && !isProduction;
}

/**
 * Create directory if it doesn't exist
 */
function ensureDirectory(dirPath) {
  const fullPath = path.join(ROOT_DIR, dirPath);

  if (!fs.existsSync(fullPath)) {
    try {
      fs.mkdirSync(fullPath, { recursive: true });
      log.success(`Created directory: ${dirPath}`);
      return true;
    } catch (err) {
      log.error(`Failed to create directory ${dirPath}: ${err.message}`);
      return false;
    }
  }

  log.info(`Directory already exists: ${dirPath}`);
  return true;
}

/**
 * Check if file exists
 */
function checkFile(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);

  if (fs.existsSync(fullPath)) {
    log.success(`Found: ${filePath}`);
    return true;
  } else {
    log.error(`Missing: ${filePath}`);
    return false;
  }
}

/**
 * Create .env.example if it doesn't exist
 */
function createEnvExample() {
  const envExamplePath = path.join(ROOT_DIR, '.env.example');

  if (fs.existsSync(envExamplePath)) {
    log.info('.env.example already exists');
    return;
  }

  const envExampleContent = `# Duckov Mod Manager - Environment Variables
# Copy this file to .env and configure for your environment

# Workshop folder path (required for mod scanning)
# Example Windows: C:/Program Files (x86)/Steam/steamapps/workshop/content/2618920
# Example macOS: ~/Library/Application Support/Steam/steamapps/workshop/content/2618920
# Example Linux: ~/.steam/steam/steamapps/workshop/content/2618920
WORKSHOP_DATA_PATH=

# Database path (optional, defaults to userData directory)
# DB_PATH=./data/mods.db

# Translation cache TTL in days (optional, default: 30)
# TRANSLATION_CACHE_TTL_DAYS=30

# Development mode (optional)
# NODE_ENV=development

# Vite dev server URL (development only)
# VITE_DEV_SERVER_URL=http://localhost:3001

# Enable debug logging (optional)
# DEBUG=true
`;

  try {
    fs.writeFileSync(envExamplePath, envExampleContent);
    log.success('Created .env.example');
  } catch (err) {
    log.warning(`Could not create .env.example: ${err.message}`);
  }
}

/**
 * Create .gitignore if it doesn't exist
 */
function createGitignore() {
  const gitignorePath = path.join(ROOT_DIR, '.gitignore');

  if (fs.existsSync(gitignorePath)) {
    log.info('.gitignore already exists');
    return;
  }

  const gitignoreContent = `# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build outputs
dist/
web/dist/
release/

# Environment variables
.env
.env.local
.env.production

# Database
data/*.db
data/*.db-journal

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Test coverage
coverage/

# Build reports
build-report.json
verification-report.json

# Temporary files
tmp/
temp/
*.tmp
`;

  try {
    fs.writeFileSync(gitignorePath, gitignoreContent);
    log.success('Created .gitignore');
  } catch (err) {
    log.warning(`Could not create .gitignore: ${err.message}`);
  }
}

/**
 * Check Node.js version
 */
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

  log.info(`Node.js version: ${nodeVersion}`);

  if (majorVersion < 16) {
    log.error('Node.js 16 or higher is required');
    return false;
  }

  if (majorVersion < 18) {
    log.warning('Node.js 18 or higher is recommended');
  } else {
    log.success('Node.js version is compatible');
  }

  return true;
}

/**
 * Check if electron-builder dependencies are installed
 */
function checkElectronBuilder() {
  const electronBuilderPath = path.join(ROOT_DIR, 'node_modules', 'electron-builder');

  if (fs.existsSync(electronBuilderPath)) {
    log.success('electron-builder is installed');
    return true;
  } else {
    log.warning('electron-builder not found (this is okay for production installs)');
    return false;
  }
}

/**
 * Verify TypeScript installation
 */
function checkTypeScript() {
  const tsPath = path.join(ROOT_DIR, 'node_modules', 'typescript');

  if (fs.existsSync(tsPath)) {
    try {
      const tscVersion = execSync('npx tsc --version', {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      log.success(`TypeScript installed: ${tscVersion}`);
      return true;
    } catch (err) {
      log.warning('TypeScript installed but tsc command failed');
      return false;
    }
  } else {
    log.warning('TypeScript not found (this is okay for production installs)');
    return false;
  }
}

/**
 * Create README for build directory
 */
function createBuildDirReadme() {
  const buildDir = path.join(ROOT_DIR, 'build');
  const readmePath = path.join(buildDir, 'README.md');

  if (fs.existsSync(readmePath)) {
    return;
  }

  const readmeContent = `# Build Resources

This directory contains resources for electron-builder packaging.

## Required Files

### Icons

**Windows**:
- \`icon.ico\` - Application icon (256x256 or multi-size ICO)
- \`file-icon.ico\` - File association icon (256x256)

**macOS**:
- \`icon.icns\` - Application icon (512x512@2x or ICNS with multiple sizes)
- \`background.tiff\` - DMG background image (540x380)

**Linux**:
- \`icons/\` directory with multiple PNG sizes:
  - 16x16.png
  - 32x32.png
  - 48x48.png
  - 64x64.png
  - 128x128.png
  - 256x256.png
  - 512x512.png

### Installer Graphics (Windows)

- \`installerHeader.bmp\` - NSIS installer header (150x57, BMP 24-bit)
- \`installerSidebar.bmp\` - NSIS installer sidebar (164x314, BMP 24-bit)

### Optional Files

- \`installer.nsh\` - Custom NSIS script (for advanced installer customization)
- \`entitlements.mac.plist\` - macOS entitlements (for code signing)
- \`notarize.js\` - macOS notarization script (for App Store distribution)

## Creating Icons

### From PNG to ICO (Windows)

Use online tools or ImageMagick:
\`\`\`bash
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
\`\`\`

### From PNG to ICNS (macOS)

Use \`iconutil\` or online tools:
\`\`\`bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
\`\`\`

## Notes

- All icons should be created from high-resolution source images (at least 1024x1024)
- Windows ICO files can contain multiple sizes in one file
- macOS ICNS files should contain multiple resolutions for Retina display support
- Installer graphics should follow the exact dimensions specified
- BMP files for Windows installers must be 24-bit (not 32-bit with alpha)

## Placeholder Files

If you don't have custom icons yet, you can use placeholder files.
electron-builder will generate basic icons, but custom icons are recommended for production releases.
`;

  try {
    fs.writeFileSync(readmePath, readmeContent);
    log.success('Created build/README.md');
  } catch (err) {
    log.warning(`Could not create build/README.md: ${err.message}`);
  }
}

/**
 * Print next steps for developers
 */
function printNextSteps() {
  log.section('Next Steps');

  console.log(`
${colors.bright}Development Setup:${colors.reset}

  1. Configure environment variables:
     ${colors.dim}cp .env.example .env${colors.reset}
     Then edit .env with your workshop path

  2. Build the application:
     ${colors.dim}npm run build${colors.reset}

  3. Run in development mode:
     ${colors.dim}npm run electron:dev${colors.reset}

${colors.bright}Building for Distribution:${colors.reset}

  4. Create production build:
     ${colors.dim}npm run build:prod${colors.reset}

  5. Package for your platform:
     ${colors.dim}npm run dist${colors.reset}
     Or specific platform:
     ${colors.dim}npm run dist:win${colors.reset}   (Windows)
     ${colors.dim}npm run dist:mac${colors.reset}   (macOS)
     ${colors.dim}npm run dist:linux${colors.reset} (Linux)

${colors.bright}Documentation:${colors.reset}

  - ${colors.cyan}GETTING_STARTED.md${colors.reset} - User quick start guide
  - ${colors.cyan}DEPLOYMENT.md${colors.reset} - Installation and deployment
  - ${colors.cyan}DEVELOPMENT.md${colors.reset} - Developer guide
  - ${colors.cyan}ARCHITECTURE.md${colors.reset} - Technical architecture

${colors.bright}Useful Commands:${colors.reset}

  - ${colors.dim}npm run clean${colors.reset} - Clean build artifacts
  - ${colors.dim}npm run test${colors.reset} - Run tests
  - ${colors.dim}npm run lint${colors.reset} - Check code quality
  - ${colors.dim}npm run build:verify${colors.reset} - Verify build output

${colors.green}${colors.bright}Setup complete! Happy coding!${colors.reset}
  `);
}

/**
 * Print production install message
 */
function printProductionMessage() {
  log.section('Installation Complete');

  console.log(`
${colors.bright}Duckov Mod Manager${colors.reset} has been installed successfully.

This appears to be a production installation.
For development setup, clone the repository and run ${colors.dim}npm install${colors.reset}.

${colors.cyan}See documentation for usage instructions.${colors.reset}
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════╗
║   Duckov Mod Manager - Post-Install       ║
╚════════════════════════════════════════════╝${colors.reset}
  `);

  // Check if this is a development install
  const isDev = isDevelopmentEnvironment();

  if (!isDev) {
    printProductionMessage();
    return;
  }

  log.info('Running post-installation setup...');

  try {
    // Check Node.js version
    log.section('Checking System Requirements');
    checkNodeVersion();

    // Check TypeScript and electron-builder
    log.section('Checking Development Tools');
    checkTypeScript();
    checkElectronBuilder();

    // Create necessary directories
    log.section('Setting Up Directories');
    let allDirsCreated = true;
    for (const dir of REQUIRED_DIRS) {
      if (!ensureDirectory(dir)) {
        allDirsCreated = false;
      }
    }

    // Check required files
    log.section('Checking Required Files');
    let allFilesPresent = true;
    for (const file of REQUIRED_FILES) {
      if (!checkFile(file)) {
        allFilesPresent = false;
      }
    }

    // Create configuration files
    log.section('Creating Configuration Files');
    createEnvExample();
    createGitignore();
    createBuildDirReadme();

    // Print next steps
    printNextSteps();

    // Summary
    if (!allFilesPresent) {
      log.warning('Some required files are missing. The project may not build correctly.');
    }

    if (!allDirsCreated) {
      log.warning('Some directories could not be created. Check permissions.');
    }

    log.success('Post-installation setup complete!');

  } catch (error) {
    log.error(`Post-installation setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
