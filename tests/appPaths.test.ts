import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AppPathsService } from '../src/main/services/app-paths/appPaths.service';
import { LOCAL_WORKSPACE_DIR_NAMES } from '../src/shared/constants/app.constants';
import { AppPathsSchema } from '../src/shared/schemas/app.schema';

describe('AppPathsService', () => {
  let tempBaseDir: string;
  let service: AppPathsService;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-test-'));
    service = new AppPathsService();
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should initialize and return valid workspace paths satisfying AppPathsSchema', () => {
    const paths = service.initialize(tempBaseDir);
    const parsed = AppPathsSchema.safeParse(paths);

    expect(parsed.success).toBe(true);
    expect(paths.root).toBe(tempBaseDir);
    expect(paths.database).toBe(path.join(tempBaseDir, 'database'));
    expect(paths.projects).toBe(path.join(tempBaseDir, 'projects'));
    expect(paths.cache).toBe(path.join(tempBaseDir, 'cache'));
    expect(paths.logs).toBe(path.join(tempBaseDir, 'logs'));
    expect(paths.backups).toBe(path.join(tempBaseDir, 'backups'));
    expect(paths.temp).toBe(path.join(tempBaseDir, 'temp'));
  });

  it('should recursively create all required subdirectories', () => {
    service.initialize(tempBaseDir);

    for (const dirName of LOCAL_WORKSPACE_DIR_NAMES) {
      const targetDir = path.join(tempBaseDir, dirName);
      expect(fs.existsSync(targetDir)).toBe(true);
      expect(fs.statSync(targetDir).isDirectory()).toBe(true);
    }
  });

  it('should not overwrite or delete existing user files when re-initializing', () => {
    const paths = service.initialize(tempBaseDir);

    // Place an existing file into projects and database directory
    const testProjectFile = path.join(paths.projects, 'my-project.json');
    const testDbFile = path.join(paths.database, 'studio.db');
    fs.writeFileSync(testProjectFile, JSON.stringify({ name: 'Demo Project' }));
    fs.writeFileSync(testDbFile, 'SQLite format 3 header dummy');

    // Re-initialize service on the same directory
    const newService = new AppPathsService();
    newService.initialize(tempBaseDir);

    // Assert files still exist intact
    expect(fs.existsSync(testProjectFile)).toBe(true);
    expect(fs.readFileSync(testProjectFile, 'utf8')).toContain('Demo Project');
    expect(fs.existsSync(testDbFile)).toBe(true);
  });

  it('should confirm workspace is writable', () => {
    service.initialize(tempBaseDir);
    expect(service.isWritable()).toBe(true);
  });
});
