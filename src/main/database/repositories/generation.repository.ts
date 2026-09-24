import { databaseService } from '../database.service';
import type { TtsGenerationRow } from '../database.types';
import type {
  TTSGeneration,
  GenerationPurpose,
  GenerationStatus,
  ProviderId,
  VoiceSettings
} from '@shared/types/provider.types';

export class GenerationRepository {
  public create(data: {
    id: string;
    projectId?: string | null;
    purpose?: GenerationPurpose;
    providerId: ProviderId;
    voiceId: string;
    modelId?: string | null;
    inputHash: string;
    dictionaryRevision?: number;
    processorVersion?: number;
    characterCount?: number;
    status?: GenerationStatus;
    outputPath?: string | null;
    outputFormat?: string;
    mimeType?: string;
    sizeBytes?: number | null;
    providerRequestId?: string | null;
    providerJobId?: string | null;
    settings?: VoiceSettings;
    timingPath?: string | null;
    providerSubtitlePath?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }): TTSGeneration {
    const db = databaseService.getConnection();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tts_generations (
        id, project_id, purpose, provider_id, voice_id, model_id,
        input_hash, dictionary_revision, processor_version, character_count,
        status, output_path, output_format, mime_type, size_bytes,
        provider_request_id, provider_job_id, settings_json, timing_path,
        provider_subtitle_path, error_code, error_message, created_at,
        started_at, completed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      data.id,
      data.projectId ?? null,
      data.purpose ?? 'project',
      data.providerId,
      data.voiceId,
      data.modelId ?? null,
      data.inputHash,
      data.dictionaryRevision ?? 0,
      data.processorVersion ?? 1,
      data.characterCount ?? 0,
      data.status ?? 'processing',
      data.outputPath ?? null,
      data.outputFormat ?? 'mp3',
      data.mimeType ?? 'audio/mpeg',
      data.sizeBytes ?? null,
      data.providerRequestId ?? null,
      data.providerJobId ?? null,
      data.settings ? JSON.stringify(data.settings) : '{}',
      data.timingPath ?? null,
      data.providerSubtitlePath ?? null,
      data.errorCode ?? null,
      data.errorMessage ?? null,
      now,
      data.startedAt ?? now,
      data.completedAt ?? null
    );

    return this.getById(data.id)!;
  }

  public update(
    id: string,
    updates: Partial<{
      status: GenerationStatus;
      outputPath: string | null;
      sizeBytes: number | null;
      providerRequestId: string | null;
      providerJobId: string | null;
      timingPath: string | null;
      providerSubtitlePath: string | null;
      errorCode: string | null;
      errorMessage: string | null;
      completedAt: string | null;
    }>
  ): TTSGeneration | null {
    const db = databaseService.getConnection();
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      params.push(updates.status);
    }
    if (updates.outputPath !== undefined) {
      sets.push('output_path = ?');
      params.push(updates.outputPath);
    }
    if (updates.sizeBytes !== undefined) {
      sets.push('size_bytes = ?');
      params.push(updates.sizeBytes);
    }
    if (updates.providerRequestId !== undefined) {
      sets.push('provider_request_id = ?');
      params.push(updates.providerRequestId);
    }
    if (updates.providerJobId !== undefined) {
      sets.push('provider_job_id = ?');
      params.push(updates.providerJobId);
    }
    if (updates.timingPath !== undefined) {
      sets.push('timing_path = ?');
      params.push(updates.timingPath);
    }
    if (updates.providerSubtitlePath !== undefined) {
      sets.push('provider_subtitle_path = ?');
      params.push(updates.providerSubtitlePath);
    }
    if (updates.errorCode !== undefined) {
      sets.push('error_code = ?');
      params.push(updates.errorCode);
    }
    if (updates.errorMessage !== undefined) {
      sets.push('error_message = ?');
      params.push(updates.errorMessage);
    }
    if (updates.completedAt !== undefined) {
      sets.push('completed_at = ?');
      params.push(updates.completedAt);
    }

    if (sets.length === 0) return this.getById(id);

    params.push(id);
    db.prepare(`UPDATE tts_generations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  public getById(id: string): TTSGeneration | null {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT * FROM tts_generations WHERE id = ?')
      .get(id) as TtsGenerationRow | undefined;
    return row ? this.mapRowToGeneration(row) : null;
  }

  public getByHash(inputHash: string, purpose?: GenerationPurpose): TTSGeneration | null {
    const db = databaseService.getConnection();
    let query = "SELECT * FROM tts_generations WHERE input_hash = ? AND status = 'completed'";
    const params: unknown[] = [inputHash];

    if (purpose) {
      query += ' AND purpose = ?';
      params.push(purpose);
    }
    query += ' ORDER BY created_at DESC LIMIT 1';

    const row = db.prepare(query).get(...params) as TtsGenerationRow | undefined;
    return row ? this.mapRowToGeneration(row) : null;
  }

  public list(projectId?: string, limit = 50): TTSGeneration[] {
    const db = databaseService.getConnection();
    let query = 'SELECT * FROM tts_generations';
    const params: unknown[] = [];

    if (projectId) {
      query += ' WHERE project_id = ?';
      params.push(projectId);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as TtsGenerationRow[];
    return rows.map((r) => this.mapRowToGeneration(r));
  }

  public delete(id: string): boolean {
    const db = databaseService.getConnection();
    const info = db.prepare('DELETE FROM tts_generations WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private mapRowToGeneration(row: TtsGenerationRow): TTSGeneration {
    let settings: VoiceSettings = {};
    try {
      settings = JSON.parse(row.settings_json);
    } catch {
      // fallback
    }

    return {
      id: row.id,
      projectId: row.project_id,
      purpose: row.purpose as GenerationPurpose,
      providerId: row.provider_id as ProviderId,
      voiceId: row.voice_id,
      modelId: row.model_id,
      inputHash: row.input_hash,
      dictionaryRevision: row.dictionary_revision,
      processorVersion: row.processor_version,
      characterCount: row.character_count,
      status: row.status as GenerationStatus,
      outputPath: row.output_path,
      outputFormat: row.output_format,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      providerRequestId: row.provider_request_id,
      providerJobId: row.provider_job_id,
      settings,
      timingPath: row.timing_path,
      providerSubtitlePath: row.provider_subtitle_path,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      playbackUrl: row.output_path ? `localtts-audio://generation/${row.id}` : null,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at
    };
  }
}

export const generationRepository = new GenerationRepository();
