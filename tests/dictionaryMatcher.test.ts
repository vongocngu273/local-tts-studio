import { describe, it, expect } from 'vitest';
import { dictionaryMatcher } from '../src/main/services/text-processing/matcher/dictionaryMatcher';
import type { PronunciationRule } from '../src/shared/types/dictionary.types';

describe('DictionaryMatcher (Deterministic Matching & Precedence)', () => {
  const createRule = (term: string, spokenText: string, options: Partial<PronunciationRule> = {}): PronunciationRule => ({
    id: `rule-${term}`,
    term,
    spokenText,
    enabled: true,
    caseSensitive: false,
    wholeWord: true,
    providerScope: 'ALL',
    category: null,
    priority: 0,
    note: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...options
  });

  it('should replace whole-word terms accurately', () => {
    const rules = [createRule('TS24', 'ti ét hai bốn')];
    const text = 'Sản phẩm của TS24 rất tốt. Không phải TS24PRO hay MYTS24.';

    const result = dictionaryMatcher.matchAndReplace(text, rules, 'ALL');
    expect(result.text).toBe('Sản phẩm của ti ét hai bốn rất tốt. Không phải TS24PRO hay MYTS24.');
    expect(result.transformations.length).toBe(1);
    expect(result.transformations[0].sourceText).toBe('TS24');
    expect(result.transformations[0].resultText).toBe('ti ét hai bốn');
  });

  it('should support Unicode-aware boundaries for Vietnamese diacritics', () => {
    const rules = [createRule('bảo hiểm', 'bảo hiểm toàn diện')];
    // "bảo hiểm" is followed by comma, space, or period, not attached to another word character
    const text = 'Tham gia bảo hiểm, nhận quyền lợi bảo hiểm.';

    const result = dictionaryMatcher.matchAndReplace(text, rules, 'ALL');
    expect(result.text).toBe('Tham gia bảo hiểm toàn diện, nhận quyền lợi bảo hiểm toàn diện.');
    expect(result.transformations.length).toBe(2);
  });

  it('should respect case sensitivity flag', () => {
    const caseSensitiveRule = createRule('AI', 'trí tuệ nhân tạo', { caseSensitive: true });
    const rules = [caseSensitiveRule];

    const text = 'Công nghệ AI hiện đại, ai cũng có thể sử dụng.';
    const result = dictionaryMatcher.matchAndReplace(text, rules, 'ALL');

    expect(result.text).toBe('Công nghệ trí tuệ nhân tạo hiện đại, ai cũng có thể sử dụng.');
    expect(result.transformations.length).toBe(1);
  });

  it('should prioritize longest-match precedence', () => {
    // Both 'TS' and 'TS24' are present
    const rules = [
      createRule('TS', 'ti ét'),
      createRule('TS24', 'ti ét hai bốn')
    ];

    const text = 'Công ty TS24 và dịch vụ TS cơ bản.';
    const result = dictionaryMatcher.matchAndReplace(text, rules, 'ALL');

    expect(result.text).toBe('Công ty ti ét hai bốn và dịch vụ ti ét cơ bản.');
  });

  it('should prioritize provider-specific rules over ALL scope', () => {
    const rules = [
      createRule('TS24', 'ti ét hai bốn', { providerScope: 'ALL' }),
      createRule('TS24', 'ti ét hai tư EDGE', { providerScope: 'EDGE' })
    ];

    const text = 'Khai báo với TS24 ngay.';

    // When running under EDGE provider context
    const resultEdge = dictionaryMatcher.matchAndReplace(text, rules, 'EDGE');
    expect(resultEdge.text).toBe('Khai báo với ti ét hai tư EDGE ngay.');

    // When running under ELEVENLABS provider context
    const resultEleven = dictionaryMatcher.matchAndReplace(text, rules, 'ELEVENLABS');
    expect(resultEleven.text).toBe('Khai báo với ti ét hai bốn ngay.');
  });

  it('should guarantee NON-CASCADING replacement (single pass, no recursive loops)', () => {
    // If Rule 1 converts A -> B, and Rule 2 converts B -> C:
    // Text "A" MUST turn into "B", NOT cascade into "C"
    const rules = [
      createRule('A', 'B'),
      createRule('B', 'C')
    ];

    const text = 'Chữ A trong bảng chữ cái và chữ B đứng sau.';
    const result = dictionaryMatcher.matchAndReplace(text, rules, 'ALL');

    // "A" -> "B", and the original "B" -> "C"
    expect(result.text).toBe('Chữ B trong bảng chữ cái và chữ C đứng sau.');
    // The transformed "B" from "A" was NOT re-transformed into "C"
  });

  it('should return protected spans covering all replaced positions', () => {
    const rules = [createRule('BHXH', 'bảo hiểm xã hội')];
    const text = 'Sổ BHXH đã cấp.';

    const result = dictionaryMatcher.matchAndReplace(text, rules, 'ALL');
    expect(result.text).toBe('Sổ bảo hiểm xã hội đã cấp.');
    expect(result.protectedSpans.length).toBe(1);

    const span = result.protectedSpans[0];
    expect(result.text.substring(span.start, span.end)).toBe('bảo hiểm xã hội');
  });
});
