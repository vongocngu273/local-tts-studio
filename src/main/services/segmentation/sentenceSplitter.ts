import type { RawParagraph, RawSentence } from './segment.types';

export class SentenceSplitter {
  // Abbreviations that should never trigger sentence splits
  private static readonly VIETNAMESE_ABBREVIATIONS = new Set([
    'tp',
    'tp.hcm',
    'tphcm',
    'p.gs',
    'pgs',
    'gs',
    'ts',
    'ths',
    'bs',
    'ds',
    'ks',
    'cn',
    'th.s',
    'p',
    'q',
    'tx',
    'tt',
    'kcn',
    'tnhh',
    'cp',
    'vn',
    'v.v',
    'no',
    'str'
  ]);

  /**
   * Splits a paragraph into sentences, honoring Vietnamese abbreviations and document codes.
   */
  public splitParagraph(para: RawParagraph): RawSentence[] {
    const text = para.text;
    if (!text || text.trim().length === 0) return [];

    const sentenceBoundaries: number[] = [];
    const len = text.length;

    for (let i = 0; i < len; i++) {
      const char = text[i];
      // Check sentence terminal punctuation: . ! ? ; \n
      if (char === '.' || char === '!' || char === '?' || char === ';') {
        // If it's a dot, check whether it's an abbreviation, number, or document code
        if (char === '.') {
          if (this.isAbbreviationOrCode(text, i)) {
            continue;
          }
        }

        // Check if this punctuation mark is followed by a closing quote or parenthesis
        let endIdx = i + 1;
        while (endIdx < len && (text[endIdx] === '"' || text[endIdx] === "'" || text[endIdx] === '»' || text[endIdx] === '”' || text[endIdx] === ')')) {
          endIdx++;
        }

        // Must be followed by whitespace or end of string to qualify as sentence boundary
        if (endIdx >= len || /\s/.test(text[endIdx])) {
          sentenceBoundaries.push(endIdx);
          i = endIdx - 1;
        }
      }
    }

    const sentences: RawSentence[] = [];
    let startLocal = 0;

    for (const boundary of sentenceBoundaries) {
      const slice = text.slice(startLocal, boundary);
      if (slice.trim().length > 0) {
        const leadingWs = slice.length - slice.trimStart().length;
        const trailingWs = slice.length - slice.trimEnd().length;
        const sStart = startLocal + leadingWs;
        const sEnd = boundary - trailingWs;

        sentences.push({
          text: text.slice(sStart, sEnd),
          paragraphIndex: para.paragraphIndex,
          startIndex: para.startIndex + sStart,
          endIndex: para.startIndex + sEnd
        });
      }
      startLocal = boundary;
    }

    // Remaining tail
    if (startLocal < len) {
      const slice = text.slice(startLocal);
      if (slice.trim().length > 0) {
        const leadingWs = slice.length - slice.trimStart().length;
        const trailingWs = slice.length - slice.trimEnd().length;
        const sStart = startLocal + leadingWs;
        const sEnd = len - trailingWs;

        sentences.push({
          text: text.slice(sStart, sEnd),
          paragraphIndex: para.paragraphIndex,
          startIndex: para.startIndex + sStart,
          endIndex: para.startIndex + sEnd
        });
      }
    }

    return sentences;
  }

  /**
   * Determines if a period at index `dotIdx` is part of an abbreviation, number, or document code.
   */
  private isAbbreviationOrCode(text: string, dotIdx: number): boolean {
    const len = text.length;

    // 1. Decimal or thousand separator: preceded and followed by digits (e.g. 3.14, 1.500)
    const prevChar = dotIdx > 0 ? text[dotIdx - 1] : '';
    const nextChar = dotIdx + 1 < len ? text[dotIdx + 1] : '';
    if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
      return true;
    }

    // 2. Part of document/legal code with slashes: e.g. 70/2025/NĐ-CP or 91/2025/QH15
    const windowStart = Math.max(0, dotIdx - 20);
    const windowEnd = Math.min(len, dotIdx + 20);
    const windowText = text.slice(windowStart, windowEnd);
    if (/\d+\/\d+\/[A-ZĐa-zđ-]+/.test(windowText)) {
      return true;
    }

    // 3. Preceded by known Vietnamese abbreviation (e.g., "TP.", "TS.", "ThS.", "P.GS.", "v.v.")
    // Find preceding word
    let wordStart = dotIdx - 1;
    while (wordStart >= 0 && /[\p{L}\p{N}._]/u.test(text[wordStart])) {
      wordStart--;
    }
    const precedingWord = text.slice(wordStart + 1, dotIdx).toLowerCase();

    if (SentenceSplitter.VIETNAMESE_ABBREVIATIONS.has(precedingWord)) {
      return true;
    }

    // 4. Followed immediately by another dot (ellipsis '...')
    if (nextChar === '.') {
      return true;
    }
    if (prevChar === '.') {
      return true;
    }

    // 5. Followed immediately by lowercase letter (unlikely to be new sentence)
    if (nextChar && /^\p{Ll}$/u.test(nextChar)) {
      return true;
    }

    return false;
  }
}

export const sentenceSplitter = new SentenceSplitter();
