## Welcome

Welcome to Duckov Mod Manager!

**What is Duckov Mod Manager?**

A desktop application that helps you:
- View all your Escape from Duckov workshop mods in one place
- Automatically translate mod descriptions from any language to English
- Search and filter your mod collection
- Export mod collections to share with friends
- Work 100% offline (after initial setup)

**Best Features**:
- Works completely offline (no internet needed after setup)
- Automatic translation of Chinese, Russian, and other languages
- Fast search and filtering
- Clean, modern interface
- Free and open source

---

## Quick Setup (5 Minutes)

### Step 1: Install the Application

Choose your operating system:

#### Windows (Most Common)

1. Download `Duckov-Mod-Manager-1.0.0-x64.exe`
2. Double-click to run the installer
3. If you see a security warning:
   - Click "More info"
   - Click "Run anyway"
4. Follow the installation wizard
5. Choose whether to create desktop shortcut (recommended: Yes)
6. Click "Finish"

#### macOS

1. Download `Duckov-Mod-Manager-1.0.0.dmg`
2. Open the DMG file
3. Drag "Duckov Mod Manager" to Applications folder
4. Open Applications folder
5. Right-click "Duckov Mod Manager" → Open (first time only)
6. Click "Open" to confirm

#### Linux

**Ubuntu/Debian** (using .deb package):
```bash
sudo dpkg -i Duckov-Mod-Manager-1.0.0-amd64.deb
```

**Or use AppImage** (works on all distros):
```bash
chmod +x Duckov-Mod-Manager-1.0.0.AppImage
./Duckov-Mod-Manager-1.0.0.AppImage
```

---

### Step 2: Find Your Steam Workshop Folder

The app needs to know where your mods are stored. Here's how to find it:

#### Windows

**Default Location**:
```
C:\Program Files (x86)\Steam\steamapps\workshop\content\2618920
```

**If you can't find it**:
1. Open Steam
2. Right-click "Escape from Duckov" in your library
3. Properties → Installed Files → Browse
4. Navigate up to `Steam\steamapps\workshop\content\2618920`

#### macOS

```
/Users/<YourName>/Library/Application Support/Steam/steamapps/workshop/content/2618920
```

To get there:
1. Open Finder
2. Press `Cmd + Shift + G`
3. Paste the path above (replace `<YourName>` with your username)

#### Linux

```
~/.steam/steam/steamapps/workshop/content/2618920
```

**Note**: The folder should contain numbered subfolders (these are your mods).

---

### Step 3: Configure Duckov Mod Manager

1. **Launch the app**
   - Windows: Desktop shortcut or Start Menu
   - macOS: Applications folder
   - Linux: Application menu or run from terminal

2. **Set Workshop Path**
   - On first launch, you'll see a setup screen
   - Click "Browse" or paste your workshop path from Step 2
   - Click "Save"

3. **Scan Your Mods**
   - Click the "Scan Mods" button
   - Wait 10-30 seconds (depending on how many mods you have)
   - You should see a list of all your workshop mods

**Screenshot Description**:
*[A settings screen with a text field for workshop path, a "Browse" button, and a "Scan Mods" button. Below it shows a progress bar and then a list of mods with thumbnails and titles]*

---

### Step 4: First Translation (One-Time Setup)

The first time you translate something, the app will download translation models. This is a **one-time process**.

#### What to Expect

1. **Find a Non-English Mod**
   - Look for mods with Chinese characters or Cyrillic text
   - These mods will show titles/descriptions in their original language

2. **Click "Translate"**
   - Click the translate button next to any non-English mod
   - You'll see a download progress screen

3. **Model Download**
   - **Size**: ~500 MB - 1 GB
   - **Time**: 5-15 minutes (one-time only)
   - **Requires**: Internet connection
   - **Note**: Don't close the app during download

4. **After Download**
   - Translation completes automatically
   - All future translations are instant (using the downloaded model)
   - No internet required ever again

**Screenshot Description**:
*[A progress dialog showing "Downloading translation model... 45%" with a progress bar and estimated time remaining]*

#### During Download

- You can minimize the app
- You can browse other mods
- Don't close the app completely
- Progress is saved if you need to restart

---

## Using the Application

### Main Screen Overview

**Screenshot Description**:
*[Main window showing: top toolbar with search box and buttons, left sidebar with filters, center area with mod list showing thumbnails and titles, right panel with mod details]*

**Top Toolbar**:
- Search box: Find mods by name
- Scan button: Refresh mod list
- Filter button: Show/hide filters
- Settings button: App configuration

**Left Sidebar**:
- Language filter: Show only specific languages
- Sort options: Name, date, size
- Tag filters: Filter by mod categories

**Center Area**:
- Mod list: All your mods with thumbnails
- Each mod shows:
  - Thumbnail image
  - Title (translated if available)
  - Author
  - Language indicator

**Right Panel** (when mod selected):
- Full mod details
- Description (original and translated)
- File information
- Translate button
- Export button

