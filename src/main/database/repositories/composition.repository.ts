import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { AudioCompositionRow } from '../database.types';
import type { AudioComposition, AudioCompositionSettings } from '@shared/types/composition.types';
import { DEFAULT_COMPOSITION_SETTINGS } from '@shared/types/composition.types';

export class CompositionRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public insert(comp: AudioComposition): void {
    const row = this.toRow(comp);
    this.db
      .prepare(
        `INSERT INTO audio_compositions (
          id, project_id, source_fingerprint, segment_count, output_mp3_path,
          output_wav_path, duration_ms, size_bytes, settings_json, status,
          created_at, completed_at
        ) VALUES (
          @id, @project_id, @source_fingerprint, @segment_count, @output_mp3_path,
          @output_wav_path, @duration_ms, @size_bytes, @settings_json, @status,
          @created_at, @completed_at
        )`
      )
      .run(row);
  }

  public getById(id: string): AudioComposition | null {
    const row = this.db
      .prepare('SELECT * FROM audio_compositions WHERE id = ?')
      .get(id) as AudioCompositionRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public getLatestByProject(projectId: string): AudioComposition | null {
    const row = this.db
      .prepare(
        `SELECT * FROM audio_compositions 
         WHERE project_id = ? AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(projectId) as AudioCompositionRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public getByFingerprint(projectId: string, fingerprint: string): AudioComposition | null {
    const row = this.db
      .prepare(
        `SELECT * FROM audio_compositions 
         WHERE project_id = ? AND source_fingerprint = ? AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(projectId, fingerprint) as AudioCompositionRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM audio_compositions WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public deleteByProject(projectId: string): number {
    const res = this.db.prepare('DELETE FROM audio_compositions WHERE project_id = ?').run(projectId);
    return res.changes;
  }

  private toRow(comp: AudioComposition): AudioCompositionRow {
    return {
      id: comp.id,
      project_id: comp.projectId,
      source_fingerprint: comp.sourceFingerprint,
      segment_count: comp.segmentCount,
      output_mp3_path: comp.outputMp3Path,
      output_wav_path: comp.outputWavPath,
      duration_ms: comp.durationMs,
      size_bytes: comp.sizeBytes,
      settings_json: JSON.stringify(comp.settings || {}),
      status: comp.status,
      created_at: comp.createdAt,
      completed_at: comp.completedAt
    };
  }

  private toModel(row: AudioCompositionRow): AudioComposition {
    let settings: AudioCompositionSettings = DEFAULT_COMPOSITION_SETTINGS;
    try {
      if (row.settings_json) {
        settings = { ...DEFAULT_COMPOSITION_SETTINGS, ...JSON.parse(row.settings_json) };
      }
    } catch {
      settings = DEFAULT_COMPOSITION_SETTINGS;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      sourceFingerprint: row.source_fingerprint,
      segmentCount: row.segment_count,
      outputMp3Path: row.output_mp3_path,
      outputWavPath: row.output_wav_path,
      durationMs: row.duration_ms,
      sizeBytes: row.size_bytes,
      settings,
      status: row.status as 'completed' | 'failed' | 'processing',
      createdAt: row.created_at,
      completedAt: row.completed_at
    };
  }
}

export const compositionRepository = new CompositionRepository();
