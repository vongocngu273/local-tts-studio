import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { appPathsService } from '../services/app-paths/appPaths.service';
import { migrationRunner } from './migrations/migrationRunner';
import { logger } from '../services/logger/logger';

export interface DatabaseService {
  initialize(customDbPath?: string, customBackupDir?: string): void;
  close(): void;
  getConnection(): Database.Database;
  runMigrations(): void;
  isHealthy(): boolean;
}

export class SQLiteDatabaseService implements DatabaseService {
  private db: Database.Database | null = null;
  private dbFilePath: string | null = null;
  private backupDir: string | null = null;

  public initialize(customDbPath?: string, customBackupDir?: string): void {
    if (this.db) {
      logger.warn('database', 'Database already initialized, skipping');
      return;
    }

    const paths = appPathsService.getPaths();
    this.dbFilePath = customDbPath ?? path.join(paths.database, 'local-tts-studio.db');
    this.backupDir = customBackupDir ?? paths.backups;

    logger.info('database', `Opening SQLite database at: ${this.dbFilePath}`);

    // Ensure database parent directory exists
    const parentDir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    try {
      this.db = new Database(this.dbFilePath, {
        verbose: (message) => {
          // Sanitized debug logging
          logger.debug('sqlite', String(message));
        }
      });

      // Section 6: Recommended desktop pragmas
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');

      logger.info('database', 'SQLite pragmas configured: WAL mode, foreign_keys ON, synchronous NORMAL');

      // Run health check
      if (!this.isHealthy()) {
        throw new Error('Database quick_check failed upon opening.');
      }

      // Run database migrations
      this.runMigrations();

      logger.info('database', 'Database initialized and ready for operations');
    } catch (error) {
      logger.error('database', 'Failed to initialize SQLite database', error);
      throw error;
    }
  }

  public runMigrations(): void {
    if (!this.db || !this.dbFilePath || !this.backupDir) {
      throw new Error('Database must be opened before running migrations');
    }
    migrationRunner.runMigrations(this.db, this.dbFilePath, this.backupDir);
  }

  public getConnection(): Database.Database {
    if (!this.db) {
      throw new Error('Database is not initialized. Call initialize() first.');
    }
    return this.db;
  }

  public isHealthy(): boolean {
    if (!this.db) return false;
    try {
      const result = this.db.pragma('quick_check') as { quick_check: string }[];
      const status = result.length > 0 ? result[0].quick_check : 'unknown';
      return status.toLowerCase() === 'ok';
    } catch (err) {
      logger.error('database', 'Health check failed', err);
      return false;
    }
  }

  public close(): void {
    if (this.db) {
      try {
        logger.info('database', 'Closing SQLite connection and checkpointing WAL');
        try {
          this.db.pragma('wal_checkpoint(TRUNCATE)');
        } catch (cpErr) {
          logger.warn('database', 'WAL checkpoint error during close', cpErr);
        }
        this.db.close();
        this.db = null;
        logger.info('database', 'SQLite connection closed successfully');
      } catch (err) {
        logger.error('database', 'Error closing SQLite connection', err);
      }
    }
  }
}

export const databaseService = new SQLiteDatabaseService();