---

### Basic Operations

#### Scanning for New Mods

When you subscribe to new mods in Steam:

1. Click the "Scan Mods" button in the toolbar
2. Wait a few seconds
3. New mods will appear in the list

**Tip**: The app doesn't auto-scan. Click "Scan Mods" whenever you add new workshop mods.

#### Searching for Mods

1. **Simple Search**:
   - Type in the search box at the top
   - Results appear instantly
   - Searches mod titles and descriptions

2. **Advanced Filtering**:
   - Click "Filters" button
   - Select language (e.g., "Chinese", "Russian", "English")
   - Choose sort order
   - Apply filters

**Example**: To find all Chinese mods:
- Open filters
- Select "Chinese" in language filter
- Click "Apply"

#### Translating Mods

1. **Single Mod**:
   - Click on any mod
   - Click "Translate" button
   - Translation appears instantly (after initial model download)

2. **Batch Translation**:
   - Select multiple mods (Ctrl+Click or Cmd+Click)
   - Click "Translate Selected"
   - All selected mods will be translated

3. **Translation Quality**:
   - Chinese → English: Very good
   - Russian → English: Good
   - Japanese/Korean → English: Good
   - Other languages: Varies

**Note**: Translations are cached. If you translate the same text twice, it uses the cached version (instant).

#### Viewing Mod Details

1. Click any mod in the list
2. Right panel shows:
   - Original title and description
   - Translated title and description (if available)
   - File size and location
   - Last update date
   - Workshop ID

3. **Mod Description**:
   - Original text shown on top
   - Translated text shown below
   - Click "Copy" to copy translated text

#### Exporting Mods

Want to share mods with friends?

1. **Select Mods**:
   - Click mods to select (Ctrl+Click for multiple)
   - Or click "Select All" for all mods

2. **Export**:
   - Click "Export" button
   - Choose save location
   - Enter filename (e.g., "my-favorite-mods.zip")
   - Click "Save"

3. **Result**:
   - A ZIP file containing all selected mod folders
   - Can be shared via USB, cloud storage, etc.
   - Friends can extract and place in their workshop folder

**Screenshot Description**:
*[Export dialog showing a list of selected mods with checkboxes, total size calculation, and a "Choose Location" button]*

---

## Common Tasks

### "I just subscribed to new mods on Steam. How do I see them?"

1. Launch Duckov Mod Manager
2. Click "Scan Mods" button
3. New mods appear in the list

### "How do I find all mods in a specific language?"

1. Click "Filters" button
2. Under "Language", select the language you want
3. Click "Apply"
4. Only mods in that language will show

### "How do I translate all my Chinese mods at once?"

1. Filter for Chinese mods (see above)
2. Click "Select All"
3. Click "Translate Selected"
4. Wait for batch translation to complete

### "The translation doesn't make sense. Can I see the original?"

Yes! The original text is always shown above the translation. The app never replaces the original text.

### "Can I use this without internet?"

**Yes!** After the initial translation model download, the app works 100% offline. You can:
- Scan mods (offline)
- Search mods (offline)
- Translate mods (offline)
- Export mods (offline)

The only thing that requires internet is downloading the translation model on first use.

### "How do I backup my translations?"

Your translations are automatically saved in a database file. To backup:

**Windows**:
1. Close Duckov Mod Manager
2. Go to: `C:\Users\<YourName>\AppData\Roaming\Duckov Mod Manager`
3. Copy the `mods.db` file
4. Save it somewhere safe

**macOS**:
1. Close Duckov Mod Manager
2. Go to: `~/Library/Application Support/Duckov Mod Manager`
3. Copy the `mods.db` file
4. Save it somewhere safe

**Linux**:
1. Close Duckov Mod Manager
2. Go to: `~/.config/Duckov Mod Manager`
3. Copy the `mods.db` file
4. Save it somewhere safe

---

## Tips and Tricks

### Speed Up Translations

- **Batch translate**: Translating multiple mods at once is faster than one-by-one
- **Cached translations**: The app remembers translations, so re-translating is instant
- **Filter first**: Filter mods before translating to focus on what you need

### Keep Your Mod List Up to Date

- Click "Scan Mods" after:
  - Subscribing to new mods
  - Unsubscribing from mods
  - Updating mods in Steam

### Search Power Tips

- **Partial matches**: Type "weap" to find "weapon" mods
- **Case insensitive**: Searching "RIFLE" finds "rifle", "Rifle", etc.
- **Search translated text**: If you've translated mods, search works on translated titles too

### Save Disk Space

Translation models take 500 MB - 1 GB. If you're short on space:
- Use an external drive for the app
- Or ensure you have 2+ GB free before installing

### Performance

- **First translation**: Slow (model download + first-time initialization)
- **Subsequent translations**: Fast (2-5 seconds per mod)
- **Cached translations**: Instant (already done before)

---

## Keyboard Shortcuts

**Planned for Future Release** - Currently all operations are mouse-driven

---

