import { describe, it, expect } from 'vitest';
import { dictionaryMatcher } from '../src/main/services/text-processing/matcher/dictionaryMatcher';
import type { PronunciationRule } from '../src/shared/types/dictionary.types';

describe('Text Processing Engine Stress Test (100k characters + 1,000 rules)', () => {
  it('should process 100,000 characters with 1,000 rules efficiently and deterministically', () => {
    // 1. Generate 1,000 pronunciation rules
    const rules: PronunciationRule[] = [];
    for (let i = 1; i <= 1000; i++) {
      rules.push({
        id: `rule-${i}`,
        term: `ACRONYM_${i}`,
        spokenText: `mô tả từ viết tắt số ${i}`,
        enabled: true,
        caseSensitive: false,
        wholeWord: true,
        providerScope: 'ALL',
        category: 'StressTest',
        priority: 0,
        note: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 2. Generate a 100,000 character corpus text containing interspersed acronyms
    const paragraphTemplate =
      'Hôm nay chúng ta tiến hành khảo sát và đánh giá năng lực của ACRONYM_1 và ACRONYM_500. ' +
      'Đồng thời kiểm tra tương thích với hệ thống ACRONYM_999 trong môi trường thực nghiệm. ' +
      'Văn bản gồm nhiều câu hoàn chỉnh bằng tiếng Việt để thử nghiệm hiệu năng của bộ máy xử lý. ';

    let largeScript = '';
    while (largeScript.length < 100000) {
      largeScript += paragraphTemplate;
    }

    expect(largeScript.length).toBeGreaterThanOrEqual(100000);

    // 3. Execute matching and measure execution time
    const startTime = performance.now();
    const result = dictionaryMatcher.matchAndReplace(largeScript, rules, 'ALL');
    const duration = performance.now() - startTime;

    // 4. Assertions
    expect(result.text).not.toContain('ACRONYM_1');
    expect(result.text).not.toContain('ACRONYM_500');
    expect(result.text).not.toContain('ACRONYM_999');
    expect(result.text).toContain('mô tả từ viết tắt số 1');
    expect(result.text).toContain('mô tả từ viết tắt số 500');
    expect(result.text).toContain('mô tả từ viết tắt số 999');

    expect(result.transformations.length).toBeGreaterThan(0);
    expect(result.protectedSpans.length).toBe(result.transformations.length);

    // Execution time should be well under 5 seconds (typically < 500ms in modern V8)
    expect(duration).toBeLessThan(5000);
  });
});
