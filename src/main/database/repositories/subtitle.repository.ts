import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { SubtitleExportRow } from '../database.types';

export class SubtitleRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public insert(item: SubtitleExportRow): void {
    this.db
      .prepare(
        `INSERT INTO subtitle_exports (
          id, project_id, composition_id, format, source_type,
          output_path, cue_count, settings_json, created_at
        ) VALUES (
          @id, @project_id, @composition_id, @format, @source_type,
          @output_path, @cue_count, @settings_json, @created_at
        )`
      )
      .run(item);
  }

  public listByProject(projectId: string): SubtitleExportRow[] {
    return this.db
      .prepare('SELECT * FROM subtitle_exports WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId) as SubtitleExportRow[];
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM subtitle_exports WHERE id = ?').run(id);
    return res.changes > 0;
  }
}

export const subtitleRepository = new SubtitleRepository();
