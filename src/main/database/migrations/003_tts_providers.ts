import type { Migration } from './migration.types';

export const migration003: Migration = {
  version: 3,
  name: '003_tts_providers',
  up: (db) => {
    // 1. Provider Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_settings (
        provider_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        default_voice_id TEXT,
        default_model_id TEXT,
        config_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 2. Provider Secrets table (stores safeStorage encrypted values)
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_secrets (
        provider_id TEXT NOT NULL,
        secret_name TEXT NOT NULL,
        encrypted_value TEXT NOT NULL,
        encryption_version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider_id, secret_name)
      );
    `);

    // 3. Voice Cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tts_voice_cache (
        provider_id TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        name TEXT NOT NULL,
        locale TEXT NOT NULL,
        language TEXT NOT NULL,
        gender TEXT NOT NULL,
        description TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        cached_at TEXT NOT NULL,
        PRIMARY KEY (provider_id, voice_id)
      );

      CREATE INDEX IF NOT EXISTS idx_voice_provider ON tts_voice_cache(provider_id);
      CREATE INDEX IF NOT EXISTS idx_voice_locale ON tts_voice_cache(locale);
      CREATE INDEX IF NOT EXISTS idx_voice_gender ON tts_voice_cache(gender);
    `);

    // 4. TTS Generations history table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tts_generations (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        purpose TEXT NOT NULL DEFAULT 'project',
        provider_id TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        model_id TEXT,
        input_hash TEXT NOT NULL,
        dictionary_revision INTEGER NOT NULL DEFAULT 0,
        processor_version INTEGER NOT NULL DEFAULT 1,
        character_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'processing',
        output_path TEXT,
        output_format TEXT NOT NULL DEFAULT 'mp3',
        mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
        size_bytes INTEGER,
        provider_request_id TEXT,
        provider_job_id TEXT,
        settings_json TEXT NOT NULL DEFAULT '{}',
        timing_path TEXT,
        provider_subtitle_path TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_generation_project ON tts_generations(project_id);
      CREATE INDEX IF NOT EXISTS idx_generation_provider ON tts_generations(provider_id);
      CREATE INDEX IF NOT EXISTS idx_generation_status ON tts_generations(status);
      CREATE INDEX IF NOT EXISTS idx_generation_created ON tts_generations(created_at);
      CREATE INDEX IF NOT EXISTS idx_generation_hash ON tts_generations(input_hash);
    `);

    // 5. Voice Favorites table
    db.exec(`
      CREATE TABLE IF NOT EXISTS voice_favorites (
        provider_id TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (provider_id, voice_id)
      );
    `);

    // 6. Seed initial provider settings
    const now = new Date().toISOString();
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO provider_settings (provider_id, enabled, default_voice_id, default_model_id, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertSetting.run('edge-tts', 1, 'vi-VN-HoaiMyNeural', null, '{}', now, now);
    insertSetting.run('lucylab', 1, null, null, '{}', now, now);
    insertSetting.run('elevenlabs', 1, null, 'eleven_multilingual_v2', '{}', now, now);
    insertSetting.run('vbee', 1, null, null, '{}', now, now);
  }
};
