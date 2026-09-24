import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { pronunciationDictionaryService } from '../src/main/services/dictionary/pronunciationDictionary.service';

describe('PronunciationDictionaryService', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-dict-svc-test-'));
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

  it('should create a rule and increment dictionary revision', async () => {
    const revBefore = pronunciationDictionaryService.getRevision();

    const rule = await pronunciationDictionaryService.createRule({
      term: 'TS24',
      spokenText: 'ti ét hai bốn',
      category: 'Brands',
      providerScope: 'ALL'
    });

    expect(rule.id).toBeDefined();
    expect(rule.term).toBe('TS24');
    expect(rule.spokenText).toBe('ti ét hai bốn');

    const revAfter = pronunciationDictionaryService.getRevision();
    expect(revAfter).toBe(revBefore + 1);
  });

  it('should reject creating duplicate rules with DICTIONARY_RULE_ALREADY_EXISTS', async () => {
    await pronunciationDictionaryService.createRule({
      term: 'BHXH',
      spokenText: 'bảo hiểm xã hội',
      providerScope: 'ALL'
    });

    expect(() =>
      pronunciationDictionaryService.createRule({
        term: 'bhxh', // same term case-insensitively
        spokenText: 'bảo hiểm xã hội mới',
        providerScope: 'ALL'
      })
    ).toThrow('DICTIONARY_RULE_ALREADY_EXISTS');
  });

  it('should update rule and increment revision', async () => {
    const created = await pronunciationDictionaryService.createRule({
      term: 'BHYT',
      spokenText: 'bảo hiểm y tế'
    });
    const rev1 = pronunciationDictionaryService.getRevision();

    const updated = await pronunciationDictionaryService.updateRule(created.id, {
      spokenText: 'bảo hiểm y tế quốc gia'
    });

    expect(updated.spokenText).toBe('bảo hiểm y tế quốc gia');
    const rev2 = pronunciationDictionaryService.getRevision();
    expect(rev2).toBe(rev1 + 1);
  });

  it('should test a rule against sample text accurately', async () => {
    const testResult = await pronunciationDictionaryService.testRule({
      rule: {
        term: 'VTV',
        spokenText: 'đài truyền hình việt nam',
        wholeWord: true,
        caseSensitive: false,
        providerScope: 'ALL'
      },
      sampleText: 'Chương trình phát sóng trên VTV tối nay.'
    });

    expect(testResult.matched).toBe(true);
    expect(testResult.processed).toBe('Chương trình phát sóng trên đài truyền hình việt nam tối nay.');
  });
});
