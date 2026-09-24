import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { textProcessingService } from '../src/main/services/text-processing/textProcessing.service';
import { pronunciationDictionaryService } from '../src/main/services/dictionary/pronunciationDictionary.service';

describe('TextProcessingService (Full Pipeline Coordinator)', () => {
  let tempBaseDir: string;
  let dbFilePath: string;
  let backupDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-proc-test-'));
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

  it('should execute full pipeline and respect Dictionary authority over normalizers', async () => {
    // Add dictionary rule: TS24 -> ti ét hai bốn
    await pronunciationDictionaryService.createRule({
      term: 'TS24',
      spokenText: 'ti ét hai bốn',
      providerScope: 'ALL'
    });

    const originalText = 'Công ty TS24 phát hành phiên bản ngày 15/08/2026 với giá 500.000 VNĐ.';

    const result = await textProcessingService.processText({
      text: originalText,
      settings: {
        dictionaryEnabled: true,
        whitespaceNormalization: true,
        dateNormalization: true,
        numberNormalization: true,
        currencyNormalization: true,
        abbreviationNormalization: true,
        providerContext: 'ALL'
      }
    });

    expect(result.originalText).toBe(originalText);
    expect(result.processedText).toContain('ti ét hai bốn');
    expect(result.processedText).toContain('ngày mười lăm tháng tám năm hai nghìn không trăm hai mươi sáu');
    expect(result.processedText).toContain('năm trăm nghìn đồng');

    // Verify stats
    expect(result.stats.dictionaryMatches).toBe(1);
    expect(result.stats.datesNormalized).toBe(1);
    expect(result.stats.currenciesNormalized).toBe(1);
    expect(result.stats.totalTransformations).toBeGreaterThanOrEqual(3);

    // Verify deterministic SHA-256 fingerprint
    expect(result.fingerprint).toBeDefined();
    expect(result.fingerprint.length).toBe(64); // sha256 hex length
  });

  it('should normalize whitespace while preserving paragraph breaks', async () => {
    const rawText = 'Đoạn một có   nhiều    khoảng trắng thừa.\r\n\r\nĐoạn hai cũng   vậy.';

    const result = await textProcessingService.processText({
      text: rawText,
      settings: {
        dictionaryEnabled: false,
        whitespaceNormalization: true,
        dateNormalization: false,
        numberNormalization: false,
        currencyNormalization: false,
        abbreviationNormalization: false,
        providerContext: 'ALL'
      }
    });

    expect(result.processedText).toBe('Đoạn một có nhiều khoảng trắng thừa.\n\nĐoạn hai cũng vậy.');
  });

  it('should generate same fingerprint for identical content and settings', async () => {
    const text = 'Nội dung thử nghiệm kiểm tra tính toán fingerprint.';
    const settings = {
      dictionaryEnabled: true,
      whitespaceNormalization: true,
      dateNormalization: false,
      numberNormalization: false,
      currencyNormalization: false,
      abbreviationNormalization: false,
      providerContext: 'ALL' as const
    };

    const res1 = await textProcessingService.processText({ text, settings });
    const res2 = await textProcessingService.processText({ text, settings });

    expect(res1.fingerprint).toBe(res2.fingerprint);
  });
});
