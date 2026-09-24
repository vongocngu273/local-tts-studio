import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import type { Project } from '../src/shared/types/project.types';

describe('ProjectRepository (SQLite CRUD)', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  const createMockProject = (id: string, name: string, overrides: Partial<Project> = {}): Project => {
    const now = new Date().toISOString();
    return {
      id,
      name,
      description: 'Test project description',
      status: 'draft',
      originalText: 'Hello world sample script',
      processedText: '',
      providerId: null,
      voiceId: null,
      settings: {
        version: 1,
        text: { normalizationEnabled: true },
        voice: { speed: 1.0, pitch: 0, volume: 100 }
      },
      projectPath: path.join(tempBaseDir, 'projects', id),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      deletedAt: null,
      ...overrides
    };
  };

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-repo-test-'));
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

  it('should insert and find a project by ID', () => {
    const project = createMockProject('p1', 'My First Project');
    projectRepository.insert(project);

    const retrieved = projectRepository.findById('p1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('p1');
    expect(retrieved?.name).toBe('My First Project');
    expect(retrieved?.originalText).toBe('Hello world sample script');
    expect(retrieved?.settings.voice?.speed).toBe(1.0);
  });

  it('should update project fields and increment revision', () => {
    const project = createMockProject('p2', 'Updatable Project');
    projectRepository.insert(project);

    projectRepository.update('p2', {
      originalText: 'Updated script content with Vietnamese dấu: Xin chào Việt Nam',
      revision: 2,
      name: 'Renamed Project'
    });

    const updated = projectRepository.findById('p2');
    expect(updated?.name).toBe('Renamed Project');
    expect(updated?.originalText).toContain('Xin chào Việt Nam');
    expect(updated?.revision).toBe(2);
  });

  it('should soft delete and restore projects properly', () => {
    const project = createMockProject('p3', 'To Be Soft Deleted');
    projectRepository.insert(project);

    expect(projectRepository.count(false)).toBe(1);

    // Soft delete
    projectRepository.softDelete('p3');

    // Should not be visible in default query
    expect(projectRepository.findById('p3')).toBeNull();
    expect(projectRepository.findAll().length).toBe(0);
    expect(projectRepository.count(false)).toBe(0);

    // Should be visible when includeDeleted is true
    const deletedProject = projectRepository.findById('p3', true);
    expect(deletedProject).not.toBeNull();
    expect(deletedProject?.deletedAt).toBeDefined();

    // Restore
    projectRepository.restore('p3');
    expect(projectRepository.findById('p3')).not.toBeNull();
    expect(projectRepository.count(false)).toBe(1);
  });

  it('should search projects by name', () => {
    projectRepository.insert(createMockProject('p4', 'Alpha Voice Track'));
    projectRepository.insert(createMockProject('p5', 'Beta Voice Track'));
    projectRepository.insert(createMockProject('p6', 'Gamma Narrative'));

    const results = projectRepository.findAll({ search: 'voice' });
    expect(results.length).toBe(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('Alpha Voice Track');
    expect(names).toContain('Beta Voice Track');
    expect(names).not.toContain('Gamma Narrative');
  });

  it('should sort projects by name asc and name desc', () => {
    projectRepository.insert(createMockProject('p7', 'Zebra Story'));
    projectRepository.insert(createMockProject('p8', 'Apple Story'));
    projectRepository.insert(createMockProject('p9', 'Mango Story'));

    const asc = projectRepository.findAll({ sort: 'name_asc' });
    expect(asc[0].name).toBe('Apple Story');
    expect(asc[1].name).toBe('Mango Story');
    expect(asc[2].name).toBe('Zebra Story');

    const desc = projectRepository.findAll({ sort: 'name_desc' });
    expect(desc[0].name).toBe('Zebra Story');
    expect(desc[1].name).toBe('Mango Story');
    expect(desc[2].name).toBe('Apple Story');
  });
});
