import type { ProviderId, VoiceSettings } from './provider.types';

export type SegmentStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stale';

export interface ProjectSegment {
  id: string;
  projectId: string;
  segmentIndex: number;
  text: string;
  textHash: string;
  baseText: string;
  overrideText: string | null;
  hasOverride: boolean;
  sourceStart: number;
  sourceEnd: number;
  paragraphIndex: number;
  status: SegmentStatus;
  providerId: ProviderId | null;
  voiceId: string | null;
  modelId: string | null;
  settings: VoiceSettings;
  generationId: string | null;
  audioPath: string | null;
  timingPath: string | null;
  durationMs: number | null;
  characterCount: number;
  pauseAfterMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SegmentationProfile {
  targetCharacters: number; // default: 800
  maxCharacters: number; // default: 1200
  minCharacters: number; // default: 80
}

export const DEFAULT_SEGMENTATION_PROFILE: SegmentationProfile = {
  targetCharacters: 800,
  maxCharacters: 1200,
  minCharacters: 80
};

export interface BuildSegmentsResult {
  segments: ProjectSegment[];
  totalSegments: number;
  reusedSegments: number;
  newSegments: number;
}
