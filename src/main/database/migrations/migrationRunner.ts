import type Database from 'better-sqlite3';
import { migration001 } from './001_initial_schema';
import { migration002 } from './002_pronunciation_dictionary';
import { migration003 } from './003_tts_providers';
import { migration004 } from './004_segment_queue_audio_pipeline';
import type { Migration } from './migration.types';
import type { SchemaMigrationRow } from '../database.types';
import { backupService } from '../backup.service';
import { logger } from '../../services/logger/logger';

export const CURRENT_DATABASE_SCHEMA_VERSION = 4;

export const ALL_MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004
];

export class MigrationRunner {
  public runMigrations(db: Database.Database, dbFilePath: string, backupDir: string): void {
    logger.info('database:migration', 'Starting schema migration verification');

    // 1. Ensure schema_migrations table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    // 2. Fetch applied migration versions
    const appliedRows = db
      .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
      .all() as Pick<SchemaMigrationRow, 'version'>[];

    const appliedVersions = new Set(appliedRows.map((r) => r.version));

    // 3. Find pending migrations
    const pendingMigrations = ALL_MIGRATIONS.filter((m) => !appliedVersions.has(m.version)).sort(
      (a, b) => a.version - b.version
    );

    if (pendingMigrations.length === 0) {
      logger.info('database:migration', 'Database schema is already up to date');
      return;
    }

    logger.info(
      'database:migration',
      `Found ${pendingMigrations.length} pending migration(s). Creating safety backup first.`
    );

    // 4. Section 78: Create database backup before applying pending migrations
    backupService.createBackup(dbFilePath, backupDir);

    // 5. Apply each pending migration inside an atomic transaction
    for (const migration of pendingMigrations) {
      logger.info(
        'database:migration',
        `Applying migration v${migration.version}: ${migration.name}`
      );

      const applyTx = db.transaction(() => {
        migration.up(db);
        db.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).run(migration.version, migration.name, new Date().toISOString());
      });

      try {
        applyTx();
        logger.info(
          'database:migration',
          `Successfully applied migration v${migration.version}: ${migration.name}`
        );
      } catch (error) {
        logger.error(
          'database:migration',
          `Fatal error applying migration v${migration.version}: ${migration.name}`,
          error
        );
        throw error;
      }
    }
  }
}

export const migrationRunner = new MigrationRunner();
