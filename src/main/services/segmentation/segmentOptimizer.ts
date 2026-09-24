import type { RawSentence, OptimizedSegment } from './segment.types';
import type { SegmentationProfile } from '@shared/types/segment.types';
import { DEFAULT_SEGMENTATION_PROFILE } from '@shared/types/segment.types';

export class SegmentOptimizer {
  /**
   * Optimizes sentences into balanced segments respecting target, min, and max character limits.
   */
  public optimize(
    sentences: RawSentence[],
    profile: SegmentationProfile = DEFAULT_SEGMENTATION_PROFILE
  ): OptimizedSegment[] {
    if (sentences.length === 0) return [];

    const { targetCharacters, maxCharacters, minCharacters } = profile;

    // Step 1: Break oversized sentences (> maxCharacters)
    const normalizedSentences: RawSentence[] = [];
    for (const sent of sentences) {
      if (sent.text.length > maxCharacters) {
        const subSentences = this.splitOversizedSentence(sent, maxCharacters);
        normalizedSentences.push(...subSentences);
      } else {
        normalizedSentences.push(sent);
      }
    }

    // Step 2: Merge sentences within same paragraph up to targetCharacters without exceeding maxCharacters
    const segments: OptimizedSegment[] = [];
    let currentBatch: RawSentence[] = [];
    let currentLen = 0;

    const flushBatch = () => {
      if (currentBatch.length === 0) return;
      const first = currentBatch[0];
      const last = currentBatch[currentBatch.length - 1];

      // Join sentences with single space
      const fullText = currentBatch.map((s) => s.text).join(' ');

      segments.push({
        text: fullText,
        paragraphIndex: first.paragraphIndex,
        sourceStart: first.startIndex,
        sourceEnd: last.endIndex,
        characterCount: fullText.length
      });

      currentBatch = [];
      currentLen = 0;
    };

    for (let i = 0; i < normalizedSentences.length; i++) {
      const sentence = normalizedSentences[i];

      // If switching paragraphs, flush current batch first
      if (currentBatch.length > 0 && currentBatch[0].paragraphIndex !== sentence.paragraphIndex) {
        flushBatch();
      }

      // Space needed if adding to batch
      const spaceLen = currentBatch.length > 0 ? 1 : 0;
      const projectedLen = currentLen + spaceLen + sentence.text.length;

      // Decide whether to merge:
      // If adding this sentence stays within maxCharacters, and:
      // - currentLen < targetCharacters OR currentLen < minCharacters OR projectedLen <= targetCharacters
      if (
        currentBatch.length === 0 ||
        (projectedLen <= maxCharacters && (currentLen < minCharacters || projectedLen <= targetCharacters + 100))
      ) {
        currentBatch.push(sentence);
        currentLen = projectedLen;
      } else {
        flushBatch();
        currentBatch.push(sentence);
        currentLen = sentence.text.length;
      }
    }

    flushBatch();
    return segments;
  }

  /**
   * Splits an oversized sentence exceeding maxCharacters by clause delimiters or whitespace.
   */
  private splitOversizedSentence(sent: RawSentence, maxChars: number): RawSentence[] {
    const text = sent.text;
    const result: RawSentence[] = [];

    // Delimiters in order of preference: semicolon, colon, em-dash, comma, whitespace
    const delimiters = [';', ':', '—', '--', ',', ' '];

    let currentStart = 0;
    while (currentStart < text.length) {
      const remainingLen = text.length - currentStart;
      if (remainingLen <= maxChars) {
        const slice = text.slice(currentStart);
        const leadingWs = slice.length - slice.trimStart().length;
        const trailingWs = slice.length - slice.trimEnd().length;

        result.push({
          text: slice.trim(),
          paragraphIndex: sent.paragraphIndex,
          startIndex: sent.startIndex + currentStart + leadingWs,
          endIndex: sent.startIndex + text.length - trailingWs
        });
        break;
      }

      // Find best split point before maxChars
      const searchWindow = text.slice(currentStart, currentStart + maxChars);
      let splitIdx = -1;

      for (const delim of delimiters) {
        const lastDelim = searchWindow.lastIndexOf(delim);
        // Ensure split occurs with at least 50 characters to avoid tiny fragments
        if (lastDelim >= 50) {
          splitIdx = currentStart + lastDelim + (delim === ' ' ? 0 : delim.length);
          break;
        }
      }

      // Hard split fallback if no delimiter found
      if (splitIdx === -1 || splitIdx <= currentStart) {
        splitIdx = currentStart + maxChars;
      }

      const chunk = text.slice(currentStart, splitIdx);
      const leadingWs = chunk.length - chunk.trimStart().length;
      const trailingWs = chunk.length - chunk.trimEnd().length;

      result.push({
        text: chunk.trim(),
        paragraphIndex: sent.paragraphIndex,
        startIndex: sent.startIndex + currentStart + leadingWs,
        endIndex: sent.startIndex + splitIdx - trailingWs
      });

      currentStart = splitIdx;
      // Skip whitespace
      while (currentStart < text.length && /\s/.test(text[currentStart])) {
        currentStart++;
      }
    }

    return result;
  }
}

export const segmentOptimizer = new SegmentOptimizer();
