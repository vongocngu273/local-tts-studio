import type { Migration } from './migration.types';

export const migration002: Migration = {
  version: 2,
  name: '002_pronunciation_dictionary',
  up: (db) => {
    // 1. Pronunciation Dictionary table
    db.exec(`
      CREATE TABLE IF NOT EXISTS pronunciation_dictionary (
        id TEXT PRIMARY KEY,
        term TEXT NOT NULL,
        spoken_text TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        case_sensitive INTEGER NOT NULL DEFAULT 0,
        whole_word INTEGER NOT NULL DEFAULT 1,
        provider_scope TEXT NOT NULL DEFAULT 'ALL',
        category TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pronunciation_term ON pronunciation_dictionary(term);
      CREATE INDEX IF NOT EXISTS idx_pronunciation_enabled ON pronunciation_dictionary(enabled);
      CREATE INDEX IF NOT EXISTS idx_pronunciation_provider ON pronunciation_dictionary(provider_scope);
      CREATE INDEX IF NOT EXISTS idx_pronunciation_category ON pronunciation_dictionary(category);
      CREATE INDEX IF NOT EXISTS idx_pronunciation_updated ON pronunciation_dictionary(updated_at);
    `);

    // 2. Initialize dictionary revision in app_metadata
    db.exec(`
      INSERT OR IGNORE INTO app_metadata (key, value, updated_at)
      VALUES ('pronunciation_dictionary_revision', '0', datetime('now'));
    `);
  }
};
