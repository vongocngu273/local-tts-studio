import type { AppInfo, AppPaths } from '../schemas/app.schema';
import type { SystemInfo, FFmpegStatus } from '../schemas/system.schema';
import type {
  Project,
  ProjectDraft,
  CreateProjectInput,
  UpdateProjectInput,
  SaveProjectTextInput,
  SaveProjectDraftInput,
  ProjectListOptionsInput
} from './project.types';
import type {
  PronunciationRule,
  CreatePronunciationRuleInput,
  UpdatePronunciationRuleInput,
  DictionaryListOptionsInput,
  DictionaryImportInput,
  DictionaryImportPreviewResult,
  DictionaryExportInput
} from './dictionary.types';
import type {
  TextProcessingRequest,
  TextProcessingResult,
  TextProcessingSettings
} from './textProcessing.types';
import type {
  ProviderId,
  ProviderPublicInfo,
  VoiceDefinition,
  VoiceFilterOptions,
  VoicePreviewRequest,
  VoiceSettings,
  ProjectAudioGenerateRequest,
  TTSGeneration,
  UpdateProviderSettingsInput,
  SetProviderSecretInput
} from './provider.types';
import type {
  ProjectSegment,
  BuildSegmentsResult,
  SegmentationProfile
} from './segment.types';
import type { TTSJob, QueueStatus, QueueEvent } from './queue.types';
import type { AudioComposition, AudioCompositionSettings } from './composition.types';
import type {
  SubtitleCue,
  SubtitleExportFormat,
  SubtitleExportResult,
  SubtitleSettings
} from './subtitle.types';
import type { ProjectExportOptions, ProjectExportResult } from './export.types';

