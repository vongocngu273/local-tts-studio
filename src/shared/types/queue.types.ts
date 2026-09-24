import type { ProviderId } from './provider.types';

export type JobType =
  | 'segment_tts'
  | 'merge_audio'
  | 'build_subtitle'
  | 'export_audio';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retry_wait'
  | 'cancelled'
  | 'interrupted';

export interface TTSJob {
  id: string;
  projectId: string;
  segmentId: string | null;
  jobType: JobType;
  providerId: ProviderId;
  status: JobStatus;
  priority: number;
  attempt: number;
  maxAttempts: number;
  providerJobId: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  availableAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QueueStatus {
  isPaused: boolean;
  isRunning: boolean;
  activeJobCount: number;
  pendingJobCount: number;
  completedJobCount: number;
  failedJobCount: number;
  totalJobCount: number;
  currentJobDescription?: string;
}

export interface QueueEvent {
  type:
    | 'job:started'
    | 'job:updated'
    | 'job:completed'
    | 'job:failed'
    | 'queue:paused'
    | 'queue:resumed'
    | 'queue:progress';
  job?: TTSJob;
  status?: QueueStatus;
  projectId?: string;
}

export interface QueueSettings {
  concurrency: number; // default: 1
  maxAttempts: number; // default: 3
}

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  concurrency: 1,
  maxAttempts: 3
};
