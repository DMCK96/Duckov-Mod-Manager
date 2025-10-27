"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const logger_1 = require("../utils/logger");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class Database {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DB_PATH || './data/mods.db';
        this.ensureDataDirectory();
    }
    ensureDataDirectory() {
        const dataDir = path_1.default.dirname(this.dbPath);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
    }
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3_1.default.Database(this.dbPath, (err) => {
                if (err) {
                    logger_1.logger.error('Failed to connect to database:', err);
                    reject(err);
                    return;
                }
                logger_1.logger.info('Connected to SQLite database');
                this.createTables().then(resolve).catch(reject);
            });
        });
    }
    async createTables() {
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
            await this.runQuery(query);
        }
    }
    runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            this.db.run(query, params, function (err) {
                if (err) {
                    logger_1.logger.error('Database query failed:', { query, params, error: err });
                    reject(err);
                }
                else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }
    getQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            this.db.get(query, params, (err, row) => {
                if (err) {
                    logger_1.logger.error('Database query failed:', { query, params, error: err });
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    getAllQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    logger_1.logger.error('Database query failed:', { query, params, error: err });
                    reject(err);
                }
                else {
                    resolve(rows || []);
                }
            });
        });
    }
    async saveMod(mod) {
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
        await this.runQuery(query, params);
    }
    async getMod(id) {
        const query = 'SELECT * FROM mods WHERE id = ?';
        const row = await this.getQuery(query, [id]);
        if (!row)
            return null;
        return this.mapRowToMod(row);
    }
    async getAllMods(limit = 100, offset = 0) {
        const query = 'SELECT * FROM mods ORDER BY time_updated DESC LIMIT ? OFFSET ?';
        const rows = await this.getAllQuery(query, [limit, offset]);
        return rows.map(row => this.mapRowToMod(row));
    }
    async searchMods(searchTerm, limit = 50) {
        const query = `
      SELECT * FROM mods 
      WHERE title LIKE ? OR description LIKE ? OR translated_title LIKE ? OR translated_description LIKE ?
      ORDER BY time_updated DESC 
      LIMIT ?
    `;
        const term = `%${searchTerm}%`;
        const rows = await this.getAllQuery(query, [term, term, term, term, limit]);
        return rows.map(row => this.mapRowToMod(row));
    }
    async saveTranslation(translation) {
        const query = `
      INSERT OR REPLACE INTO translations (
        original_text, translated_text, source_lang, target_lang, expires_at
      ) VALUES (?, ?, ?, ?, ?)
    `;
        const params = [
            translation.originalText,
            translation.translatedText,
            translation.sourceLang,
            translation.targetLang,
            translation.expiresAt.toISOString()
        ];
        await this.runQuery(query, params);
    }
    async getTranslation(originalText, sourceLang, targetLang) {
        const query = `
      SELECT * FROM translations 
      WHERE original_text = ? AND source_lang = ? AND target_lang = ? AND expires_at > CURRENT_TIMESTAMP
    `;
        const row = await this.getQuery(query, [originalText, sourceLang, targetLang]);
        if (!row)
            return null;
        return {
            originalText: row.original_text,
            translatedText: row.translated_text,
            sourceLang: row.source_lang,
            targetLang: row.target_lang,
            createdAt: new Date(row.created_at),
            expiresAt: new Date(row.expires_at)
        };
    }
    async cleanExpiredTranslations() {
        const query = 'DELETE FROM translations WHERE expires_at < CURRENT_TIMESTAMP';
        await this.runQuery(query);
    }
    mapRowToMod(row) {
        return {
            id: row.id,
            title: row.title,
            description: row.description,
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
    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger_1.logger.error('Error closing database:', err);
                    }
                    else {
                        logger_1.logger.info('Database connection closed');
                    }
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
exports.Database = Database;
//# sourceMappingURL=Database.js.map