import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { projectService } from '../src/main/services/project/project.service';

describe('Project Recovery & Draft Subsystem', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-recovery-test-'));
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

  it('should detect a recovery draft only when draft timestamp is newer than project', async () => {
    const p = projectService.createProject();

    // No draft exists yet
    expect(projectService.checkRecovery(p.id)).toBeNull();

    // Small delay to ensure timestamp is newer
    await new Promise((r) => setTimeout(r, 10));

    // User types new text and background draft saves it
    projectService.saveDraft({
      projectId: p.id,
      originalText: 'Draft uncommitted text during unexpected power off',
      revision: 1
    });

    // Check should now detect the draft
    const recovery = projectService.checkRecovery(p.id);
    expect(recovery).not.toBeNull();
    expect(recovery?.originalText).toBe('Draft uncommitted text during unexpected power off');
  });

  it('should recover draft by updating project text, incrementing revision, and removing draft', async () => {
    const p = projectService.createProject();
    const initialRev = p.revision;

    await new Promise((r) => setTimeout(r, 10));

    projectService.saveDraft({
      projectId: p.id,
      originalText: 'Text recovered after crash',
      revision: 1
    });

    // Recover
    const recovered = projectService.recoverDraft(p.id);
    expect(recovered.originalText).toBe('Text recovered after crash');
    expect(recovered.revision).toBe(initialRev + 1);

    // After recovery, draft should be gone
    expect(projectService.checkRecovery(p.id)).toBeNull();
  });

  it('should discard recovery draft and retain saved project text intact', async () => {
    const p = projectService.createProject();
    projectService.saveProjectText({
      projectId: p.id,
      originalText: 'Confirmed permanent text'
    });

    await new Promise((r) => setTimeout(r, 10));

    // An uncommitted draft was recorded
    projectService.saveDraft({
      projectId: p.id,
      originalText: 'Discardable draft edits',
      revision: 2
    });

    expect(projectService.checkRecovery(p.id)).not.toBeNull();

    // Discard
    const discarded = projectService.discardDraft(p.id);
    expect(discarded).toBe(true);

    // Draft is gone
    expect(projectService.checkRecovery(p.id)).toBeNull();

    // Original project text is preserved unchanged
    const current = projectService.getProject(p.id);
    expect(current?.originalText).toBe('Confirmed permanent text');
  });
});
