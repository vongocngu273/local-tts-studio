import type { TextTransformation } from '@shared/types/textProcessing.types';
import type { MatcherSpan } from '../matcher/dictionaryMatcher';
import { numberToVietnameseWords } from './vietnameseNumberNormalizer';

export class CurrencyNormalizer {
  /**
   * Normalizes Vietnamese Dong amounts (e.g., 1.500.000đ, 250.000 VNĐ, 100.000 VND)
   * into spoken Vietnamese words with "đồng" suffix.
   */
  public normalize(
    text: string,
    protectedSpans: MatcherSpan[] = []
  ): {
    text: string;
    transformations: TextTransformation[];
    protectedSpans: MatcherSpan[];
  } {
    if (!text) return { text, transformations: [], protectedSpans };

    // Matches numbers with thousand separators followed by currency symbol (VNĐ, VND, ₫, đ)
    const currencyRegex = /(?<![\p{L}\p{N}_/-])((?:\d{1,3}(?:\.\d{3})+|\d+))\s*(VNĐ|VND|₫|đ)(?![\p{L}\p{N}_])/gui;

    const matches: Array<{
      start: number;
      end: number;
      rawText: string;
      numVal: number;
    }> = [];

    let m: RegExpExecArray | null;
    while ((m = currencyRegex.exec(text)) !== null) {
      const start = m.index;
      const rawText = m[0];
      const end = start + rawText.length;

      // Check if inside protected span
      const isProtected = protectedSpans.some(
        (span) => Math.max(start, span.start) < Math.min(end, span.end)
      );
      if (isProtected) continue;

      const numStr = m[1].replace(/\./g, '');
      const numVal = parseInt(numStr, 10);
      if (!Number.isFinite(numVal)) continue;

      matches.push({ start, end, rawText, numVal });
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

      const words = numberToVietnameseWords(item.numVal);
      const replacementText = `${words} đồng`;

      const repStart = result.length;
      result += replacementText;
      const repEnd = result.length;

      newProtectedSpans.push({ start: repStart, end: repEnd });

      transformations.push({
        stage: 'currency',
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
      protectedSpans: newProtectedSpans
    };
  }
}

export const currencyNormalizer = new CurrencyNormalizer();
