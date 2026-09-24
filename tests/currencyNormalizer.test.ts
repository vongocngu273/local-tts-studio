import { describe, it, expect } from 'vitest';
import { currencyNormalizer } from '../src/main/services/text-processing/normalizers/currencyNormalizer';

describe('CurrencyNormalizer', () => {
  it('should normalize amounts with VNĐ, VND, ₫, and đ into Vietnamese words with "đồng"', () => {
    const testCases: [string, string][] = [
      ['Tổng số tiền là 50.000 VNĐ cho mỗi vé.', 'Tổng số tiền là năm mươi nghìn đồng cho mỗi vé.'],
      ['Giá bán 100.000đ tại cửa hàng.', 'Giá bán một trăm nghìn đồng tại cửa hàng.'],
      ['Lệ phí 1.500.000 VND một tháng.', 'Lệ phí một triệu năm trăm nghìn đồng một tháng.'],
      ['Thu thêm 500₫ phí dịch vụ.', 'Thu thêm năm trăm đồng phí dịch vụ.']
    ];

    for (const [input, expectedOutput] of testCases) {
      const result = currencyNormalizer.normalize(input);
      expect(result.text).toBe(expectedOutput);
      expect(result.transformations.length).toBe(1);
    }
  });

  it('should respect protected spans and not touch them', () => {
    const text = 'Khoản 1: 50.000 VNĐ. Khoản 2: 50.000 VNĐ.';
    // Protect first amount (index 9 to 19)
    const protectedSpans = [{ start: 9, end: 19 }];

    const result = currencyNormalizer.normalize(text, protectedSpans);
    expect(result.text).toBe('Khoản 1: 50.000 VNĐ. Khoản 2: năm mươi nghìn đồng.');
    expect(result.transformations.length).toBe(1);
  });
});
