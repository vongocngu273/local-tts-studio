import type { TextTransformation } from '@shared/types/textProcessing.types';

export class WhitespaceNormalizer {
  /**
   * Normalizes line breaks and collapses excessive in-line spaces
   * without altering paragraph structure (\n\n) or blank lines.
   */
  public normalize(text: string): { text: string; transformations: TextTransformation[] } {
    if (!text) return { text, transformations: [] };

    // 1. Normalize line endings CRLF / CR -> LF
    const normalizedNewlines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. Process line-by-line: trim trailing spaces, collapse multiple horizontal spaces
    const lines = normalizedNewlines.split('\n');
    const processedLines: string[] = [];

    for (const line of lines) {
      // Replace consecutive horizontal tabs/spaces with a single space, trim edges
      const normalizedLine = line.replace(/[ \t]+/g, ' ').trimEnd();
      processedLines.push(normalizedLine);
    }

    const result = processedLines.join('\n');
    const transformations: TextTransformation[] = [];

    if (result !== text) {
      transformations.push({
        stage: 'whitespace',
        sourceText: text,
        resultText: result,
        sourceStart: 0,
        sourceEnd: text.length
      });
    }

    return { text: result, transformations };
  }
}

export const whitespaceNormalizer = new WhitespaceNormalizer();
