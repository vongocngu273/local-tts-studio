import { describe, it, expect } from 'vitest';
import { dateNormalizer } from '../src/main/services/text-processing/normalizers/dateNormalizer';

describe('DateNormalizer', () => {
  it('should normalize valid DD/MM/YYYY dates into natural Vietnamese words', () => {
    const text = 'Sự kiện diễn ra vào 15/08/2026 tại Hà Nội.';
    const result = dateNormalizer.normalize(text);

    expect(result.text).toBe(
      'Sự kiện diễn ra vào ngày mười lăm tháng tám năm hai nghìn không trăm hai mươi sáu tại Hà Nội.'
    );
    expect(result.transformations.length).toBe(1);
    expect(result.transformations[0].sourceText).toBe('15/08/2026');
  });

  it('should support hyphenated dates DD-MM-YYYY', () => {
    const text = 'Hạn chót là 01-09-2025 tới.';
    const result = dateNormalizer.normalize(text);

    expect(result.text).toBe(
      'Hạn chót là ngày một tháng chín năm hai nghìn không trăm hai mươi lăm tới.'
    );
  });

  it('should NOT repeat "ngày" if the text already contains a leading "ngày"', () => {
    const text = 'Quyết định ký từ ngày 01/07/2026 có hiệu lực.';
    const result = dateNormalizer.normalize(text);

    // Should NOT say "ngày ngày một"
    expect(result.text).toBe(
      'Quyết định ký từ ngày một tháng bảy năm hai nghìn không trăm hai mươi sáu có hiệu lực.'
    );
  });

  it('should validate calendar dates and NOT alter invalid dates', () => {
    // 31/02/2026 does not exist
    const invalidDateText = 'Hạn nộp là 31/02/2026.';
    const resultInvalid = dateNormalizer.normalize(invalidDateText);
    expect(resultInvalid.text).toBe('Hạn nộp là 31/02/2026.');
    expect(resultInvalid.transformations.length).toBe(0);

    // 32/01/2026 does not exist
    const invalidDayText = 'Ngày 32/01/2026 không hợp lệ.';
    const resultDay = dateNormalizer.normalize(invalidDayText);
    expect(resultDay.text).toBe('Ngày 32/01/2026 không hợp lệ.');
  });

  it('should accurately handle leap year dates', () => {
    // 29/02/2024 is a leap year -> valid
    const leapYearValid = 'Họp ngày 29/02/2024.';
    const resultLeap = dateNormalizer.normalize(leapYearValid);
    expect(resultLeap.text).toBe(
      'Họp ngày hai mươi chín tháng hai năm hai nghìn không trăm hai mươi bốn.'
    );

    // 29/02/2025 is NOT a leap year -> invalid
    const leapYearInvalid = 'Họp ngày 29/02/2025.';
    const resultNonLeap = dateNormalizer.normalize(leapYearInvalid);
    expect(resultNonLeap.text).toBe('Họp ngày 29/02/2025.');
  });
});
