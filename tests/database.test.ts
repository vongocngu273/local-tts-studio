import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SQLiteDatabaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { backupService } from '../src/main/database/backup.service';

describe('DatabaseService & SQLite Engine', () => {
  let tempBaseDir: string;
  let dbService: SQLiteDatabaseService;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-db-test-'));
    appPathsService.initialize(tempBaseDir);
    dbFilePath = path.join(tempBaseDir, 'database', 'test-studio.db');
    backupDir = path.join(tempBaseDir, 'backups');
    dbService = new SQLiteDatabaseService();
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should initialize database with WAL mode, foreign keys, and synchronous NORMAL', () => {
    dbService.initialize(dbFilePath, backupDir);
    const db = dbService.getConnection();

    expect(db).toBeDefined();

    // Check pragmas
    const journalMode = (db.pragma('journal_mode', { simple: true }) as string).toLowerCase();
    expect(journalMode).toBe('wal');

    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    expect(foreignKeys).toBe(1);

    const synchronous = db.pragma('synchronous', { simple: true }) as number;
    expect(synchronous).toBe(1); // 1 = NORMAL

    expect(dbService.isHealthy()).toBe(true);
  });

  it('should execute migrations and create all required tables and indexes', () => {
    dbService.initialize(dbFilePath, backupDir);
    const db = dbService.getConnection();

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('projects');
    expect(tableNames).toContain('project_drafts');
    expect(tableNames).toContain('app_metadata');
    expect(tableNames).toContain('schema_migrations');

    // Verify indexes exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_projects_updated_at');
    expect(indexNames).toContain('idx_projects_deleted_at');
    expect(indexNames).toContain('idx_projects_name');
  });

  it('should create database backups and rotate old ones when limit exceeded', () => {
    dbService.initialize(dbFilePath, backupDir);

    const initialBackupCount = fs.readdirSync(backupDir).length;

    // Create 4 backup files manually
    for (let i = 0; i < 4; i++) {
      const bFile = path.join(backupDir, `local-tts-studio-20260101-00000${i}.db`);
      fs.writeFileSync(bFile, `backup-${i}`);
    }

    expect(fs.readdirSync(backupDir).length).toBe(initialBackupCount + 4);

    // Rotate with maxCount = 2
    backupService.rotateBackups(backupDir, 2);

    const remaining = fs.readdirSync(backupDir);
    expect(remaining.length).toBe(2);
  });
});
