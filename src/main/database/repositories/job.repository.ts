import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { TtsJobRow } from '../database.types';
import type { TTSJob, JobStatus, JobType } from '@shared/types/queue.types';
import type { ProviderId } from '@shared/types/provider.types';

export class JobRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public insert(job: TTSJob): void {
    const row = this.toRow(job);
    this.db
      .prepare(
        `INSERT INTO tts_jobs (
          id, project_id, segment_id, job_type, provider_id, status,
          priority, attempt, max_attempts, provider_job_id, payload_json,
          result_json, available_at, started_at, heartbeat_at, completed_at,
          error_code, error_message, created_at, updated_at
        ) VALUES (
          @id, @project_id, @segment_id, @job_type, @provider_id, @status,
          @priority, @attempt, @max_attempts, @provider_job_id, @payload_json,
          @result_json, @available_at, @started_at, @heartbeat_at, @completed_at,
          @error_code, @error_message, @created_at, @updated_at
        )`
      )
      .run(row);
  }

  public insertBatch(jobs: TTSJob[]): void {
    if (jobs.length === 0) return;
    const stmt = this.db.prepare(
      `INSERT INTO tts_jobs (
        id, project_id, segment_id, job_type, provider_id, status,
        priority, attempt, max_attempts, provider_job_id, payload_json,
        result_json, available_at, started_at, heartbeat_at, completed_at,
        error_code, error_message, created_at, updated_at
      ) VALUES (
        @id, @project_id, @segment_id, @job_type, @provider_id, @status,
        @priority, @attempt, @max_attempts, @provider_job_id, @payload_json,
        @result_json, @available_at, @started_at, @heartbeat_at, @completed_at,
        @error_code, @error_message, @created_at, @updated_at
      )`
    );

    const tx = this.db.transaction((items: TTSJob[]) => {
      for (const item of items) {
        stmt.run(this.toRow(item));
      }
    });

    tx(jobs);
  }

  public getById(id: string): TTSJob | null {
    const row = this.db
      .prepare('SELECT * FROM tts_jobs WHERE id = ?')
      .get(id) as TtsJobRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public listByProject(projectId: string): TTSJob[] {
    const rows = this.db
      .prepare('SELECT * FROM tts_jobs WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as TtsJobRow[];
    return rows.map((r) => this.toModel(r));
  }

  public getPendingJobs(limit = 10): TTSJob[] {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare(
        `SELECT * FROM tts_jobs 
         WHERE status IN ('pending', 'retry_wait') AND available_at <= ?
         ORDER BY priority DESC, available_at ASC, created_at ASC 
         LIMIT ?`
      )
      .all(now, limit) as TtsJobRow[];
    return rows.map((r) => this.toModel(r));
  }

  public update(id: string, updates: Partial<TTSJob>): TTSJob | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const merged: TTSJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const row = this.toRow(merged);
    this.db
      .prepare(
        `UPDATE tts_jobs SET
          segment_id = @segment_id,
          job_type = @job_type,
          provider_id = @provider_id,
          status = @status,
          priority = @priority,
          attempt = @attempt,
          max_attempts = @max_attempts,
          provider_job_id = @provider_job_id,
          payload_json = @payload_json,
          result_json = @result_json,
          available_at = @available_at,
          started_at = @started_at,
          heartbeat_at = @heartbeat_at,
          completed_at = @completed_at,
          error_code = @error_code,
          error_message = @error_message,
          updated_at = @updated_at
        WHERE id = @id`
      )
      .run(row);

    return merged;
  }

  public updateHeartbeat(id: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE tts_jobs SET heartbeat_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id);
  }

  public cancelPendingJobs(projectId: string): number {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `UPDATE tts_jobs SET status = 'cancelled', updated_at = ?
         WHERE project_id = ? AND status IN ('pending', 'retry_wait')`
      )
      .run(now, projectId);
    return res.changes;
  }

  public recoverInterruptedJobs(): number {
    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `UPDATE tts_jobs 
         SET status = 'interrupted', updated_at = ?
         WHERE status = 'running'`
      )
      .run(now);
    return res.changes;
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM tts_jobs WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public deleteByProject(projectId: string): number {
    const res = this.db.prepare('DELETE FROM tts_jobs WHERE project_id = ?').run(projectId);
    return res.changes;
  }

  public countByStatus(projectId: string): Record<JobStatus, number> {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) as count FROM tts_jobs WHERE project_id = ? GROUP BY status')
      .all(projectId) as { status: JobStatus; count: number }[];

    const result: Record<JobStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      retry_wait: 0,
      cancelled: 0,
      interrupted: 0
    };

    for (const r of rows) {
      if (r.status in result) {
        result[r.status] = r.count;
      }
    }

    return result;
  }

  private toRow(job: TTSJob): TtsJobRow {
    return {
      id: job.id,
      project_id: job.projectId,
      segment_id: job.segmentId,
      job_type: job.jobType,
      provider_id: job.providerId,
      status: job.status,
      priority: job.priority,
      attempt: job.attempt,
      max_attempts: job.maxAttempts,
      provider_job_id: job.providerJobId,
      payload_json: JSON.stringify(job.payload || {}),
      result_json: job.result ? JSON.stringify(job.result) : null,
      available_at: job.availableAt,
      started_at: job.startedAt,
      heartbeat_at: job.heartbeatAt,
      completed_at: job.completedAt,
      error_code: job.errorCode,
      error_message: job.errorMessage,
      created_at: job.createdAt,
      updated_at: job.updatedAt
    };
  }

  private toModel(row: TtsJobRow): TTSJob {
    let payload: Record<string, unknown> = {};
    let result: Record<string, unknown> | null = null;
    try {
      if (row.payload_json) payload = JSON.parse(row.payload_json);
    } catch {
      payload = {};
    }
    try {
      if (row.result_json) result = JSON.parse(row.result_json);
    } catch {
      result = null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      segmentId: row.segment_id,
      jobType: row.job_type as JobType,
      providerId: row.provider_id as ProviderId,
      status: row.status as JobStatus,
      priority: row.priority,
      attempt: row.attempt,
      maxAttempts: row.max_attempts,
      providerJobId: row.provider_job_id,
      payload,
      result,
      availableAt: row.available_at,
      startedAt: row.started_at,
      heartbeatAt: row.heartbeat_at,
      completedAt: row.completed_at,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const jobRepository = new JobRepository();
