import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { projectFilesystemService } from '../src/main/services/project-filesystem/projectFilesystem.service';
import type { Project } from '../src/shared/types/project.types';

describe('ProjectFilesystemService (Physical Storage & Integrity)', () => {
  let tempBaseDir: string;
  let projectDir: string;

  const mockProject: Project = {
    id: 'proj-fs-123',
    name: 'Dự án Âm thanh Tiếng Việt',
    description: 'Kiểm tra lưu trữ thư mục và font tiếng Việt',
    status: 'draft',
    originalText: 'Thành phố Hồ Chí Minh là trung tâm kinh tế, văn hóa lớn nhất Việt Nam. Tiếng Việt có 6 thanh điệu: ngang, huyền, sắc, hỏi, ngã, nặng.',
    processedText: '',
    providerId: null,
    voiceId: null,
    settings: {
      version: 1,
      text: { normalizationEnabled: true },
      voice: { speed: 1.0, pitch: 0, volume: 100 }
    },
    projectPath: '',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    deletedAt: null
  };

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-fs-test-'));
    projectDir = path.join(tempBaseDir, 'projects', mockProject.id);
    mockProject.projectPath = projectDir;
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should create the standard project directory hierarchy with 5 subdirectories', () => {
    projectFilesystemService.createProjectStructure(projectDir, mockProject);

    expect(fs.existsSync(projectDir)).toBe(true);

    const requiredSubdirs = ['segments', 'audio', 'subtitles', 'exports', 'temp'];
    for (const subdir of requiredSubdirs) {
      const fullSubpath = path.join(projectDir, subdir);
      expect(fs.existsSync(fullSubpath)).toBe(true);
      expect(fs.statSync(fullSubpath).isDirectory()).toBe(true);
    }
  });

  it('should write project.json and script-original.txt with atomic safety and preserve Vietnamese Unicode', () => {
    projectFilesystemService.createProjectStructure(projectDir, mockProject);

    const projectJsonFile = path.join(projectDir, 'project.json');
    const scriptOriginalFile = path.join(projectDir, 'script-original.txt');

    expect(fs.existsSync(projectJsonFile)).toBe(true);
    expect(fs.existsSync(scriptOriginalFile)).toBe(true);

    // Read back script-original.txt and verify exact Unicode content
    const scriptContent = fs.readFileSync(scriptOriginalFile, 'utf8');
    expect(scriptContent).toBe(mockProject.originalText);
    expect(scriptContent).toContain('Thành phố Hồ Chí Minh');
    expect(scriptContent).toContain('6 thanh điệu: ngang, huyền, sắc, hỏi, ngã, nặng');

    // Read back project.json and verify metadata
    const jsonContent = JSON.parse(fs.readFileSync(projectJsonFile, 'utf8'));
    expect(jsonContent.id).toBe(mockProject.id);
    expect(jsonContent.name).toBe('Dự án Âm thanh Tiếng Việt');
  });

  it('should self-heal missing project.json and script-original.txt from project model', () => {
    projectFilesystemService.createProjectStructure(projectDir, mockProject);

    const projectJsonFile = path.join(projectDir, 'project.json');
    const scriptOriginalFile = path.join(projectDir, 'script-original.txt');

    // Manually delete the files
    fs.unlinkSync(projectJsonFile);
    fs.unlinkSync(scriptOriginalFile);
    expect(fs.existsSync(projectJsonFile)).toBe(false);
    expect(fs.existsSync(scriptOriginalFile)).toBe(false);

    // Run self-healing
    projectFilesystemService.selfHealProjectFiles(projectDir, mockProject);

    // Files must be recreated
    expect(fs.existsSync(projectJsonFile)).toBe(true);
    expect(fs.existsSync(scriptOriginalFile)).toBe(true);
    expect(fs.readFileSync(scriptOriginalFile, 'utf8')).toBe(mockProject.originalText);
  });
});
