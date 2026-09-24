export interface AudioCompositionSettings {
  sentencePauseMs: number; // default: 150
  paragraphPauseMs: number; // default: 400
  fadeInMs: number; // default: 0
  fadeOutMs: number; // default: 0
  normalizationEnabled: boolean; // default: false (loudnorm)
  targetBitrateKbps: number; // default: 128
  autoBuildWhenComplete: boolean; // default: true
}

export const DEFAULT_COMPOSITION_SETTINGS: AudioCompositionSettings = {
  sentencePauseMs: 150,
  paragraphPauseMs: 400,
  fadeInMs: 0,
  fadeOutMs: 0,
  normalizationEnabled: false,
  targetBitrateKbps: 128,
  autoBuildWhenComplete: true
};

export interface AudioComposition {
  id: string;
  projectId: string;
  sourceFingerprint: string;
  segmentCount: number;
  outputMp3Path: string | null;
  outputWavPath: string | null;
  durationMs: number | null;
  sizeBytes: number | null;
  settings: AudioCompositionSettings;
  status: 'completed' | 'failed' | 'processing';
  createdAt: string;
  completedAt: string | null;
}

export interface SegmentAudioOffset {
  segmentId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  pauseAfterMs: number;
}

