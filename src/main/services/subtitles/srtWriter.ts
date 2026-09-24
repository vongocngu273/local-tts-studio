import type { SubtitleCue, SubtitleSettings } from '@shared/types/subtitle.types';

export class SrtWriter {
  /**
   * Formats millisecond timestamp as SRT timecode: HH:MM:SS,mmm
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

    return `${hh}:${mm}:${ss},${mmm}`;
  }

  /**
   * Wraps text into lines according to maxCharactersPerLine and maxLines.
   */
  public static wrapText(
    text: string,
    maxChars = 42,
    maxLines = 2
  ): string {
    const words = text.trim().split(/\s+/);
    if (words.length === 0 || words[0] === '') return '';

    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxChars) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Limit to maxLines
    if (lines.length > maxLines) {
      const topLines = lines.slice(0, maxLines - 1);
      const remaining = lines.slice(maxLines - 1).join(' ');
      return [...topLines, remaining].join('\n');
    }

    return lines.join('\n');
  }

  /**
   * Writes array of SubtitleCue to valid SRT formatted string.
   */
  public static write(cues: SubtitleCue[], settings?: Partial<SubtitleSettings>): string {
    const maxChars = settings?.maxCharactersPerLine ?? 42;
    const maxLines = settings?.maxLines ?? 2;

    const entries: string[] = [];

    cues.forEach((cue, index) => {
      const startTime = SrtWriter.formatTimestamp(cue.startMs);
      const endTime = SrtWriter.formatTimestamp(cue.endMs);
      const wrappedText = SrtWriter.wrapText(cue.text, maxChars, maxLines);

      entries.push(`${index + 1}\n${startTime} --> ${endTime}\n${wrappedText}`);
    });

    return entries.join('\n\n') + (entries.length > 0 ? '\n' : '');
  }
}
