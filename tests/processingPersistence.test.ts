import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { projectService } from '../src/main/services/project/project.service';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { textProcessingService } from '../src/main/services/text-processing/textProcessing.service';
import { pronunciationDictionaryService } from '../src/main/services/dictionary/pronunciationDictionary.service';

describe('Processing Persistence & Immutability', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-persist-test-'));
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

  it('should persist processed_text in SQLite and atomic script-processed.txt without mutating original_text or bumping original revision', async () => {
    // 1. Create project with original text
    const project = await projectService.createProject();
    const originalContent = 'Kịch bản gốc ngày 20/11/2026 với giá 200.000 VNĐ.';
    await projectService.saveProjectText({
      projectId: project.id,
      originalText: originalContent,
      expectedRevision: 1
    });

    const projectAfterSave = projectRepository.findById(project.id);
    expect(projectAfterSave?.originalText).toBe(originalContent);
    expect(projectAfterSave?.revision).toBe(2);
    expect(projectAfterSave?.processedText).toBe('');

    // 2. Process project text
    const processResult = await textProcessingService.processProject(project.id, {
      dictionaryEnabled: true,
      whitespaceNormalization: true,
      dateNormalization: true,
      numberNormalization: true,
      currencyNormalization: true,
      abbreviationNormalization: true,
      providerContext: 'ALL'
    });

    expect(processResult).not.toBeNull();
    expect(processResult?.processedText).toContain('hai trăm nghìn đồng');

    // 3. Verify SQLite DB state: original_text is UNCHANGED, revision of original text is STILL 2
    const projectAfterProcess = projectRepository.findById(project.id);
    expect(projectAfterProcess?.originalText).toBe(originalContent); // 100% IMMUTABLE
    expect(projectAfterProcess?.revision).toBe(2); // Optimistic revision preserved for script edits
    expect(projectAfterProcess?.processedText).toBe(processResult?.processedText);

    // Verify metadata stored in settings_json
    expect(projectAfterProcess?.settings.textProcessing?.processedFromRevision).toBe(2);
    expect(projectAfterProcess?.settings.textProcessing?.processedWithDictionaryRevision).toBe(0);

    // 4. Verify disk persistence: script-processed.txt exists and matches processedText
    const processedFilePath = path.join(project.projectPath, 'script-processed.txt');
    expect(fs.existsSync(processedFilePath)).toBe(true);
    const diskContent = fs.readFileSync(processedFilePath, 'utf-8');
    expect(diskContent).toBe(processResult?.processedText);

    // Verify project.json snapshot updated on disk
    const projectJsonPath = path.join(project.projectPath, 'project.json');
    const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
    expect(projectJson.id).toBe(project.id);
    expect(projectJson.settings.textProcessing?.processedFromRevision).toBe(2);
  });

  it('should detect stale processing when original_text is updated', async () => {
    const project = await projectService.createProject();
    await projectService.saveProjectText({
      projectId: project.id,
      originalText: 'Nội dung ban đầu',
      expectedRevision: 1
    });

    await textProcessingService.processProject(project.id, {
      dictionaryEnabled: true,
      whitespaceNormalization: true,
      dateNormalization: false,
      numberNormalization: false,
      currencyNormalization: false,
      abbreviationNormalization: false,
      providerContext: 'ALL'
    });

    const projectProcessed = projectRepository.findById(project.id)!;
    const procMeta = projectProcessed.settings.textProcessing!;
    expect(procMeta.processedFromRevision).toBe(projectProcessed.revision);

    // User edits original text -> revision increments
    await projectService.saveProjectText({
      projectId: project.id,
      originalText: 'Nội dung đã được chỉnh sửa mới',
      expectedRevision: projectProcessed.revision
    });
    const updatedProject = projectRepository.findById(project.id)!;

    // Is stale: updatedProject.revision > procMeta.processedFromRevision
    expect(updatedProject.revision).toBeGreaterThan(procMeta.processedFromRevision!);
  });

  it('should detect stale processing when dictionary revision is incremented', async () => {
    const project = await projectService.createProject();
    await projectService.saveProjectText({
      projectId: project.id,
      originalText: 'Dùng TS24 để kê khai',
      expectedRevision: 1
    });

    await textProcessingService.processProject(project.id, {
      dictionaryEnabled: true,
      whitespaceNormalization: true,
      dateNormalization: false,
      numberNormalization: false,
      currencyNormalization: false,
      abbreviationNormalization: false,
      providerContext: 'ALL'
    });

    const projectProcessed = projectRepository.findById(project.id)!;
    const initialDictRev = projectProcessed.settings.textProcessing!.processedWithDictionaryRevision!;

    // Add a rule to dictionary -> dictionary revision increments
    await pronunciationDictionaryService.createRule({
      term: 'TS24',
      spokenText: 'ti ét hai bốn'
    });

    const currentDictRev = pronunciationDictionaryService.getRevision();
    expect(currentDictRev).toBeGreaterThan(initialDictRev);
  });
});
