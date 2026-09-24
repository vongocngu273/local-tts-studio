import type { Migration } from './migration.types';

export const migration001: Migration = {
  version: 1,
  name: '001_initial_schema',
  up: (db) => {
    // 1. Projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        original_text TEXT NOT NULL DEFAULT '',
        processed_text TEXT NOT NULL DEFAULT '',
        provider_id TEXT,
        voice_id TEXT,
        settings_json TEXT NOT NULL DEFAULT '{}',
        project_path TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT,
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
      CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
    `);

    // 2. Project Drafts table for crash recovery
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_drafts (
        project_id TEXT PRIMARY KEY,
        original_text TEXT NOT NULL DEFAULT '',
        processed_text TEXT NOT NULL DEFAULT '',
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    // 3. App metadata key-value table
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
};
