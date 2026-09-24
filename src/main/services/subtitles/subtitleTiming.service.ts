import fs from 'fs';
import crypto from 'crypto';
import type { ProjectSegment } from '@shared/types/segment.types';
import type { SubtitleCue, SubtitleSettings, TimingAccuracy } from '@shared/types/subtitle.types';
import { DEFAULT_SUBTITLE_SETTINGS } from '@shared/types/subtitle.types';
import { logger } from '../logger/logger';

export interface TimingWord {
  word: string;
  startMs: number;
  endMs: number;
}

export class SubtitleTimingService {
  /**
   * Generates continuous, non-drifting subtitle cues for a project's completed segments.
   * Every cue timestamp is calculated in integer milliseconds relative to the final merged audio.
   */
  public generateCues(
    segments: ProjectSegment[],
    sentencePauseMs = 250,
    paragraphPauseMs = 600,
    settings: SubtitleSettings = DEFAULT_SUBTITLE_SETTINGS
  ): SubtitleCue[] {
    const allCues: SubtitleCue[] = [];
    let currentStartMs = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const durationMs = seg.durationMs || 1000;
      const segmentStartMs = currentStartMs;
      const segmentEndMs = segmentStartMs + durationMs;

      // Extract or estimate cues for this segment
      const segmentCues = this.extractSegmentCues(seg, segmentStartMs, segmentEndMs, settings);
      allCues.push(...segmentCues);

      // Add pause before next segment
      let pauseAfterMs = 0;
      if (i < segments.length - 1) {
        const nextSeg = segments[i + 1];
        pauseAfterMs =
          nextSeg.paragraphIndex > seg.paragraphIndex ? paragraphPauseMs : sentencePauseMs;
      }

      currentStartMs = segmentEndMs + pauseAfterMs;
    }

    return allCues;
  }

  private extractSegmentCues(
    segment: ProjectSegment,
    segmentStartMs: number,
    segmentEndMs: number,
    settings: SubtitleSettings
  ): SubtitleCue[] {
    // 1. Try word/character timing file
    if (segment.timingPath && fs.existsSync(segment.timingPath)) {
      try {
        const timingContent = fs.readFileSync(segment.timingPath, 'utf-8');
        const timingData = JSON.parse(timingContent);
        const words = this.parseWordTimings(timingData);

        if (words.length > 0) {
          return this.groupWordsIntoCues(
            words,
            segment.id,
            segmentStartMs,
            segmentEndMs,
            'word',
            settings
          );
        }
      } catch (err) {
        logger.warn('subtitle:timing', `Failed to parse timing file for segment ${segment.id}`, err);
      }
    }

    // 2. Fallback: Estimate cues from segment text
    return this.estimateCuesFromText(segment, segmentStartMs, segmentEndMs, settings);
  }

  private parseWordTimings(data: unknown): TimingWord[] {
    if (!data) return [];

    // Array of words: [{ word/text, startMs, endMs }]
    if (Array.isArray(data)) {
      return data
        .filter((w) => typeof w === 'object' && w !== null)
        .map((w: Record<string, unknown>) => ({
          word: String(w.word || w.text || ''),
          startMs: Math.round(Number(w.startMs ?? (Number(w.start || 0) * 1000))),
          endMs: Math.round(Number(w.endMs ?? (Number(w.end || 0) * 1000)))
        }))
        .filter((w) => w.word.trim().length > 0);
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.words)) {
        return this.parseWordTimings(obj.words);
      }
    }

    return [];
  }

  private groupWordsIntoCues(
    words: TimingWord[],
    segmentId: string,
    segmentStartMs: number,
    segmentEndMs: number,
    accuracy: TimingAccuracy,
    settings: SubtitleSettings
  ): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const maxChars = settings.maxCharactersPerLine * settings.maxLines;

    let currentWords: TimingWord[] = [];
    let currentLength = 0;

    const flushCurrentWords = () => {
      if (currentWords.length === 0) return;

      const firstWord = currentWords[0];
      const lastWord = currentWords[currentWords.length - 1];

      const startMs = Math.max(segmentStartMs, segmentStartMs + firstWord.startMs);
      const endMs = Math.min(segmentEndMs, segmentStartMs + lastWord.endMs);
      const text = currentWords.map((w) => w.word).join(' ');

      if (endMs > startMs && text.trim().length > 0) {
        cues.push({
          id: crypto.randomUUID(),
          segmentId,
          startMs,
          endMs,
          text: text.trim(),
          accuracy
        });
      }

      currentWords = [];
      currentLength = 0;
    };

    for (const w of words) {
      const wordLen = w.word.length + 1;
      const willExceed = currentLength + wordLen > maxChars;
      const isPunctuationEnd = /[.!?]$/.test(w.word);

      if (willExceed && currentWords.length > 0) {
        flushCurrentWords();
      }

      currentWords.push(w);
      currentLength += wordLen;

      if (isPunctuationEnd) {
        flushCurrentWords();
      }
    }

    flushCurrentWords();
    return cues;
  }

  private estimateCuesFromText(
    segment: ProjectSegment,
    segmentStartMs: number,
    segmentEndMs: number,
    settings: SubtitleSettings
  ): SubtitleCue[] {
    const text = segment.text.trim();
    if (!text) return [];

    const totalDurationMs = segmentEndMs - segmentStartMs;
    const maxChars = settings.maxCharactersPerLine * settings.maxLines;

    // Split text into clauses or reasonable chunks
    const chunks = this.splitIntoSubtitleChunks(text, maxChars);
    if (chunks.length === 0) return [];

    const totalChars = chunks.reduce((acc, c) => acc + c.length, 0);
    const cues: SubtitleCue[] = [];
    let currentChunkStartMs = segmentStartMs;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkRatio = totalChars > 0 ? chunk.length / totalChars : 1 / chunks.length;
      const chunkDurationMs = Math.max(
        settings.minDurationMs,
        Math.round(totalDurationMs * chunkRatio)
      );

      let chunkEndMs = currentChunkStartMs + chunkDurationMs;
      if (i === chunks.length - 1 || chunkEndMs > segmentEndMs) {
        chunkEndMs = segmentEndMs;
      }

      if (chunkEndMs > currentChunkStartMs) {
        cues.push({
          id: crypto.randomUUID(),
          segmentId: segment.id,
          startMs: currentChunkStartMs,
          endMs: chunkEndMs,
          text: chunk,
          accuracy: 'segment-estimated'
        });
      }

      currentChunkStartMs = chunkEndMs;
    }

    return cues;
  }

  private splitIntoSubtitleChunks(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const word of words) {
      if (!current) {
        current = word;
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ` ${word}`;
        if (/[.!?]$/.test(word)) {
          chunks.push(current);
          current = '';
        }
      } else {
        chunks.push(current);
        current = word;
      }
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }
}

export const subtitleTimingService = new SubtitleTimingService();
