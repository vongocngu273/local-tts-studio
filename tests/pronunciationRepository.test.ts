import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { pronunciationDictionaryRepository } from '../src/main/database/repositories/pronunciationDictionary.repository';
import type { PronunciationRule } from '../src/shared/types/dictionary.types';

describe('PronunciationDictionaryRepository', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  const createMockRule = (id: string, term: string, spokenText: string, overrides: Partial<PronunciationRule> = {}): PronunciationRule => {
    const now = new Date().toISOString();
    return {
      id,
      term,
      spokenText,
      enabled: true,
      caseSensitive: false,
      wholeWord: true,
      providerScope: 'ALL',
      category: 'General',
      priority: 0,
      note: 'Test rule',
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  };

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-dict-repo-test-'));
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

  it('should insert and retrieve a pronunciation rule by ID', () => {
    const rule = createMockRule('r1', 'TS24', 'ti ét hai bốn');
    pronunciationDictionaryRepository.insert(rule);

    const found = pronunciationDictionaryRepository.findById('r1');
    expect(found).not.toBeNull();
    expect(found?.term).toBe('TS24');
    expect(found?.spokenText).toBe('ti ét hai bốn');
    expect(found?.enabled).toBe(true);
  });

  it('should detect duplicate rules with same term and provider scope', () => {
    const rule1 = createMockRule('r1', 'BHXH', 'bảo hiểm xã hội', { providerScope: 'ALL' });
    pronunciationDictionaryRepository.insert(rule1);

    // Exact match duplicate
    const dup = pronunciationDictionaryRepository.findDuplicate('BHXH', false, true, 'ALL');
    expect(dup).not.toBeNull();
    expect(dup?.id).toBe('r1');

    // Case-insensitive match check
    const dupLower = pronunciationDictionaryRepository.findDuplicate('bhxh', false, true, 'ALL');
    expect(dupLower).not.toBeNull();

    // Different provider scope is NOT duplicate
    const diffProvider = pronunciationDictionaryRepository.findDuplicate('BHXH', false, true, 'EDGE');
    expect(diffProvider).toBeNull();
  });

  it('should query applicable rules for matching in correct precedence order', () => {
    const r1 = createMockRule('r1', 'TS', 'ti ét', { providerScope: 'ALL', priority: 0 });
    const r2 = createMockRule('r2', 'TS24', 'ti ét hai bốn', { providerScope: 'ALL', priority: 0 });
    const r3 = createMockRule('r3', 'TS24', 'ti ét hai tư', { providerScope: 'EDGE', priority: 10 });
    const r4Disabled = createMockRule('r4', 'BHXH', 'bảo hiểm xã hội', { enabled: false });

    pronunciationDictionaryRepository.insert(r1);
    pronunciationDictionaryRepository.insert(r2);
    pronunciationDictionaryRepository.insert(r3);
    pronunciationDictionaryRepository.insert(r4Disabled);

    const applicable = pronunciationDictionaryRepository.findApplicableRules('EDGE');
    expect(applicable.length).toBe(3); // r4 is disabled

    // Longest match (TS24: len 4) should come before TS (len 2)
    // Within TS24, provider EDGE with higher priority comes first
    expect(applicable[0].id).toBe('r3');
    expect(applicable[1].id).toBe('r2');
    expect(applicable[2].id).toBe('r1');
  });

  it('should perform bulk insert with skip conflict policy', () => {
    const r1 = createMockRule('r1', 'TS24', 'ti ét hai bốn', { providerScope: 'ALL' });
    pronunciationDictionaryRepository.insert(r1);

    const incoming = [
      createMockRule('r2', 'TS24', 'ti ét hai tư MỚI', { providerScope: 'ALL' }), // conflict
      createMockRule('r3', 'BHYT', 'bảo hiểm y tế', { providerScope: 'ALL' })     // new
    ];

    const result = pronunciationDictionaryRepository.bulkInsert(incoming, 'skip');
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);

    const existingR1 = pronunciationDictionaryRepository.findById('r1');
    expect(existingR1?.spokenText).toBe('ti ét hai bốn'); // not overwritten
  });

  it('should perform bulk insert with replace conflict policy', () => {
    const r1 = createMockRule('r1', 'TS24', 'ti ét hai bốn', { providerScope: 'ALL' });
    pronunciationDictionaryRepository.insert(r1);

    const incoming = [
      createMockRule('r2', 'TS24', 'ti ét hai tư MỚI', { providerScope: 'ALL' }), // conflict
      createMockRule('r3', 'BHYT', 'bảo hiểm y tế', { providerScope: 'ALL' })     // new
    ];

    const result = pronunciationDictionaryRepository.bulkInsert(incoming, 'replace');
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);

    const updatedR1 = pronunciationDictionaryRepository.findById('r1');
    expect(updatedR1?.spokenText).toBe('ti ét hai tư MỚI'); // overwritten
  });

  it('should fetch distinct categories correctly', () => {
    pronunciationDictionaryRepository.insert(createMockRule('r1', 'A', 'a', { category: 'Tech' }));
    pronunciationDictionaryRepository.insert(createMockRule('r2', 'B', 'b', { category: 'Tax' }));
    pronunciationDictionaryRepository.insert(createMockRule('r3', 'C', 'c', { category: 'Tech' }));
    pronunciationDictionaryRepository.insert(createMockRule('r4', 'D', 'd', { category: null }));

    const categories = pronunciationDictionaryRepository.getCategories();
    expect(categories).toEqual(['Tax', 'Tech']);
  });
});
