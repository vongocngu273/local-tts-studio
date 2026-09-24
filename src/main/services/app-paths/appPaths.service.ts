import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { AppPaths } from '@shared/schemas/app.schema';
import { LOCAL_WORKSPACE_DIR_NAMES } from '@shared/constants/app.constants';

export class AppPathsService {
  private paths: AppPaths | null = null;

  /**
   * Initializes workspace paths.
   * If customBasePath is not provided, defaults to Electron's app.getPath('userData')
   */
  public initialize(customBasePath?: string): AppPaths {
    const rootPath = customBasePath ?? (app?.getPath ? app.getPath('userData') : '');

    this.paths = {
      root: rootPath,
      database: path.join(rootPath, 'database'),
      projects: path.join(rootPath, 'projects'),
      cache: path.join(rootPath, 'cache'),
      logs: path.join(rootPath, 'logs'),
      backups: path.join(rootPath, 'backups'),
      temp: path.join(rootPath, 'temp')
    };

    this.ensureDirectoriesExist();
    return this.paths;
  }

  public getPaths(): AppPaths {
    if (!this.paths) {
      throw new Error('AppPathsService has not been initialized yet.');
    }
    return this.paths;
  }

  /**
   * Recursively ensures all required workspace folders exist.
   * Non-destructive: will never delete or overwrite existing data.
   */
  public ensureDirectoriesExist(): void {
    if (!this.paths) {
      throw new Error('AppPathsService has not been initialized yet.');
    }

    if (!fs.existsSync(this.paths.root)) {
      fs.mkdirSync(this.paths.root, { recursive: true });
    }

    for (const dirName of LOCAL_WORKSPACE_DIR_NAMES) {
      const dirPath = this.paths[dirName];
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
  }

  /**
   * Verifies that the workspace directory is writable.
   */
  public isWritable(): boolean {
    if (!this.paths) return false;
    try {
      fs.accessSync(this.paths.root, fs.constants.W_OK | fs.constants.R_OK);
      const testFile = path.join(this.paths.temp, `.test-write-${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }
}

export const appPathsService = new AppPathsService();
