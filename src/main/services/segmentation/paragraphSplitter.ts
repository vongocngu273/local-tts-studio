import type { RawParagraph } from './segment.types';

export class ParagraphSplitter {
  /**
   * Splits text into paragraphs by newline breaks, preserving exact character ranges in input.
   */
  public split(text: string): RawParagraph[] {
    if (!text || text.trim().length === 0) return [];

    const paragraphs: RawParagraph[] = [];
    // Match consecutive newline blocks (one or more empty lines)
    const regex = /\r?\n\s*\r?\n/g;
    let lastIndex = 0;
    let paragraphIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const chunk = text.slice(lastIndex, match.index);
      if (chunk.trim().length > 0) {
        // Calculate leading and trailing whitespace trim offsets within chunk
        const leadingWs = chunk.length - chunk.trimStart().length;
        const trailingWs = chunk.length - chunk.trimEnd().length;
        const startIndex = lastIndex + leadingWs;
        const endIndex = match.index - trailingWs;

        paragraphs.push({
          text: text.slice(startIndex, endIndex),
          paragraphIndex,
          startIndex,
          endIndex
        });
        paragraphIndex++;
      }
      lastIndex = regex.lastIndex;
    }

    // Remaining text after last split
    if (lastIndex < text.length) {
      const chunk = text.slice(lastIndex);
      if (chunk.trim().length > 0) {
        const leadingWs = chunk.length - chunk.trimStart().length;
        const trailingWs = chunk.length - chunk.trimEnd().length;
        const startIndex = lastIndex + leadingWs;
        const endIndex = text.length - trailingWs;

        paragraphs.push({
          text: text.slice(startIndex, endIndex),
          paragraphIndex,
          startIndex,
          endIndex
        });
      }
    }

    return paragraphs;
  }
}

export const paragraphSplitter = new ParagraphSplitter();
