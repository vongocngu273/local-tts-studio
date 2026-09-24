import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { ProjectRow } from '../database.types';
import type {
  Project,
  ProjectListOptions,
  ProjectStatus,
  ProjectSettings
} from '@shared/types/project.types';
import type { ProviderId } from '@shared/types/provider.types';

export class ProjectRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public insert(project: Project): void {
    const row = this.toRow(project);
    this.db
      .prepare(
        `INSERT INTO projects (
          id, name, description, status, original_text, processed_text,
          provider_id, voice_id, settings_json, project_path, revision,
          created_at, updated_at, last_opened_at, deleted_at
        ) VALUES (
          @id, @name, @description, @status, @original_text, @processed_text,
          @provider_id, @voice_id, @settings_json, @project_path, @revision,
          @created_at, @updated_at, @last_opened_at, @deleted_at
        )`
      )
      .run(row);
  }

  public findById(id: string, includeDeleted = false): Project | null {
    const query = includeDeleted
      ? 'SELECT * FROM projects WHERE id = ?'
      : 'SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL';

    const row = this.db.prepare(query).get(id) as ProjectRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public findAll(options?: ProjectListOptions): Project[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!options?.includeDeleted) {
      conditions.push('deleted_at IS NULL');
    }

    if (options?.search && options.search.trim() !== '') {
      conditions.push('name LIKE ?');
      params.push(`%${options.search.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY updated_at DESC';
    switch (options?.sort) {
      case 'recently_created':
        orderBy = 'ORDER BY created_at DESC';
        break;
      case 'name_asc':
        orderBy = 'ORDER BY name COLLATE NOCASE ASC';
        break;
      case 'name_desc':
        orderBy = 'ORDER BY name COLLATE NOCASE DESC';
        break;
      case 'recently_updated':
      default:
        orderBy = 'ORDER BY updated_at DESC';
        break;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const sql = `SELECT * FROM projects ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as ProjectRow[];
    return rows.map((r) => this.toModel(r));
  }

  public count(includeDeleted = false): number {
    const query = includeDeleted
      ? 'SELECT COUNT(*) AS total FROM projects'
      : 'SELECT COUNT(*) AS total FROM projects WHERE deleted_at IS NULL';

    const result = this.db.prepare(query).get() as { total: number };
    return result.total;
  }

  public update(id: string, changes: Partial<Project>): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (changes.name !== undefined) {
      fields.push('name = @name');
      params.name = changes.name;
    }
    if (changes.description !== undefined) {
      fields.push('description = @description');
      params.description = changes.description;
    }
    if (changes.status !== undefined) {
      fields.push('status = @status');
      params.status = changes.status;
    }
    if (changes.originalText !== undefined) {
      fields.push('original_text = @original_text');
      params.original_text = changes.originalText;
    }
    if (changes.processedText !== undefined) {
      fields.push('processed_text = @processed_text');
      params.processed_text = changes.processedText;
    }
    if (changes.providerId !== undefined) {
      fields.push('provider_id = @provider_id');
      params.provider_id = changes.providerId;
    }
    if (changes.voiceId !== undefined) {
      fields.push('voice_id = @voice_id');
      params.voice_id = changes.voiceId;
    }
    if (changes.settings !== undefined) {
      fields.push('settings_json = @settings_json');
      params.settings_json = JSON.stringify(changes.settings);
    }
    if (changes.projectPath !== undefined) {
      fields.push('project_path = @project_path');
      params.project_path = changes.projectPath;
    }
    if (changes.revision !== undefined) {
      fields.push('revision = @revision');
      params.revision = changes.revision;
    }
    if (changes.lastOpenedAt !== undefined) {
      fields.push('last_opened_at = @last_opened_at');
      params.last_opened_at = changes.lastOpenedAt;
    }

    // Always update updated_at if not explicitly passed
    fields.push('updated_at = @updated_at');
    params.updated_at = changes.updatedAt ?? new Date().toISOString();

    if (fields.length === 1) return; // Only updated_at

    const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run(params);
  }

  public softDelete(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').run(now, id);
  }

  public restore(id: string): void {
    this.db.prepare('UPDATE projects SET deleted_at = NULL WHERE id = ?').run(id);
  }

  public touch(id: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE projects SET last_opened_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id);
  }

  public exists(id: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
    return Boolean(row);
  }

  /**
   * Updates processedText and settings without mutating originalText revision (Section 74).
   */
  public saveProcessedText(
    projectId: string,
    processedText: string,
    settings: ProjectSettings
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE projects SET
           processed_text = ?,
           settings_json = ?,
           updated_at = ?
         WHERE id = ?`
      )
      .run(processedText, JSON.stringify(settings), now, projectId);
  }

  private toModel(row: ProjectRow): Project {
    let settings: ProjectSettings = { version: 1 };
    try {
      if (row.settings_json) {
        settings = JSON.parse(row.settings_json);
      }
    } catch {
      settings = { version: 1 };
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status as ProjectStatus,
      originalText: row.original_text,
      processedText: row.processed_text,
      providerId: row.provider_id as ProviderId | null,
      voiceId: row.voice_id,
      settings,
      projectPath: row.project_path,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastOpenedAt: row.last_opened_at,
      deletedAt: row.deleted_at
    };
  }

  private toRow(model: Project): ProjectRow {
    return {
      id: model.id,
      name: model.name,
      description: model.description,
      status: model.status,
      original_text: model.originalText,
      processed_text: model.processedText,
      provider_id: model.providerId,
      voice_id: model.voiceId,
      settings_json: JSON.stringify(model.settings ?? { version: 1 }),
      project_path: model.projectPath,
      revision: model.revision,
      created_at: model.createdAt,
      updated_at: model.updatedAt,
      last_opened_at: model.lastOpenedAt,
      deleted_at: model.deletedAt ?? null
    };
  }
}

export const projectRepository = new ProjectRepository();