## Frequently Asked Questions

### General Questions

**Q: Is this app free?**
A: Yes! Duckov Mod Manager is completely free and open source.

**Q: Does it work with other games?**
A: Currently designed for Escape from Duckov, but could be adapted for other Steam Workshop games.

**Q: Will my Steam mods still work?**
A: Yes! This app just reads your mods, it doesn't modify them. Your game will work exactly as before.

**Q: Can I use this on multiple computers?**
A: Yes! Install on as many computers as you like. Your data is stored locally on each computer.

### Translation Questions

**Q: What languages can it translate?**
A: Any language → English. Best results with Chinese, Russian, Japanese, Korean.

**Q: How accurate are the translations?**
A: Pretty good for mod descriptions! Not perfect, but usually understandable. Technical terms and game-specific words work well.

**Q: Can I translate to languages other than English?**
A: Currently only → English. Other target languages may be added in future versions.

**Q: Do translations require internet?**
A: Only for the first-time model download. After that, all translations are offline.

**Q: Can I edit translations?**
A: Not currently. This may be added in a future version.

### Technical Questions

**Q: Where is my data stored?**
A: In your user data folder (see [Common Tasks](#common-tasks) for exact paths).

**Q: How much disk space does it use?**
A: App: ~150-200 MB, Translation models: ~500 MB - 1 GB, Database: ~10-50 MB (depending on mod count)

**Q: Does it slow down my computer?**
A: Minimal impact when not in use. During translation, it uses CPU and RAM (normal behavior).

**Q: Can I run this on Windows 7?**
A: No, Windows 10 (64-bit) or later is required.

**Q: Does it work on Apple Silicon Macs (M1/M2)?**
A: Yes! The app is universal and runs natively on both Intel and Apple Silicon.

---

## Troubleshooting

### App Won't Start

**Windows**:
- Make sure you're running Windows 10 or later
- Try running as administrator
- Check antivirus isn't blocking it

**macOS**:
- Right-click → Open (don't double-click on first launch)
- System Preferences → Security → "Open Anyway"

**Linux**:
- Make sure dependencies are installed
- Check file has execute permission: `chmod +x <filename>`

### Can't Find Workshop Folder

1. Make sure Steam is installed
2. Make sure Escape from Duckov is installed
3. Make sure you've launched the game at least once
4. Try the default path for your OS (see [Step 2](#step-2-find-your-steam-workshop-folder))

### No Mods Showing After Scan

1. Verify the workshop path is correct
2. Make sure you've subscribed to mods in Steam
3. Launch Escape from Duckov to download the mods
4. Check the workshop folder has numbered subfolders
5. Try scanning again

### Translation Model Won't Download

1. Check internet connection
2. Check firewall isn't blocking the app
3. Make sure you have 2+ GB free disk space
4. Try restarting the app
5. Check antivirus isn't interfering

### App is Slow

1. Close other applications
2. Make sure you have enough RAM (4 GB minimum, 8 GB recommended)
3. First translation is always slower (model loading)
4. Subsequent translations should be faster

---

## Getting Help

### Documentation

- `DEPLOYMENT.md` - Detailed installation and configuration
- `OFFLINE_OPERATION.md` - How offline features work
- `MIGRATION_FROM_OLD_APP.md` - Upgrading from old version

### Support

- **GitHub Issues**: Report bugs or request features
- **Logs**: Check app logs for error messages (see DEPLOYMENT.md for log locations)

### Reporting Issues

When reporting issues, include:
1. Your operating system and version
2. Duckov Mod Manager version
3. What you were trying to do
4. What happened instead
5. Screenshots if applicable
6. Error messages from logs

---

## What's Next?

Now that you're set up, you can:

1. Explore your mod collection
2. Translate non-English mods to understand what they do
3. Organize mods by language or category
4. Export mod collections to share
5. Keep your mod list updated by scanning regularly

### Planned Features

Future versions may include:
- Automatic update checking
- More translation language pairs
- Mod tags and categories
- Custom notes for mods
- Mod conflict detection
- Mod load order management

---

## Tips for Best Experience

1. **Run Initial Scan**: When you first install, scan all mods so you have a complete list
2. **Translate Once**: Translate your mods once, then they're cached forever
3. **Scan After Steam Updates**: After subscribing to new mods, remember to scan
4. **Backup Your Database**: Occasionally backup your `mods.db` file
5. **Keep Models Updated**: Future versions may have better models - check for app updates

---

## Enjoy!

You're all set! Duckov Mod Manager is designed to make managing your workshop mods easier and more accessible, especially when dealing with mods in languages you don't understand.

If you find this app useful, consider:
- Starring the repository on GitHub
- Sharing with other Escape from Duckov players
- Reporting bugs to help improve the app
- Contributing if you're a developer

Happy modding!

---

**Version**: 1.0.0
**Last Updated**: 2025-11-12
**Author**: DMCK96

**Need more help?** See `DEPLOYMENT.md` for detailed technical documentation.
