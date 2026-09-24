import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { ProjectSegmentRow } from '../database.types';
import type { ProjectSegment, SegmentStatus } from '@shared/types/segment.types';
import type { ProviderId, VoiceSettings } from '@shared/types/provider.types';

export class SegmentRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public insert(segment: ProjectSegment): void {
    const row = this.toRow(segment);
    this.db
      .prepare(
        `INSERT INTO project_segments (
          id, project_id, segment_index, text, text_hash, base_text, override_text,
          has_override, source_start, source_end, paragraph_index, status,
          provider_id, voice_id, model_id, settings_json, generation_id,
          audio_path, timing_path, duration_ms, character_count, pause_after_ms,
          error_code, error_message, revision, created_at, updated_at, completed_at
        ) VALUES (
          @id, @project_id, @segment_index, @text, @text_hash, @base_text, @override_text,
          @has_override, @source_start, @source_end, @paragraph_index, @status,
          @provider_id, @voice_id, @model_id, @settings_json, @generation_id,
          @audio_path, @timing_path, @duration_ms, @character_count, @pause_after_ms,
          @error_code, @error_message, @revision, @created_at, @updated_at, @completed_at
        )`
      )
      .run(row);
  }

  public insertBatch(segments: ProjectSegment[]): void {
    if (segments.length === 0) return;
    const stmt = this.db.prepare(
      `INSERT INTO project_segments (
        id, project_id, segment_index, text, text_hash, base_text, override_text,
        has_override, source_start, source_end, paragraph_index, status,
        provider_id, voice_id, model_id, settings_json, generation_id,
        audio_path, timing_path, duration_ms, character_count, pause_after_ms,
        error_code, error_message, revision, created_at, updated_at, completed_at
      ) VALUES (
        @id, @project_id, @segment_index, @text, @text_hash, @base_text, @override_text,
        @has_override, @source_start, @source_end, @paragraph_index, @status,
        @provider_id, @voice_id, @model_id, @settings_json, @generation_id,
        @audio_path, @timing_path, @duration_ms, @character_count, @pause_after_ms,
        @error_code, @error_message, @revision, @created_at, @updated_at, @completed_at
      )`
    );

    const tx = this.db.transaction((items: ProjectSegment[]) => {
      for (const item of items) {
        stmt.run(this.toRow(item));
      }
    });

    tx(segments);
  }

  public getById(id: string): ProjectSegment | null {
    const row = this.db
      .prepare('SELECT * FROM project_segments WHERE id = ?')
      .get(id) as ProjectSegmentRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public listByProject(projectId: string): ProjectSegment[] {
    const rows = this.db
      .prepare('SELECT * FROM project_segments WHERE project_id = ? ORDER BY segment_index ASC')
      .all(projectId) as ProjectSegmentRow[];
    return rows.map((r) => this.toModel(r));
  }

  public findReusableSegment(projectId: string, textHash: string): ProjectSegment | null {
    const row = this.db
      .prepare(
        `SELECT * FROM project_segments 
         WHERE project_id = ? AND text_hash = ? AND status = 'completed' AND audio_path IS NOT NULL
         ORDER BY completed_at DESC LIMIT 1`
      )
      .get(projectId, textHash) as ProjectSegmentRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public update(id: string, updates: Partial<ProjectSegment>): ProjectSegment | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const merged: ProjectSegment = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const row = this.toRow(merged);
    this.db
      .prepare(
        `UPDATE project_segments SET
          segment_index = @segment_index,
          text = @text,
          text_hash = @text_hash,
          base_text = @base_text,
          override_text = @override_text,
          has_override = @has_override,
          source_start = @source_start,
          source_end = @source_end,
          paragraph_index = @paragraph_index,
          status = @status,
          provider_id = @provider_id,
          voice_id = @voice_id,
          model_id = @model_id,
          settings_json = @settings_json,
          generation_id = @generation_id,
          audio_path = @audio_path,
          timing_path = @timing_path,
          duration_ms = @duration_ms,
          character_count = @character_count,
          pause_after_ms = @pause_after_ms,
          error_code = @error_code,
          error_message = @error_message,
          revision = @revision,
          updated_at = @updated_at,
          completed_at = @completed_at
        WHERE id = @id`
      )
      .run(row);

    return merged;
  }

  public updateOverrideText(id: string, overrideText: string | null): ProjectSegment | null {
    const segment = this.getById(id);
    if (!segment) return null;

    const trimmed = overrideText?.trim() || null;
    const hasOverride = trimmed !== null && trimmed !== segment.baseText;
    const effectiveText = hasOverride && trimmed ? trimmed : segment.baseText;

    return this.update(id, {
      overrideText: hasOverride ? trimmed : null,
      hasOverride,
      text: effectiveText,
      characterCount: effectiveText.length,
      status: 'stale', // manual edit requires regeneration
      revision: segment.revision + 1
    });
  }

  public resetOverride(id: string): ProjectSegment | null {
    const segment = this.getById(id);
    if (!segment) return null;

    return this.update(id, {
      overrideText: null,
      hasOverride: false,
      text: segment.baseText,
      characterCount: segment.baseText.length,
      status: 'stale',
      revision: segment.revision + 1
    });
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM project_segments WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public deleteByProject(projectId: string): number {
    const res = this.db.prepare('DELETE FROM project_segments WHERE project_id = ?').run(projectId);
    return res.changes;
  }

  public countByStatus(projectId: string): Record<SegmentStatus, number> {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) as count FROM project_segments WHERE project_id = ? GROUP BY status')
      .all(projectId) as { status: SegmentStatus; count: number }[];

    const result: Record<SegmentStatus, number> = {
      pending: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      stale: 0
    };

    for (const r of rows) {
      if (r.status in result) {
        result[r.status] = r.count;
      }
    }

    return result;
  }

  private toRow(segment: ProjectSegment): ProjectSegmentRow {
    return {
      id: segment.id,
      project_id: segment.projectId,
      segment_index: segment.segmentIndex,
      text: segment.text,
      text_hash: segment.textHash,
      base_text: segment.baseText,
      override_text: segment.overrideText,
      has_override: segment.hasOverride ? 1 : 0,
      source_start: segment.sourceStart,
      source_end: segment.sourceEnd,
      paragraph_index: segment.paragraphIndex,
      status: segment.status,
      provider_id: segment.providerId,
      voice_id: segment.voiceId,
      model_id: segment.modelId,
      settings_json: JSON.stringify(segment.settings || {}),
      generation_id: segment.generationId,
      audio_path: segment.audioPath,
      timing_path: segment.timingPath,
      duration_ms: segment.durationMs,
      character_count: segment.characterCount,
      pause_after_ms: segment.pauseAfterMs,
      error_code: segment.errorCode,
      error_message: segment.errorMessage,
      revision: segment.revision,
      created_at: segment.createdAt,
      updated_at: segment.updatedAt,
      completed_at: segment.completedAt
    };
  }

  private toModel(row: ProjectSegmentRow): ProjectSegment {
    let settings: VoiceSettings = {};
    try {
      if (row.settings_json) {
        settings = JSON.parse(row.settings_json);
      }
    } catch {
      settings = {};
    }

    return {
      id: row.id,
      projectId: row.project_id,
      segmentIndex: row.segment_index,
      text: row.text,
      textHash: row.text_hash,
      baseText: row.base_text,
      overrideText: row.override_text,
      hasOverride: row.has_override === 1,
      sourceStart: row.source_start,
      sourceEnd: row.source_end,
      paragraphIndex: row.paragraph_index,
      status: row.status as SegmentStatus,
      providerId: row.provider_id as ProviderId | null,
      voiceId: row.voice_id,
      modelId: row.model_id,
      settings,
      generationId: row.generation_id,
      audioPath: row.audio_path,
      timingPath: row.timing_path,
      durationMs: row.duration_ms,
      characterCount: row.character_count,
      pauseAfterMs: row.pause_after_ms,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }
}

export const segmentRepository = new SegmentRepository();
