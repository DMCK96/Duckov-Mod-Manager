import BetterSqlite3 from 'better-sqlite3';
import { logger } from '../utils/logger';
import { ModInfo, CachedTranslation } from '../types';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Database - SQLite database manager for mod and translation data
 *
 * Electron Considerations:
 * - Uses app.getPath('userData') for database location in production
 * - Falls back to './data' for development/testing
 * - All operations are synchronous for better performance
 * - Thread-safe for use in Electron main process
 */
export class Database {
  private db: BetterSqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    // Use Electron's userData directory in production, fallback to ./data in development
    // This ensures database is stored in the correct location for Electron apps
    const isElectronApp = typeof app !== 'undefined' && app.getPath;

    if (isElectronApp) {
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'mods.db');
      logger.info(`Database will be stored in Electron userData: ${this.dbPath}`);
    } else {
      // Fallback for testing/development without Electron
      this.dbPath = process.env.DB_PATH || './data/mods.db';
      logger.info(`Database will be stored in: ${this.dbPath}`);
    }

    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    try {
      this.db = new BetterSqlite3(this.dbPath);
      logger.info('Connected to SQLite database');
      this.createTables();
    } catch (err) {
      logger.error('Failed to connect to database:', err);
      throw err;
    }
  }

  private createTables(): void {
    const queries = [
      `CREATE TABLE IF NOT EXISTS mods (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        original_title TEXT,
        original_description TEXT,
        translated_title TEXT,
        translated_description TEXT,
        creator TEXT,
        preview_url TEXT,
        file_size INTEGER,
        subscriptions INTEGER,
        rating REAL,
        tags TEXT,
        time_created INTEGER,
        time_updated INTEGER,
        last_translated INTEGER,
        language TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        source_lang TEXT NOT NULL,
        target_lang TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        UNIQUE(original_text, source_lang, target_lang)
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_mods_updated ON mods(time_updated)`,
      `CREATE INDEX IF NOT EXISTS idx_mods_creator ON mods(creator)`,
      `CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(original_text, source_lang, target_lang)`,
      `CREATE INDEX IF NOT EXISTS idx_translations_expires ON translations(expires_at)`
    ];

    for (const query of queries) {
      this.runQuery(query);
    }
  }

  private runQuery(query: string, params: any[] = []): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.prepare(query).run(...params);
      return result;
    } catch (err) {
      logger.error('Database query failed:', { query, params, error: err });
      throw err;
    }
  }

  private getQuery(query: string, params: any[] = []): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.prepare(query).get(...params);
      return result;
    } catch (err) {
      logger.error('Database query failed:', { query, params, error: err });
      throw err;
    }
  }

  private getAllQuery(query: string, params: any[] = []): any[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = this.db.prepare(query).all(...params);
      return result || [];
    } catch (err) {
      logger.error('Database query failed:', { query, params, error: err });
      throw err;
    }
  }

  saveMod(mod: ModInfo): void {
    const query = `
      INSERT OR REPLACE INTO mods (
        id, title, description, original_title, original_description,
        translated_title, translated_description, creator, preview_url,
        file_size, subscriptions, rating, tags, time_created, time_updated,
        last_translated, language, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const params = [
      mod.id,
      mod.title,
      mod.description,
      mod.originalTitle || null,
      mod.originalDescription || null,
      mod.translatedTitle || null,
      mod.translatedDescription || null,
      mod.creator,
      mod.previewUrl,
      mod.fileSize,
      mod.subscriptions,
      mod.rating,
      JSON.stringify(mod.tags),
      mod.timeCreated.getTime(),
      mod.timeUpdated.getTime(),
      mod.lastTranslated?.getTime() || null,
      mod.language || null
    ];

    this.runQuery(query, params);
  }

  getMod(id: string): ModInfo | null {
    const query = 'SELECT * FROM mods WHERE id = ?';
    const row = this.getQuery(query, [id]);
    
    if (!row) return null;
    
    return this.mapRowToMod(row);
  }

  getAllMods(limit: number = 100, offset: number = 0): ModInfo[] {
    const query = 'SELECT * FROM mods ORDER BY time_updated DESC LIMIT ? OFFSET ?';
    const rows = this.getAllQuery(query, [limit, offset]);
    
    return rows.map(row => this.mapRowToMod(row));
  }

  searchMods(searchTerm: string, limit: number = 50): ModInfo[] {
    const query = `
      SELECT * FROM mods 
      WHERE title LIKE ? OR description LIKE ? OR translated_title LIKE ? OR translated_description LIKE ?
      ORDER BY time_updated DESC 
      LIMIT ?
    `;
    const term = `%${searchTerm}%`;
    const rows = this.getAllQuery(query, [term, term, term, term, limit]);
    
    return rows.map(row => this.mapRowToMod(row));
  }

  /**
   * Gets a cached translation from the database
   * @param originalText - Original text
   * @param sourceLang - Source language code
   * @param targetLang - Target language code
   * @returns Cached translation or null if not found/expired
   */
  getTranslation(originalText: string, sourceLang: string, targetLang: string): CachedTranslation | null {
    const query = `
      SELECT * FROM translations
      WHERE original_text = ? AND source_lang = ? AND target_lang = ? AND expires_at > CURRENT_TIMESTAMP
    `;

    const row = this.getQuery(query, [originalText, sourceLang, targetLang]);

    if (!row) return null;

    return {
      originalText: row.original_text,
      translatedText: row.translated_text,
      sourceLang: row.source_lang,
      targetLang: row.target_lang,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
   * Saves a translation to the database cache
   * @param text - Original text
   * @param translation - Translated text
   * @param sourceLang - Source language code
   * @param targetLang - Target language code
   */
  saveTranslation(text: string, translation: string, sourceLang: string, targetLang: string): void {
    const cacheExpiryDays = parseInt(process.env.TRANSLATION_CACHE_TTL_DAYS || '30');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + cacheExpiryDays);

    const query = `
      INSERT OR REPLACE INTO translations (
        original_text, translated_text, source_lang, target_lang, expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      text,
      translation,
      sourceLang,
      targetLang,
      expiresAt.toISOString()
    ];

    this.runQuery(query, params);
  }

  /**
   * Gets the total count of cached translations
   * Useful for statistics and monitoring
   *
   * @returns Number of non-expired translations in cache
   */
  getTranslationCount(): number {
    const query = 'SELECT COUNT(*) as count FROM translations WHERE expires_at > CURRENT_TIMESTAMP';
    const row = this.getQuery(query);
    return row ? row.count : 0;
  }

  /**
   * Clears expired translations from the database
   * Returns the number of deleted entries
   *
   * @returns Number of translations deleted
   */
  clearExpiredTranslations(): number {
    const query = 'DELETE FROM translations WHERE expires_at < CURRENT_TIMESTAMP';
    const result = this.runQuery(query);
    return result.changes || 0;
  }

  /**
   * Clears ALL translations from the database (including non-expired)
   * Use with caution - this will force retranslation of all content
   *
   * @returns Number of translations deleted
   */
  clearAllTranslations(): number {
    const query = 'DELETE FROM translations';
    const result = this.runQuery(query);
    logger.warn(`Cleared all translations from cache: ${result.changes || 0} entries deleted`);
    return result.changes || 0;
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use clearExpiredTranslations() instead
   */
  cleanExpiredTranslations(): void {
    this.clearExpiredTranslations();
  }

  private mapRowToMod(row: any): ModInfo {
    // Use translated content if available, otherwise use original
    const title = row.translated_title || row.title;
    const description = row.translated_description || row.description;
    
    return {
      id: row.id,
      title: title,
      description: description,
      originalTitle: row.original_title,
      originalDescription: row.original_description,
      translatedTitle: row.translated_title,
      translatedDescription: row.translated_description,
      creator: row.creator,
      previewUrl: row.preview_url,
      fileSize: row.file_size,
      subscriptions: row.subscriptions,
      rating: row.rating,
      tags: JSON.parse(row.tags || '[]'),
      timeCreated: new Date(row.time_created),
      timeUpdated: new Date(row.time_updated),
      lastTranslated: row.last_translated ? new Date(row.last_translated) : undefined,
      language: row.language
    };
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close();
        logger.info('Database connection closed');
      } catch (err) {
        logger.error('Error closing database:', err);
      }
    }
  }
}
