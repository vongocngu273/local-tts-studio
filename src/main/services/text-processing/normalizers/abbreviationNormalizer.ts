import type { TextTransformation } from '@shared/types/textProcessing.types';
import type { MatcherSpan } from '../matcher/dictionaryMatcher';

interface AbbreviationRule {
  pattern: RegExp;
  replacement: string;
}

// Conservative built-in abbreviation rules (Section 37)
const DEFAULT_ABBREVIATIONS: AbbreviationRule[] = [
  {
    pattern: /(?<![\p{L}\p{N}_])(?:TP\.HCM|Tp\.HCM|tphcm)(?![\p{L}\p{N}_])/gu,
    replacement: 'thành phố Hồ Chí Minh'
  },
  {
    pattern: /(?<![\p{L}\p{N}_])VN(?![\p{L}\p{N}_])/gu,
    replacement: 'Việt Nam'
  },
  {
    pattern: /(?<![\p{L}\p{N}_])USD(?![\p{L}\p{N}_])/gu,
    replacement: 'đô la Mỹ'
  }
];

export class AbbreviationNormalizer {
  /**
   * Normalizes well-known standard abbreviations in unprotected spans.
   * User Pronunciation Dictionary rules always have authority over this (Section 111).
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

    const matches: Array<{
      start: number;
      end: number;
      rawText: string;
      replacementText: string;
    }> = [];

    for (const rule of DEFAULT_ABBREVIATIONS) {
      rule.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;

      while ((m = rule.pattern.exec(text)) !== null) {
        const start = m.index;
        const rawText = m[0];
        const end = start + rawText.length;

        // Check if inside protected span
        const isProtected = protectedSpans.some(
          (span) => Math.max(start, span.start) < Math.min(end, span.end)
        );
        if (isProtected) continue;

        matches.push({
          start,
          end,
          rawText,
          replacementText: rule.replacement
        });
      }
    }

    if (matches.length === 0) {
      return { text, transformations: [], protectedSpans };
    }

    // Sort by position ascending
    matches.sort((a, b) => a.start - b.start);

    let result = '';
    let lastIdx = 0;
    const transformations: TextTransformation[] = [];
    const newProtectedSpans: MatcherSpan[] = [...protectedSpans];

    for (const item of matches) {
      if (item.start < lastIdx) continue; // Skip overlapping

      result += text.slice(lastIdx, item.start);

      const repStart = result.length;
      result += item.replacementText;
      const repEnd = result.length;

      newProtectedSpans.push({ start: repStart, end: repEnd });

      transformations.push({
        stage: 'abbreviation',
        sourceText: item.rawText,
        resultText: item.replacementText,
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

export const abbreviationNormalizer = new AbbreviationNormalizer();
