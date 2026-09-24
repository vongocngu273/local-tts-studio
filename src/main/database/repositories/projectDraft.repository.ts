import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { ProjectDraftRow } from '../database.types';
import type { ProjectDraft } from '@shared/types/project.types';

export class ProjectDraftRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public upsertDraft(draft: ProjectDraft): void {
    this.db
      .prepare(
        `INSERT INTO project_drafts (project_id, original_text, processed_text, revision, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           original_text = excluded.original_text,
           processed_text = excluded.processed_text,
           revision = excluded.revision,
           updated_at = excluded.updated_at`
      )
      .run(
        draft.projectId,
        draft.originalText,
        draft.processedText,
        draft.revision,
        draft.updatedAt
      );
  }

  public findByProjectId(projectId: string): ProjectDraft | null {
    const row = this.db
      .prepare('SELECT * FROM project_drafts WHERE project_id = ?')
      .get(projectId) as ProjectDraftRow | undefined;

    if (!row) return null;

    return {
      projectId: row.project_id,
      originalText: row.original_text,
      processedText: row.processed_text,
      revision: row.revision,
      updatedAt: row.updated_at
    };
  }

  public deleteByProjectId(projectId: string): void {
    this.db.prepare('DELETE FROM project_drafts WHERE project_id = ?').run(projectId);
  }
}

export const projectDraftRepository = new ProjectDraftRepository();
