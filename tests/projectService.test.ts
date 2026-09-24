import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { projectService } from '../src/main/services/project/project.service';

describe('ProjectService (Business Logic)', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-service-test-'));
    appPathsService.initialize(tempBaseDir);
    dbFilePath = path.join(tempBaseDir, 'database', 'test-studio.db');
    backupDir = path.join(tempBaseDir, 'backups');
    databaseService.initialize(dbFilePath, backupDir);
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should auto-name projects sequentially as Untitled Project, Untitled Project (2)', () => {
    const p1 = projectService.createProject();
    expect(p1.name).toBe('Untitled Project');
    expect(fs.existsSync(p1.projectPath)).toBe(true);

    const p2 = projectService.createProject();
    expect(p2.name).toBe('Untitled Project (2)');
    expect(fs.existsSync(p2.projectPath)).toBe(true);
  });

  it('should rename a project and update project.json without altering folder path', () => {
    const p = projectService.createProject({ name: 'Old Title' });
    const originalPath = p.projectPath;

    const renamed = projectService.renameProject(p.id, 'New Modern Title');
    expect(renamed.name).toBe('New Modern Title');
    expect(renamed.projectPath).toBe(originalPath);

    const projectJson = JSON.parse(
      fs.readFileSync(path.join(originalPath, 'project.json'), 'utf8')
    );
    expect(projectJson.name).toBe('New Modern Title');
  });

  it('should duplicate a project with unique copy name and new directory', () => {
    const source = projectService.createProject({ name: 'Audio Novel' });
    projectService.saveProjectText({
      projectId: source.id,
      originalText: 'Chapter 1: The Beginning'
    });

    const dup = projectService.duplicateProject(source.id);
    expect(dup.name).toBe('Audio Novel (Copy)');
    expect(dup.id).not.toBe(source.id);
    expect(dup.projectPath).not.toBe(source.projectPath);
    expect(fs.existsSync(dup.projectPath)).toBe(true);

    const scriptFile = path.join(dup.projectPath, 'script-original.txt');
    expect(fs.readFileSync(scriptFile, 'utf8')).toBe('Chapter 1: The Beginning');

    // Duplicate again to test (Copy 2)
    const dup2 = projectService.duplicateProject(source.id);
    expect(dup2.name).toBe('Audio Novel (Copy 2)');
  });

  it('should save project text, increment revision, and prevent conflicting revisions', () => {
    const p = projectService.createProject();
    expect(p.revision).toBe(1);

    const updated = projectService.saveProjectText({
      projectId: p.id,
      originalText: 'New text version 1',
      expectedRevision: 1
    });

    expect(updated.revision).toBe(2);
    expect(updated.originalText).toBe('New text version 1');

    // Attempt saving with stale revision expectation (expected 1, but revision is 2)
    expect(() => {
      projectService.saveProjectText({
        projectId: p.id,
        originalText: 'Conflicting text version',
        expectedRevision: 1
      });
    }).toThrow('PROJECT_REVISION_CONFLICT');
  });

  it('should soft delete project in database while preserving physical folder on disk', () => {
    const p = projectService.createProject({ name: 'Safe Retention' });
    const pPath = p.projectPath;
    expect(fs.existsSync(pPath)).toBe(true);

    projectService.deleteProject(p.id);

    // Database check
    expect(projectService.getProject(p.id)).toBeNull();

    // Filesystem check: physical directory is kept untouched
    expect(fs.existsSync(pPath)).toBe(true);
    expect(fs.existsSync(path.join(pPath, 'project.json'))).toBe(true);
  });
});
