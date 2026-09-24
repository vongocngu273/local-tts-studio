import type { TextTransformation, TextProcessingWarning } from '@shared/types/textProcessing.types';
import type { MatcherSpan } from '../matcher/dictionaryMatcher';
import { numberToVietnameseWords } from './vietnameseNumberNormalizer';

const MONTH_NAMES = [
  '',
  'tháng một',
  'tháng hai',
  'tháng ba',
  'tháng tư',
  'tháng năm',
  'tháng sáu',
  'tháng bảy',
  'tháng tám',
  'tháng chín',
  'tháng mười',
  'tháng mười một',
  'tháng mười hai'
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [0, 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month];
}

export class DateNormalizer {
  /**
   * Normalizes DD/MM/YYYY or DD-MM-YYYY into spoken Vietnamese words.
   * Skips invalid calendar dates and generates warnings.
   */
  public normalize(
    text: string,
    protectedSpans: MatcherSpan[] = []
  ): {
    text: string;
    transformations: TextTransformation[];
    protectedSpans: MatcherSpan[];
    warnings: TextProcessingWarning[];
  } {
    if (!text) return { text, transformations: [], protectedSpans, warnings: [] };

    // Matches DD/MM/YYYY or DD-MM-YYYY
    const dateRegex = /(?<![\p{L}\p{N}_])(\d{1,2})([/-])(\d{1,2})\2(\d{4})(?![\p{L}\p{N}_])/gu;

    const matches: Array<{
      start: number;
      end: number;
      rawText: string;
      day: number;
      month: number;
      year: number;
      hasLeadingNgay: boolean;
    }> = [];

    const warnings: TextProcessingWarning[] = [];
    let m: RegExpExecArray | null;

    while ((m = dateRegex.exec(text)) !== null) {
      const start = m.index;
      const rawText = m[0];
      const end = start + rawText.length;

      // Check if inside protected span
      const isProtected = protectedSpans.some(
        (span) => Math.max(start, span.start) < Math.min(end, span.end)
      );
      if (isProtected) continue;

      const day = parseInt(m[1], 10);
      const month = parseInt(m[3], 10);
      const year = parseInt(m[4], 10);

      // Validate date (Section 32, 87)
      if (!isValidCalendarDate(day, month, year)) {
        warnings.push({
          code: 'INVALID_DATE',
          message: `Possible invalid date: ${rawText}`,
          position: start,
          text: rawText
        });
        continue;
      }

      // Check if preceded by word "ngày "
      const prefix = text.slice(Math.max(0, start - 10), start);
      const hasLeadingNgay = /(?:ngày|ngay)\s+$/i.test(prefix);

      matches.push({
        start,
        end,
        rawText,
        day,
        month,
        year,
        hasLeadingNgay
      });
    }

    if (matches.length === 0) {
      return { text, transformations: [], protectedSpans, warnings };
    }

    let result = '';
    let lastIdx = 0;
    const transformations: TextTransformation[] = [];
    const newProtectedSpans: MatcherSpan[] = [...protectedSpans];

    for (const item of matches) {
      result += text.slice(lastIdx, item.start);

      const dayWord = numberToVietnameseWords(item.day);
      const monthWord = MONTH_NAMES[item.month];
      const yearWord = numberToVietnameseWords(item.year);

      // If preceded by "ngày", don't repeat "ngày" (Section 1)
      const replacementText = item.hasLeadingNgay
        ? `${dayWord} ${monthWord} năm ${yearWord}`
        : `ngày ${dayWord} ${monthWord} năm ${yearWord}`;

      const repStart = result.length;
      result += replacementText;
      const repEnd = result.length;

      newProtectedSpans.push({ start: repStart, end: repEnd });

      transformations.push({
        stage: 'date',
        sourceText: item.rawText,
        resultText: replacementText,
        sourceStart: item.start,
        sourceEnd: item.end
      });

      lastIdx = item.end;
    }

    result += text.slice(lastIdx);

    return {
      text: result,
      transformations,
      protectedSpans: newProtectedSpans,
      warnings
    };
  }
}

export const dateNormalizer = new DateNormalizer();
