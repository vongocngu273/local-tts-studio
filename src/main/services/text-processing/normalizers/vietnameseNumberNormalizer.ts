import type { TextTransformation } from '@shared/types/textProcessing.types';
import type { MatcherSpan } from '../matcher/dictionaryMatcher';

const DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALE_WORDS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

/**
 * Converts an integer number into standard Vietnamese words with deterministic rules.
 */
export function numberToVietnameseWords(num: number | bigint): string {
  if (num === 0n || num === 0) {
    return 'không';
  }

  let n = typeof num === 'bigint' ? num : BigInt(Math.floor(num));
  let isNegative = false;
  if (n < 0n) {
    isNegative = true;
    n = -n;
  }

  // Split into 3-digit groups
  const groups: number[] = [];
  while (n > 0n) {
    groups.push(Number(n % 1000n));
    n /= 1000n;
  }

  const parts: string[] = [];
  const totalGroups = groups.length;

  for (let i = totalGroups - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal === 0 && i !== 0) {
      continue;
    }

    const hasHigherGroup = i < totalGroups - 1;
    const groupWords = readThreeDigits(groupVal, hasHigherGroup, i > 0);

    if (groupWords) {
      const scale = SCALE_WORDS[i % SCALE_WORDS.length];
      if (scale) {
        parts.push(`${groupWords} ${scale}`);
      } else {
        parts.push(groupWords);
      }
    }
  }

  const result = parts.join(' ').trim();
  return isNegative ? `âm ${result}` : result;
}

function readThreeDigits(val: number, hasHigherGroup: boolean, _hasLowerGroup: boolean): string {
  const hundreds = Math.floor(val / 100);
  const tens = Math.floor((val % 100) / 10);
  const units = val % 10;

  if (val === 0) {
    return '';
  }

  const words: string[] = [];

  // Hundreds
  if (hundreds > 0) {
    words.push(`${DIGIT_WORDS[hundreds]} trăm`);
  } else if (hasHigherGroup) {
    // e.g. in 2026: 2 thousands, 0 hundreds -> "không trăm"
    words.push('không trăm');
  }

  // Tens & Units
  if (tens > 1) {
    words.push(`${DIGIT_WORDS[tens]} mươi`);
    if (units === 1) {
      words.push('mốt');
    } else if (units === 5) {
      words.push('lăm');
    } else if (units > 0) {
      words.push(DIGIT_WORDS[units]);
    }
  } else if (tens === 1) {
    words.push('mười');
    if (units === 5) {
      words.push('lăm');
    } else if (units > 0) {
      words.push(DIGIT_WORDS[units]);
    }
  } else {
    // tens === 0
    if (units > 0) {
      if (hundreds > 0 || hasHigherGroup) {
        words.push(`lẻ ${DIGIT_WORDS[units]}`);
      } else {
        words.push(DIGIT_WORDS[units]);
      }
    }
  }

  return words.join(' ');
}

export class VietnameseNumberNormalizer {
  /**
   * Normalizes standalone numbers (e.g. 15, 125, 1.500, 2026) in unprotected spans of text.
   * Conservative safety: Ignores codes like MST12345, ID001, 2026/ABC, 70/2025/NĐ-CP.
   */
  public normalize(
    text: string,
    protectedSpans: MatcherSpan[] = []
  ): { text: string; transformations: TextTransformation[]; protectedSpans: MatcherSpan[] } {
    if (!text) return { text, transformations: [], protectedSpans };

    // Matches numbers with optional Vietnamese thousands dots (e.g., 1.500 or 1500 or 2026)
    // Regex uses lookbehind and lookahead to avoid word characters, slashes, dashes, or letters
    const numberRegex = /(?<![\p{L}\p{N}_/-])(?:\d{1,3}(?:\.\d{3})+|\d+)(?![\p{L}\p{N}_/-])/gu;

    const matches: Array<{ start: number; end: number; matchStr: string; numVal: number }> = [];
    let m: RegExpExecArray | null;

    while ((m = numberRegex.exec(text)) !== null) {
      const start = m.index;
      const matchStr = m[0];
      const end = start + matchStr.length;

      // Check if inside protected span
      const isProtected = protectedSpans.some(
        (span) => Math.max(start, span.start) < Math.min(end, span.end)
      );
      if (isProtected) continue;

      // Clean thousands separator dots
      const cleanNumStr = matchStr.replace(/\./g, '');
      if (cleanNumStr.length > 15) continue; // Avoid overflow

      const numVal = parseInt(cleanNumStr, 10);
      if (!Number.isFinite(numVal)) continue;

      matches.push({ start, end, matchStr, numVal });
    }

    if (matches.length === 0) {
      return { text, transformations: [], protectedSpans };
    }

    let result = '';
    let lastIdx = 0;
    const transformations: TextTransformation[] = [];
    const newProtectedSpans: MatcherSpan[] = [...protectedSpans];

    for (const item of matches) {
      result += text.slice(lastIdx, item.start);

      const replacementWords = numberToVietnameseWords(item.numVal);
      const repStart = result.length;
      result += replacementWords;
      const repEnd = result.length;

      newProtectedSpans.push({ start: repStart, end: repEnd });

      transformations.push({
        stage: 'number',
        sourceText: item.matchStr,
        resultText: replacementWords,
        sourceStart: item.start,
        sourceEnd: item.end
      });

      lastIdx = item.end;
    }

    result += text.slice(lastIdx);

    return {
      text: result,
      transformations,
      protectedSpans: newProtectedSpans
    };
  }
}

export const vietnameseNumberNormalizer = new VietnameseNumberNormalizer();
