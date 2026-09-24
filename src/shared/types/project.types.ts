import type { ProviderId } from './provider.types';
import type { TextProcessingSettings } from './textProcessing.types';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  RenameProjectInput,
  SaveProjectTextInput,
  SaveProjectDraftInput,
  ProjectListOptionsInput
} from '../schemas/project.schema';

export type {
  CreateProjectInput,
  UpdateProjectInput,
  RenameProjectInput,
  SaveProjectTextInput,
  SaveProjectDraftInput,
  ProjectListOptionsInput
};

export type ProjectStatus = 'draft' | 'ready' | 'processing' | 'completed' | 'error';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

import type { SegmentationProfile } from './segment.types';
import type { AudioCompositionSettings } from './composition.types';
import type { SubtitleSettings } from './subtitle.types';
import type { QueueSettings } from './queue.types';

export interface ProjectSettings {
  version: number;
  text?: {
    normalizationEnabled?: boolean;
  };
  textProcessing?: TextProcessingSettings;
  voice?: {
    speed?: number;
    pitch?: number;
    volume?: number;
  };
  segmentation?: SegmentationProfile;
  audioComposition?: AudioCompositionSettings;
  subtitle?: SubtitleSettings;
  queue?: QueueSettings;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  originalText: string;
  processedText: string;
  providerId: ProviderId | null;
  voiceId: string | null;
  settings: ProjectSettings;
  projectPath: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  deletedAt?: string | null;
}

export interface ProjectDraft {
  projectId: string;
  originalText: string;
  processedText: string;
  revision: number;
  updatedAt: string;
}

export type ProjectSortOption =
  | 'recently_updated'
  | 'recently_created'
  | 'name_asc'
  | 'name_desc';

export type ProjectListOptions = ProjectListOptionsInput;
