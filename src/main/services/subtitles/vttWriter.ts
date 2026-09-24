import type { SubtitleCue, SubtitleSettings } from '@shared/types/subtitle.types';
import { SrtWriter } from './srtWriter';

export class VttWriter {
  /**
   * Formats millisecond timestamp as WebVTT timecode: HH:MM:SS.mmm
   */
  public static formatTimestamp(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const milliseconds = Math.max(0, Math.floor(ms % 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const mmm = String(milliseconds).padStart(3, '0');

    return `${hh}:${mm}:${ss}.${mmm}`;
  }

  /**
   * Writes array of SubtitleCue to valid WebVTT formatted string.
   */
  public static write(cues: SubtitleCue[], settings?: Partial<SubtitleSettings>): string {
    const maxChars = settings?.maxCharactersPerLine ?? 42;
    const maxLines = settings?.maxLines ?? 2;

    const lines: string[] = ['WEBVTT', ''];

    cues.forEach((cue, index) => {
      const startTime = VttWriter.formatTimestamp(cue.startMs);
      const endTime = VttWriter.formatTimestamp(cue.endMs);
      const wrappedText = SrtWriter.wrapText(cue.text, maxChars, maxLines);

      lines.push(`${index + 1}`);
      lines.push(`${startTime} --> ${endTime}`);
      lines.push(wrappedText);
      lines.push('');
    });

    return lines.join('\n');
  }
}
