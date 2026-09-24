import fs from 'fs';
import path from 'path';
import { logger } from '../services/logger/logger';

export class BackupService {
  private static readonly MAX_BACKUPS = 10;

  /**
   * Creates a timestamped backup of the SQLite database file.
   */
  public createBackup(dbFilePath: string, backupDir: string): string | null {
    try {
      if (!fs.existsSync(dbFilePath)) {
        return null;
      }

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '-')
        .split('.')[0]; // YYYYMMDD-HHmmss

      const backupFileName = `local-tts-studio-${timestamp}.db`;
      const targetPath = path.join(backupDir, backupFileName);

      fs.copyFileSync(dbFilePath, targetPath);
      logger.info('backup', `Database backup created successfully: ${backupFileName}`);

      this.rotateBackups(backupDir);
      return targetPath;
    } catch (error) {
      logger.error('backup', 'Failed to create database backup', error);
      return null;
    }
  }

  /**
   * Rotates backups to keep only the newest N copies.
   */
  public rotateBackups(backupDir: string, maxCount: number = BackupService.MAX_BACKUPS): void {
    try {
      if (!fs.existsSync(backupDir)) return;

      const files = fs
        .readdirSync(backupDir)
        .filter((file) => file.startsWith('local-tts-studio-') && file.endsWith('.db'))
        .map((file) => {
          const fullPath = path.join(backupDir, file);
          return {
            name: file,
            path: fullPath,
            mtime: fs.statSync(fullPath).mtimeMs
          };
        })
        .sort((a, b) => b.mtime - a.mtime); // Newest first

      if (files.length > maxCount) {
        const toDelete = files.slice(maxCount);
        for (const item of toDelete) {
          fs.unlinkSync(item.path);
          logger.info('backup', `Rotated old database backup: ${item.name}`);
        }
      }
    } catch (error) {
      logger.error('backup', 'Error rotating database backups', error);
    }
  }
}

export const backupService = new BackupService();
