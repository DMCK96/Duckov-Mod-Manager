# Duckov Mod Manager - Deployment Guide

> Comprehensive installation and deployment documentation for Duckov Mod Manager v1.0.0

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation](#installation)
  - [Windows Installation](#windows-installation)
  - [macOS Installation](#macos-installation)
  - [Linux Installation](#linux-installation)
- [Initial Configuration](#initial-configuration)
- [First Run Setup](#first-run-setup)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)
- [Updates](#updates)
- [Advanced Configuration](#advanced-configuration)

---

## System Requirements

### Minimum Requirements

**Windows**
- OS: Windows 10 (64-bit) or later
- Processor: Intel Core i3 or equivalent
- RAM: 4 GB
- Storage: 2 GB free space (plus space for translation models ~1-2 GB)
- Display: 1024x768 minimum resolution

**macOS**
- OS: macOS 10.15 (Catalina) or later
- Processor: Intel or Apple Silicon (M1/M2)
- RAM: 4 GB
- Storage: 2 GB free space (plus space for translation models ~1-2 GB)
- Display: 1024x768 minimum resolution

**Linux**
- OS: Ubuntu 20.04+, Fedora 35+, or equivalent
- Processor: Intel Core i3 or equivalent
- RAM: 4 GB
- Storage: 2 GB free space (plus space for translation models ~1-2 GB)
- Display: 1024x768 minimum resolution
- Dependencies: gconf2, libnotify4, libxtst6, libnss3

### Recommended Requirements

- Processor: Intel Core i5 or equivalent (for faster translation)
- RAM: 8 GB or more
- Storage: SSD with 5 GB+ free space
- Display: 1920x1080 or higher

### Network Requirements

- **Initial Setup**: Internet connection required for first-time translation model download (~500 MB - 1 GB)
- **Operation**: No internet connection required after initial setup
- **Note**: All features work 100% offline after model download

---

## Installation

### Windows Installation

#### Method 1: NSIS Installer (Recommended)

1. **Download the Installer**
   - Download `Duckov-Mod-Manager-1.0.0-x64.exe` from the releases page
   - File size: ~150-200 MB

2. **Run the Installer**
   - Double-click the `.exe` file
   - If Windows SmartScreen appears, click "More info" → "Run anyway"
   - The installer is not code-signed yet, which triggers this warning

3. **Installation Wizard**
   - **Welcome Screen**: Click "Next"
   - **License Agreement**: Read and accept the MIT License
   - **Choose Install Location**:
     - Default: `C:\Users\<YourName>\AppData\Local\Programs\duckov-mod-manager`
     - You can change this location if desired
   - **Select Components**:
     - ✓ Desktop Shortcut (recommended)
     - ✓ Start Menu Shortcut (recommended)
   - **Install**: Click "Install" to begin
   - **Completion**:
     - ✓ Launch Duckov Mod Manager (optional)
     - Click "Finish"

4. **First Launch**
   - The app will appear in:
     - Desktop shortcut: "Duckov Mod Manager"
     - Start Menu: All Apps → Duckov Mod Manager
   - See [First Run Setup](#first-run-setup) for configuration

#### Method 2: Portable Version

1. **Download the Portable Executable**
   - Download `Duckov-Mod-Manager-1.0.0-portable.exe`
   - File size: ~150-200 MB

2. **Run from Any Location**
   - No installation required
   - Place the `.exe` file anywhere you like
   - Double-click to run
   - User data stored in the same folder as the executable

3. **Benefits of Portable Version**
   - No admin rights required
   - Run from USB drive
   - Easy to move between computers
   - Self-contained

**Note**: The installer version is recommended for most users as it provides shortcuts and file associations.

---

### macOS Installation

#### Method 1: DMG Disk Image (Recommended)

1. **Download the DMG**
   - Download `Duckov-Mod-Manager-1.0.0.dmg` from releases
   - File size: ~150-200 MB

2. **Open the DMG**
   - Double-click the `.dmg` file
   - A window will open showing the app icon and Applications folder

3. **Install**
   - Drag the "Duckov Mod Manager" icon to the "Applications" folder
   - Wait for the copy to complete

4. **First Launch**
   - Open Applications folder
   - Double-click "Duckov Mod Manager"
   - **macOS Gatekeeper Warning**:
     - If you see "App can't be opened because it is from an unidentified developer"
     - Right-click the app → "Open" → "Open" again
     - Or: System Preferences → Security & Privacy → "Open Anyway"
   - See [First Run Setup](#first-run-setup) for configuration

5. **Eject the DMG**
   - After installation, eject the disk image from Finder

#### Method 2: ZIP Archive

1. **Download and Extract**
   - Download `Duckov-Mod-Manager-1.0.0-mac.zip`
   - Extract the ZIP file
   - Move the app to Applications folder

**Note**: The app is not currently notarized, so you'll need to bypass Gatekeeper on first launch.

---

### Linux Installation

#### Method 1: AppImage (Universal)

1. **Download AppImage**
   - Download `Duckov-Mod-Manager-1.0.0.AppImage`
   - File size: ~150-200 MB

2. **Make Executable**
   ```bash
   chmod +x Duckov-Mod-Manager-1.0.0.AppImage
   ```

3. **Run**
   ```bash
   ./Duckov-Mod-Manager-1.0.0.AppImage
   ```

4. **Optional: Integration**
   - The app will offer to integrate with your desktop environment
   - This adds it to your application menu
   - Or use AppImageLauncher for automatic integration

#### Method 2: Debian Package (.deb)

**For Ubuntu, Debian, Linux Mint, Pop!_OS**

1. **Install Dependencies**
   ```bash
   sudo apt update
   sudo apt install gconf2 gconf-service libnotify4 libappindicator1 libxtst6 libnss3
   ```

2. **Download and Install**
   ```bash
   # Download the .deb file
   wget <download-url>/Duckov-Mod-Manager-1.0.0-amd64.deb

   # Install
   sudo dpkg -i Duckov-Mod-Manager-1.0.0-amd64.deb

   # Fix any dependency issues
   sudo apt-get install -f
   ```

3. **Launch**
   - From application menu: Search for "Duckov Mod Manager"
   - Or from terminal: `duckov-mod-manager`

#### Method 3: RPM Package (.rpm)

**For Fedora, RHEL, CentOS, openSUSE**

1. **Install Dependencies**
   ```bash
   sudo dnf install libXScrnSaver
   ```

2. **Download and Install**
   ```bash
   # Download the .rpm file
   wget <download-url>/Duckov-Mod-Manager-1.0.0.x86_64.rpm

   # Install
   sudo rpm -i Duckov-Mod-Manager-1.0.0.x86_64.rpm

   # Or use dnf
   sudo dnf install Duckov-Mod-Manager-1.0.0.x86_64.rpm
   ```

3. **Launch**
   - From application menu: Search for "Duckov Mod Manager"
   - Or from terminal: `duckov-mod-manager`

---

## Initial Configuration

### Workshop Path Setup

The application needs to know where your Steam Workshop folder is located.

#### Finding Your Workshop Path

**Windows (Default Steam Installation)**
```
C:\Program Files (x86)\Steam\steamapps\workshop\content\2618920
```

**Windows (Custom Steam Library)**
```
<Your Steam Library>\steamapps\workshop\content\2618920
```

**macOS**
```
~/Library/Application Support/Steam/steamapps/workshop/content/2618920
```

**Linux**
```
~/.steam/steam/steamapps/workshop/content/2618920
```

**Note**: `2618920` is the Steam App ID for Escape from Duckov. If this is different for your game, use the correct App ID.

#### Setting the Path

1. Launch Duckov Mod Manager
2. On first run, you'll be prompted to set the workshop path
3. Click "Browse" and navigate to your workshop folder
4. Or paste the path directly
5. Click "Save"

The app will verify the path and scan for mods.

---

## First Run Setup

### Step 1: Welcome Screen

- Read the welcome message
- Review system requirements
- Click "Get Started"

### Step 2: Workshop Configuration

1. **Set Workshop Path**
   - Browse to or enter your Steam Workshop folder path
   - See [Workshop Path Setup](#workshop-path-setup) for common paths

2. **Verify Path**
   - The app will validate the path
   - It should find your installed workshop mods
   - If path is invalid, you'll see an error message

3. **Initial Scan**
   - Click "Scan Mods"
   - The app will scan your workshop folder
   - This may take 10-30 seconds depending on mod count

### Step 3: Translation Model Download

**IMPORTANT**: This step requires an internet connection.

1. **First Translation Trigger**
   - When you first try to translate something, the app will download the translation model
   - Model size: ~500 MB - 1 GB
   - Download time: 5-15 minutes (depending on connection speed)

2. **Download Progress**
   - Progress will be shown in the app
   - You can see download percentage and file names
   - Do not close the app during download

3. **Model Storage**
   - Models are cached locally
   - Location:
     - Windows: `C:\Users\<YourName>\AppData\Local\Duckov Mod Manager\models`
     - macOS: `~/Library/Application Support/Duckov Mod Manager/models`
     - Linux: `~/.config/Duckov Mod Manager/models`
   - Models persist across app restarts
   - Only downloaded once

4. **After Download**
   - All translations work offline
   - No internet required for any features
   - Models are reused for all future translations

### Step 4: First Translation

1. **Find a Non-English Mod**
   - Look for mods with Chinese, Russian, or other languages
   - These will show in their original language

2. **Translate**
   - Click the "Translate" button on any mod
   - First translation will trigger model download (if not already done)
   - Subsequent translations are instant (using cache)

3. **Verify Translation**
   - Check that the title and description are translated
   - Translations are cached in the database
   - Same text won't be re-translated

---

## Troubleshooting

### Installation Issues

#### Windows: "Windows protected your PC" Warning

**Cause**: The app is not code-signed (yet)

**Solution**:
1. Click "More info"
2. Click "Run anyway"
3. The app is safe - this is a standard warning for unsigned apps

#### macOS: "App can't be opened because it is from an unidentified developer"

**Cause**: The app is not notarized

**Solution**:
1. Right-click the app in Applications
2. Select "Open"
3. Click "Open" in the dialog
4. Or: System Preferences → Security & Privacy → "Open Anyway"

#### Linux: Missing Dependencies

**Error**: `error while loading shared libraries`

**Solution** (Debian/Ubuntu):
```bash
sudo apt install gconf2 gconf-service libnotify4 libappindicator1 libxtst6 libnss3
```

**Solution** (Fedora/RHEL):
```bash
sudo dnf install libXScrnSaver
```

### Configuration Issues

#### Cannot Find Workshop Folder

**Symptoms**:
- App says "Invalid workshop path"
- No mods found after scan

**Solution**:
1. Verify Steam is installed
2. Verify you have Escape from Duckov installed
3. Check the workshop folder exists:
   - Windows: `C:\Program Files (x86)\Steam\steamapps\workshop\content\2618920`
   - macOS: `~/Library/Application Support/Steam/steamapps/workshop/content/2618920`
   - Linux: `~/.steam/steam/steamapps/workshop/content/2618920`
4. If you have multiple Steam libraries, check all of them
5. The workshop folder should contain numbered folders (mod IDs)

#### Scan Finds Zero Mods

**Cause**: Workshop folder empty or path incorrect

**Solution**:
1. Verify you have subscribed to workshop mods in Steam
2. Launch Escape from Duckov once to ensure mods are downloaded
3. Check that the workshop folder contains mod folders
4. Try rescanning after verifying mods exist

### Translation Issues

#### Model Download Fails

**Symptoms**:
- Download hangs or fails
- Error message during model download

**Solution**:
1. Check internet connection
2. Ensure you have 2+ GB free disk space
3. Check firewall isn't blocking the app
4. Try restarting the app
5. If behind a proxy, ensure proxy settings are correct

#### Model Download Very Slow

**Cause**: Large model file (~500 MB - 1 GB)

**Solution**:
- Download is a one-time operation
- Wait for download to complete
- Average time: 5-15 minutes on typical connection
- Model is cached permanently

#### Translations Return Original Text

**Symptoms**:
- Clicking "Translate" doesn't translate
- Text remains in original language

**Solution**:
1. Check if model is downloaded (first translation triggers download)
2. Wait for model download to complete
3. Check app logs for errors
4. Restart the app
5. Try translating a different mod

#### Translations Are Low Quality

**Cause**: Offline model has limitations compared to online services

**Note**:
- Offline translation is approximate
- Quality varies by source language
- Chinese to English generally works well
- Complex or idiomatic text may not translate perfectly
- This is a trade-off for full offline operation

### Performance Issues

#### App Starts Slowly

**Symptoms**:
- Takes 5+ seconds to start
- Loading screen shows for extended time

**Cause**:
- Normal for first start (initializing database, loading models)
- Subsequent starts should be faster

**Solution**:
- First start: 5-10 seconds is normal
- If always slow, check:
  - Available RAM
  - Disk space
  - Antivirus not scanning app

#### Scanning Is Slow

**Symptoms**:
- Mod scan takes >1 minute
- Progress bar moves slowly

**Cause**: Large number of mods or slow disk

**Solution**:
- 100 mods: ~10 seconds
- 1000 mods: ~30 seconds
- 5000+ mods: ~1-2 minutes
- This is normal and only happens when you click "Scan"

#### High Memory Usage

**Symptoms**:
- Task Manager shows high RAM usage
- System becomes sluggish

**Cause**: Translation models loaded in memory

**Note**:
- Expected memory usage: 500 MB - 1.5 GB
- This is normal when translation model is loaded
- Memory released when app closes

---

## Uninstallation

### Windows

#### If Installed with NSIS Installer

1. **Control Panel Method**:
   - Open Control Panel → Programs → Programs and Features
   - Find "Duckov Mod Manager"
   - Click "Uninstall"
   - Follow the uninstaller wizard

2. **Start Menu Method**:
   - Open Start Menu
   - Find "Duckov Mod Manager" folder
   - Click "Uninstall Duckov Mod Manager"

3. **Settings Method** (Windows 10/11):
   - Settings → Apps → Apps & features
   - Find "Duckov Mod Manager"
   - Click → Uninstall

#### If Using Portable Version

- Simply delete the `.exe` file
- Optionally delete user data folder if created

#### Remove User Data (Optional)

**Location**: `C:\Users\<YourName>\AppData\Roaming\Duckov Mod Manager`

**Contains**:
- Database (mods.db)
- Translation cache
- App settings
- Logs

**To Remove**:
1. Press `Win + R`
2. Type: `%APPDATA%`
3. Delete the "Duckov Mod Manager" folder

**Note**: Uninstaller does NOT delete user data by default (in case you want to reinstall later).

### macOS

1. **Remove Application**:
   - Open Applications folder
   - Drag "Duckov Mod Manager" to Trash
   - Empty Trash

2. **Remove User Data** (Optional):
   ```bash
   rm -rf ~/Library/Application\ Support/Duckov\ Mod\ Manager
   rm -rf ~/Library/Logs/Duckov\ Mod\ Manager
   rm -rf ~/Library/Caches/Duckov\ Mod\ Manager
   ```

### Linux

#### If Installed from .deb Package

```bash
sudo apt remove duckov-mod-manager
```

#### If Installed from .rpm Package

```bash
sudo rpm -e duckov-mod-manager
# Or
sudo dnf remove duckov-mod-manager
```

#### If Using AppImage

```bash
rm Duckov-Mod-Manager-1.0.0.AppImage
```

#### Remove User Data (Optional)

```bash
rm -rf ~/.config/Duckov\ Mod\ Manager
rm -rf ~/.local/share/Duckov\ Mod\ Manager
```

---

## Updates

### Checking for Updates

Currently, update checking is manual:

1. Visit the releases page on GitHub
2. Check if a newer version is available
3. Download the latest version
4. Install over the existing version

### Installing Updates

#### Windows

1. Download the latest installer
2. Run the installer
3. It will detect the existing installation
4. Follow the wizard (it will upgrade in place)
5. Your data and settings are preserved

#### macOS

1. Download the latest DMG
2. Open the DMG
3. Drag the new version to Applications (replace existing)
4. Your data and settings are preserved

#### Linux

**AppImage**:
- Download new AppImage
- Replace old file
- Make executable: `chmod +x Duckov-Mod-Manager-<new-version>.AppImage`

**Package (.deb/.rpm)**:
- Download new package
- Install: `sudo dpkg -i <new-package>.deb` or `sudo rpm -U <new-package>.rpm`
- Package manager handles the update

### Data Migration

**Your data is safe during updates**:
- Database located in user data folder (separate from app)
- Translation cache preserved
- Settings preserved
- No manual migration needed

### Future: Auto-Update

Automatic update checking and installation is planned for future versions.

---

## Advanced Configuration

### Environment Variables

You can set these environment variables to customize behavior:

```bash
# Custom database location
DB_PATH="/custom/path/to/mods.db"

# Translation cache TTL (days)
TRANSLATION_CACHE_TTL_DAYS=30

# Workshop path (can be set via env instead of UI)
WORKSHOP_DATA_PATH="C:/Program Files (x86)/Steam/steamapps/workshop/content/2618920"

# Enable debug logging
DEBUG=true
NODE_ENV=development
```

**Windows**: Set via System Properties → Environment Variables

**macOS/Linux**: Add to `~/.bashrc` or `~/.zshrc`

### Custom Model Cache Location

By default, translation models are downloaded to:
- Windows: `%LOCALAPPDATA%\Duckov Mod Manager\models`
- macOS: `~/Library/Application Support/Duckov Mod Manager/models`
- Linux: `~/.config/Duckov Mod Manager/models`

To use a custom location, you can symlink this folder to another location.

### Database Backup

The database contains all mod information and translation cache.

**Location**:
- Windows: `%APPDATA%\Duckov Mod Manager\mods.db`
- macOS: `~/Library/Application Support/Duckov Mod Manager/mods.db`
- Linux: `~/.config/Duckov Mod Manager/mods.db`

**To Backup**:
1. Close Duckov Mod Manager
2. Copy `mods.db` to a safe location
3. To restore: Copy back to original location

### Running from Source

For developers or advanced users:

```bash
# Clone repository
git clone <repository-url>
cd duckov-mod-manager

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build production version
npm run build
npm run dist
```

See `DEVELOPMENT.md` for full development instructions.

---

## Support

### Getting Help

1. **Documentation**:
   - `GETTING_STARTED.md` - Quick start guide
   - `OFFLINE_OPERATION.md` - Offline features
   - `MIGRATION_FROM_OLD_APP.md` - Migrating from old version

2. **Issue Tracker**:
   - GitHub Issues: Report bugs and request features
   - Include: OS, version, error messages, screenshots

3. **Logs**:
   - Windows: `%APPDATA%\Duckov Mod Manager\logs`
   - macOS: `~/Library/Logs/Duckov Mod Manager`
   - Linux: `~/.config/Duckov Mod Manager/logs`

### Common Paths Reference

**Windows**:
```
App Data: %APPDATA%\Duckov Mod Manager
Local Data: %LOCALAPPDATA%\Duckov Mod Manager
Logs: %APPDATA%\Duckov Mod Manager\logs
Database: %APPDATA%\Duckov Mod Manager\mods.db
Models: %LOCALAPPDATA%\Duckov Mod Manager\models
```

**macOS**:
```
App Data: ~/Library/Application Support/Duckov Mod Manager
Logs: ~/Library/Logs/Duckov Mod Manager
Database: ~/Library/Application Support/Duckov Mod Manager/mods.db
Models: ~/Library/Application Support/Duckov Mod Manager/models
```

**Linux**:
```
App Data: ~/.config/Duckov Mod Manager
Logs: ~/.config/Duckov Mod Manager/logs
Database: ~/.config/Duckov Mod Manager/mods.db
Models: ~/.config/Duckov Mod Manager/models
```

---

## License

Duckov Mod Manager is released under the MIT License.

See `LICENSE` file for full license text.

---

**Version**: 1.0.0
**Last Updated**: 2025-11-11
**Author**: DMCK96
