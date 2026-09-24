import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { projectService } from '../src/main/services/project/project.service';

describe('Large Text Script Stress Test (100,000 Characters)', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-largetext-test-'));
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

  it('should persist and retrieve a 100,000 character Vietnamese script without truncation or corruption', () => {
    const p = projectService.createProject({ name: 'Epic Novel Voice Track' });

    // Generate 100,000 characters of rich Vietnamese text
    const sampleSentence = 'Hà Nội là thủ đô nghìn năm văn hiến với nền ẩm thực phong phú và con người thân thiện. ';
    const repeatCount = Math.ceil(100000 / sampleSentence.length);
    const largeScript = sampleSentence.repeat(repeatCount).slice(0, 100000);

    expect(largeScript.length).toBe(100000);

    const startTime = Date.now();
    const updated = projectService.saveProjectText({
      projectId: p.id,
      originalText: largeScript
    });
    const duration = Date.now() - startTime;

    // Fast persistence
    expect(duration).toBeLessThan(1000);
    expect(updated.originalText.length).toBe(100000);

    // Verify database record
    const retrieved = projectService.getProject(p.id);
    expect(retrieved?.originalText.length).toBe(100000);
    expect(retrieved?.originalText).toBe(largeScript);

    // Verify filesystem file
    const scriptFile = path.join(p.projectPath, 'script-original.txt');
    expect(fs.existsSync(scriptFile)).toBe(true);
    const fileContent = fs.readFileSync(scriptFile, 'utf8');
    expect(fileContent.length).toBe(100000);
    expect(fileContent).toBe(largeScript);
  });
});
