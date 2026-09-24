import { describe, it, expect } from 'vitest';
import { vietnameseNumberNormalizer } from '../src/main/services/text-processing/normalizers/vietnameseNumberNormalizer';

describe('VietnameseNumberNormalizer', () => {
  it('should accurately convert numbers into Vietnamese words', () => {
    const testCases: [string, string][] = [
      ['0', 'không'],
      ['5', 'năm'],
      ['10', 'mười'],
      ['15', 'mười lăm'],
      ['21', 'hai mươi mốt'],
      ['25', 'hai mươi lăm'],
      ['55', 'năm mươi lăm'],
      ['105', 'một trăm lẻ năm'],
      ['115', 'một trăm mười lăm'],
      ['1.500', 'một nghìn năm trăm'],
      ['2026', 'hai nghìn không trăm hai mươi sáu'],
      ['1.000.000', 'một triệu']
    ];

    for (const [input, expectedWords] of testCases) {
      const sentence = `Có ${input} người tham dự.`;
      const result = vietnameseNumberNormalizer.normalize(sentence);
      expect(result.text).toBe(`Có ${expectedWords} người tham dự.`);
      expect(result.transformations.length).toBe(1);
    }
  });

  it('should NOT alter codes, IDs, or slashed numbers', () => {
    // Slashed codes or IDs should not be corrupted by number normalizer
    const input = 'Mã số TS24 và chuẩn ISO-9001 cùng văn bản 12/2026/TT-BTC.';
    const result = vietnameseNumberNormalizer.normalize(input);

    // TS24, ISO-9001, 12/2026/TT-BTC remain intact
    expect(result.text).toBe('Mã số TS24 và chuẩn ISO-9001 cùng văn bản 12/2026/TT-BTC.');
    expect(result.transformations.length).toBe(0);
  });

  it('should respect protected spans from upstream dictionary replacements', () => {
    // Suppose "15" was inside a protected span from a previous step
    const text = 'Số 15 đầu tiên và số 15 thứ hai.';
    // First 15 is from index 3 to 5
    const protectedSpans = [{ start: 3, end: 5 }];

    const result = vietnameseNumberNormalizer.normalize(text, protectedSpans);
    // The first 15 should remain 15, the second 15 should become "mười lăm"
    expect(result.text).toBe('Số 15 đầu tiên và số mười lăm thứ hai.');
  });
});
