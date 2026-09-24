export type TimingAccuracy =
  | 'character'
  | 'word'
  | 'provider-subtitle'
  | 'segment-estimated';

export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  segmentId: string;
  accuracy: TimingAccuracy;
}

export type SubtitleExportFormat = 'srt' | 'vtt';

export interface SubtitleSettings {
  maxCharactersPerLine: number; // default: 42
  maxLines: number; // default: 2
  minDurationMs: number; // default: 1000
  maxDurationMs: number; // default: 7000
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  maxCharactersPerLine: 42,
  maxLines: 2,
  minDurationMs: 1000,
  maxDurationMs: 7000
};

export interface SubtitleExportResult {
  filePath: string;
  cueCount: number;
  format: SubtitleExportFormat;
}