export interface LocalTTSApi {
  app: {
    getInfo: () => Promise<AppInfo>;
    getPaths: () => Promise<AppPaths>;
    openWorkspace: () => Promise<boolean>;
  };
  system: {
    getInfo: () => Promise<SystemInfo>;
    getFFmpegStatus: () => Promise<FFmpegStatus>;
  };
  projects: {
    create: (input?: CreateProjectInput) => Promise<Project>;
    get: (id: string) => Promise<Project | null>;
    list: (options?: ProjectListOptionsInput) => Promise<Project[]>;
    update: (id: string, changes: UpdateProjectInput) => Promise<Project>;
    rename: (id: string, name: string) => Promise<Project>;
    duplicate: (id: string) => Promise<Project>;
    remove: (id: string) => Promise<boolean>;
    restore: (id: string) => Promise<Project>;
    saveText: (input: SaveProjectTextInput) => Promise<Project>;
    saveDraft: (input: SaveProjectDraftInput) => Promise<boolean>;
    openFolder: (id: string) => Promise<boolean>;
    recovery: {
      check: (id: string) => Promise<ProjectDraft | null>;
      recover: (id: string) => Promise<Project>;
      discard: (id: string) => Promise<boolean>;
    };
  };
  dictionary: {
    create: (input: CreatePronunciationRuleInput) => Promise<PronunciationRule>;
    get: (id: string) => Promise<PronunciationRule | null>;
    list: (options?: DictionaryListOptionsInput) => Promise<PronunciationRule[]>;
    update: (id: string, changes: UpdatePronunciationRuleInput) => Promise<PronunciationRule>;
    remove: (id: string) => Promise<boolean>;
    removeMany: (ids: string[]) => Promise<number>;
    setEnabled: (id: string, enabled: boolean) => Promise<boolean>;
    setEnabledMany: (ids: string[], enabled: boolean) => Promise<number>;
    getCategories: () => Promise<string[]>;
    getRevision: () => Promise<number>;
    testRule: (input: {
      rule: CreatePronunciationRuleInput;
      sampleText: string;
    }) => Promise<{ original: string; processed: string; matched: boolean }>;
    import: {
      selectFile: () => Promise<{ content: string; format: 'json' | 'csv'; filePath: string } | null>;
      preview: (input: DictionaryImportInput) => Promise<DictionaryImportPreviewResult>;
      execute: (input: DictionaryImportInput) => Promise<{ inserted: number; updated: number; skipped: number }>;
    };
    export: {
      toFile: (input: DictionaryExportInput) => Promise<boolean>;
    };
  };
  textProcessing: {
    preview: (input: TextProcessingRequest) => Promise<TextProcessingResult>;
    processProject: (
      projectId: string,
      settings?: Partial<TextProcessingSettings>
    ) => Promise<TextProcessingResult>;
  };
  providers: {
    getAll: () => Promise<ProviderPublicInfo[]>;
    updateSettings: (input: UpdateProviderSettingsInput) => Promise<boolean>;
    setSecret: (input: SetProviderSecretInput) => Promise<boolean>;
    deleteSecret: (providerId: ProviderId, secretName?: string) => Promise<boolean>;
    testConnection: (providerId: ProviderId) => Promise<{ success: boolean; message: string }>;
  };
  voices: {
    list: (filter?: VoiceFilterOptions) => Promise<VoiceDefinition[]>;
    refresh: (providerId?: ProviderId) => Promise<VoiceDefinition[]>;
    toggleFavorite: (providerId: ProviderId, voiceId: string) => Promise<boolean>;
    getFavorites: () => Promise<{ providerId: ProviderId; voiceId: string }[]>;
  };
  tts: {
    previewVoice: (request: VoicePreviewRequest) => Promise<TTSGeneration>;
    generateProjectAudio: (request: ProjectAudioGenerateRequest) => Promise<TTSGeneration>;
    getGeneration: (id: string) => Promise<TTSGeneration | null>;
    listGenerations: (projectId?: string) => Promise<TTSGeneration[]>;
    deleteGeneration: (id: string) => Promise<boolean>;
    openAudioFolder: (generationId: string) => Promise<boolean>;
  };
  segments: {
    build: (projectId: string, profile?: Partial<SegmentationProfile>) => Promise<BuildSegmentsResult>;
    list: (projectId: string) => Promise<ProjectSegment[]>;
    get: (id: string) => Promise<ProjectSegment | null>;
    updateOverride: (id: string, overrideText: string) => Promise<ProjectSegment>;
    resetOverride: (id: string) => Promise<ProjectSegment>;
    updateVoice: (
      id: string,
      providerId: ProviderId,
      voiceId: string,
      settings?: VoiceSettings
    ) => Promise<ProjectSegment>;
  };
  queue: {
    start: (projectId: string, segmentIds?: string[]) => Promise<TTSJob[]>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    cancel: (projectId: string) => Promise<number>;
    getStatus: (projectId?: string) => Promise<QueueStatus>;
    regenerateSegment: (projectId: string, segmentId: string) => Promise<TTSJob>;
    onEvent: (callback: (event: QueueEvent) => void) => () => void;
  };
  compositions: {
    compose: (
      projectId: string,
      settings?: Partial<AudioCompositionSettings>
    ) => Promise<{ composition: AudioComposition; isCacheHit: boolean }>;
    getLatest: (projectId: string) => Promise<AudioComposition | null>;
  };
  subtitles: {
    buildCues: (
      projectId: string,
      sentencePauseMs?: number,
      paragraphPauseMs?: number,
      settings?: Partial<SubtitleSettings>
    ) => Promise<SubtitleCue[]>;
    export: (
      projectId: string,
      format: SubtitleExportFormat,
      sentencePauseMs?: number,
      paragraphPauseMs?: number,
      settings?: Partial<SubtitleSettings>
    ) => Promise<SubtitleExportResult>;
  };
  export: {
    exportBundle: (
      projectId: string,
      targetDirectory: string,
      options?: Partial<ProjectExportOptions>
    ) => Promise<ProjectExportResult>;
    selectExportDirectory: () => Promise<string | null>;
  };
  ffmpeg: {
    getStatus: () => Promise<{ available: boolean; version?: string; ffmpegPath?: string; error?: string }>;
  };
}

declare global {
  interface Window {
    localTTS: LocalTTSApi;
  }
}
