import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { pronunciationDictionaryService } from '../src/main/services/dictionary/pronunciationDictionary.service';

describe('Dictionary Import/Export Service', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-import-test-'));
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

  it('should export and import rules in JSON format with data fidelity', async () => {
    await pronunciationDictionaryService.createRule({
      term: 'TS24',
      spokenText: 'ti ét hai bốn',
      category: 'Software',
      providerScope: 'EDGE',
      wholeWord: true,
      caseSensitive: true,
      priority: 5,
      note: 'Tax software'
    });

    const exportData = await pronunciationDictionaryService.exportToString({ format: 'json' });
    expect(exportData).toContain('"term": "TS24"');
    expect(exportData).toContain('"spokenText": "ti ét hai bốn"');

    // Parse and verify schema
    const parsed = JSON.parse(exportData);
    expect(parsed.rules.length).toBe(1);

    // Preview import on empty db
    databaseService.close();
    fs.rmSync(dbFilePath);
    databaseService.initialize(dbFilePath, backupDir);

    const preview = await pronunciationDictionaryService.previewImport({
      format: 'json',
      content: exportData,
      conflictPolicy: 'skip'
    });

    expect(preview.newCount).toBe(1);
    expect(preview.conflictCount).toBe(0);

    const importResult = await pronunciationDictionaryService.executeImport({
      format: 'json',
      content: exportData,
      conflictPolicy: 'skip'
    });

    expect(importResult.inserted).toBe(1);
    const list = await pronunciationDictionaryService.listRules({});
    expect(list.length).toBe(1);
    expect(list[0].term).toBe('TS24');
    expect(list[0].providerScope).toBe('EDGE');
    expect(list[0].priority).toBe(5);
  });

  it('should export and import rules in CSV format with UTF-8 BOM and escaped commas', async () => {
    await pronunciationDictionaryService.createRule({
      term: 'BHXH',
      spokenText: 'bảo hiểm, xã hội', // contains comma
      category: 'Bảo hiểm'
    });

    const csvData = await pronunciationDictionaryService.exportToString({ format: 'csv' });
    // Checks UTF-8 BOM
    expect(csvData.startsWith('\uFEFF')).toBe(true);
    // Quoted text check
    expect(csvData).toContain('"bảo hiểm, xã hội"');

    // Preview import on fresh db
    databaseService.close();
    fs.rmSync(dbFilePath);
    databaseService.initialize(dbFilePath, backupDir);

    const preview = await pronunciationDictionaryService.previewImport({
      format: 'csv',
      content: csvData,
      conflictPolicy: 'skip'
    });

    expect(preview.newCount).toBe(1);
    expect(preview.conflictCount).toBe(0);

    const importResult = await pronunciationDictionaryService.executeImport({
      format: 'csv',
      content: csvData,
      conflictPolicy: 'skip'
    });

    expect(importResult.inserted).toBe(1);
    const list = await pronunciationDictionaryService.listRules({});
    expect(list[0].spokenText).toBe('bảo hiểm, xã hội');
  });

  it('should accurately handle conflicts in CSV import according to policy', async () => {
    await pronunciationDictionaryService.createRule({
      term: 'TS24',
      spokenText: 'ti ét hai bốn cũ',
      providerScope: 'ALL'
    });

    const incomingCsv = `\uFEFFterm,spokenText,providerScope,category,caseSensitive,wholeWord,priority,note
TS24,"ti ét hai bốn MỚI",ALL,Tax,false,true,10,"updated note"
BHYT,"bảo hiểm y tế",ALL,Tax,false,true,0,"new rule"`;

    // Preview
    const preview = await pronunciationDictionaryService.previewImport({
      format: 'csv',
      content: incomingCsv,
      conflictPolicy: 'skip'
    });

    expect(preview.total).toBe(2);
    expect(preview.newCount).toBe(1);
    expect(preview.conflictCount).toBe(1);

    // Test SKIP policy
    const skipRes = await pronunciationDictionaryService.executeImport({
      format: 'csv',
      content: incomingCsv,
      conflictPolicy: 'skip'
    });
    expect(skipRes.inserted).toBe(1);
    expect(skipRes.skipped).toBe(1);
    expect(skipRes.updated).toBe(0);

    // Check that original was kept
    const rulesAfterSkip = await pronunciationDictionaryService.listRules({});
    const ts24Skip = rulesAfterSkip.find((r) => r.term === 'TS24');
    expect(ts24Skip?.spokenText).toBe('ti ét hai bốn cũ');

    // Test REPLACE policy
    const replaceRes = await pronunciationDictionaryService.executeImport({
      format: 'csv',
      content: incomingCsv,
      conflictPolicy: 'replace'
    });
    expect(replaceRes.updated).toBe(2);

    const rulesAfterReplace = await pronunciationDictionaryService.listRules({});
    const ts24Replace = rulesAfterReplace.find((r) => r.term === 'TS24');
    expect(ts24Replace?.spokenText).toBe('ti ét hai bốn MỚI');
  });
});
