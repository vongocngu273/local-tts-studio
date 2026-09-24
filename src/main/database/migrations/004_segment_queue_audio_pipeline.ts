import type Database from 'better-sqlite3';
import type { Migration } from './migration.types';

export const migration004: Migration = {
  version: 4,
  name: '004_segment_queue_audio_pipeline',
  up: (db: Database.Database): void => {
    // 1. Project Segments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_segments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        segment_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        text_hash TEXT NOT NULL,
        base_text TEXT NOT NULL,
        override_text TEXT,
        has_override INTEGER NOT NULL DEFAULT 0,
        source_start INTEGER NOT NULL,
        source_end INTEGER NOT NULL,
        paragraph_index INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        provider_id TEXT,
        voice_id TEXT,
        model_id TEXT,
        settings_json TEXT NOT NULL DEFAULT '{}',
        generation_id TEXT,
        audio_path TEXT,
        timing_path TEXT,
        duration_ms INTEGER,
        character_count INTEGER NOT NULL,
        pause_after_ms INTEGER,
        error_code TEXT,
        error_message TEXT,
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_segments_project_index ON project_segments(project_id, segment_index);
      CREATE INDEX IF NOT EXISTS idx_segments_project_status ON project_segments(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_segments_hash ON project_segments(text_hash);
    `);

    // 2. Persistent TTS Jobs Queue table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tts_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        segment_id TEXT,
        job_type TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        attempt INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        provider_job_id TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT,
        available_at TEXT NOT NULL,
        started_at TEXT,
        heartbeat_at TEXT,
        completed_at TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (segment_id) REFERENCES project_segments(id) ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_queue_pickup ON tts_jobs(status, priority DESC, available_at ASC, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_jobs_project ON tts_jobs(project_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_segment ON tts_jobs(segment_id);
    `);

    // 3. Audio Compositions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS audio_compositions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_fingerprint TEXT NOT NULL,
        segment_count INTEGER NOT NULL,
        output_mp3_path TEXT,
        output_wav_path TEXT,
        duration_ms INTEGER,
        size_bytes INTEGER,
        settings_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_compositions_project ON audio_compositions(project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_compositions_fingerprint ON audio_compositions(source_fingerprint);
    `);

    // 4. Subtitle Exports table
    db.exec(`
      CREATE TABLE IF NOT EXISTS subtitle_exports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        composition_id TEXT,
        format TEXT NOT NULL,
        source_type TEXT NOT NULL,
        output_path TEXT NOT NULL,
        cue_count INTEGER NOT NULL,
        settings_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (composition_id) REFERENCES audio_compositions(id) ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_subtitles_project ON subtitle_exports(project_id);
    `);
  }
};
