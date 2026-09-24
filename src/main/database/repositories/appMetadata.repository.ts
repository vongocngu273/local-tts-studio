import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { AppMetadataRow } from '../database.types';

export class AppMetadataRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public get(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM app_metadata WHERE key = ?')
      .get(key) as Pick<AppMetadataRow, 'value'> | undefined;
    return row ? row.value : null;
  }

  public set(key: string, value: string): void {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO app_metadata (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run(key, value, updatedAt);
  }

  /**
   * Section 81: Clean shutdown flag tracking
   */
  public isCleanShutdown(): boolean {
    const val = this.get('last_shutdown_clean');
    return val !== 'false';
  }

  public setCleanShutdown(isClean: boolean): void {
    this.set('last_shutdown_clean', isClean ? 'true' : 'false');
  }

  /**
   * Pronunciation Dictionary Revision Tracking (Phase 3 Section 7)
   */
  public getDictionaryRevision(): number {
    const val = this.get('pronunciation_dictionary_revision');
    if (!val) return 0;
    const parsed = parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  public incrementDictionaryRevision(): number {
    const current = this.getDictionaryRevision();
    const next = current + 1;
    this.set('pronunciation_dictionary_revision', String(next));
    return next;
  }
}

export const appMetadataRepository = new AppMetadataRepository();
