/**
 * Script to force re-translation of mods that contain Chinese characters
 * but were previously marked as English or not translated
 * 
 * This fixes the issue where mods with mixed English/Chinese content
 * were not being translated.
 */

const Database = require('better-sqlite3');
const path = require('path');

// Database path - adjust if needed
const dbPath = path.join(__dirname, '..', 'data', 'mods.db');
console.log(`Opening database: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Find all mods
  const mods = db.prepare('SELECT id, title, description, language, translated_title FROM mods').all();
  console.log(`Found ${mods.length} total mods`);

  // Find mods that need re-translation
  const chineseRegex = /[\u4e00-\u9fa5]/;
  const modsToRetranslate = [];

  for (const mod of mods) {
    const titleHasChinese = chineseRegex.test(mod.title || '');
    const descriptionHasChinese = chineseRegex.test(mod.description || '');
    const needsTranslation = titleHasChinese || descriptionHasChinese;
    const hasTranslation = mod.translated_title !== null && mod.translated_title !== '';

    if (needsTranslation && !hasTranslation) {
      modsToRetranslate.push({
        id: mod.id,
        title: mod.title,
        language: mod.language,
        titleHasChinese,
        descriptionHasChinese
      });
    }
  }

  console.log(`\nFound ${modsToRetranslate.length} mods that need translation:`);
  modsToRetranslate.forEach(mod => {
    console.log(`  - ${mod.id}: ${mod.title.substring(0, 50)}... (lang: ${mod.language})`);
  });

  if (modsToRetranslate.length > 0) {
    console.log(`\nTo fix this, the application needs to be running.`);
    console.log(`Please run the app and perform a "Scan Local Mods" operation.`);
    console.log(`The updated translation logic will now properly translate these mods.`);
  } else {
    console.log(`\nAll mods with Chinese content have translations! ✓`);
  }

  // Statistics
  const stats = {
    total: mods.length,
    withChinese: mods.filter(m => chineseRegex.test(m.title || '') || chineseRegex.test(m.description || '')).length,
    translated: mods.filter(m => m.translated_title !== null && m.translated_title !== '').length,
    needsTranslation: modsToRetranslate.length
  };

  console.log(`\nStatistics:`);
  console.log(`  Total mods: ${stats.total}`);
  console.log(`  Mods with Chinese content: ${stats.withChinese}`);
  console.log(`  Mods with translations: ${stats.translated}`);
  console.log(`  Mods needing translation: ${stats.needsTranslation}`);

} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
