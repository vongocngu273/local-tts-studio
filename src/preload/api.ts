import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import type { LocalTTSApi } from '@shared/types/ipc.types';
import type { AppInfo, AppPaths } from '@shared/schemas/app.schema';
import type { SystemInfo, FFmpegStatus } from '@shared/schemas/system.schema';
import type {
  Project,
  ProjectDraft,
  CreateProjectInput,
  UpdateProjectInput,
  SaveProjectTextInput,
  SaveProjectDraftInput,
  ProjectListOptionsInput
} from '@shared/types/project.types';
import type {
  PronunciationRule,
  CreatePronunciationRuleInput,
  UpdatePronunciationRuleInput,
  DictionaryListOptionsInput,
  DictionaryImportInput,
  DictionaryImportPreviewResult,
  DictionaryExportInput
} from '@shared/types/dictionary.types';
import type {
  TextProcessingRequest,
  TextProcessingResult,
  TextProcessingSettings
} from '@shared/types/textProcessing.types';
import type { QueueEvent } from '@shared/types/queue.types';

export const localTTSApi: LocalTTSApi = {
  app: {
    getInfo: (): Promise<AppInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO);
    },
    getPaths: (): Promise<AppPaths> => {
      return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATHS);
    },
    openWorkspace: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_WORKSPACE);
    }
  },
  system: {
    getInfo: (): Promise<SystemInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO);
    },
    getFFmpegStatus: (): Promise<FFmpegStatus> => {
      return ipcRenderer.invoke('system:get-ffmpeg-status');
    }
  },
  projects: {
    create: (input?: CreateProjectInput): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, input);
    },
    get: (id: string): Promise<Project | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, id);
    },
    list: (options?: ProjectListOptionsInput): Promise<Project[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST, options);
    },
    update: (id: string, changes: UpdateProjectInput): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, { id, changes });
    },
    rename: (id: string, name: string): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RENAME, { projectId: id, name });
    },
    duplicate: (id: string): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DUPLICATE, id);
    },
    remove: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id);
    },
    restore: (id: string): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RESTORE, id);
    },
    saveText: (input: SaveProjectTextInput): Promise<Project> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SAVE_TEXT, input);
    },
    saveDraft: (input: SaveProjectDraftInput): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SAVE_DRAFT, input);
    },
    openFolder: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_OPEN_FOLDER, id);
    },
    recovery: {
      check: (id: string): Promise<ProjectDraft | null> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CHECK_RECOVERY, id);
      },
      recover: (id: string): Promise<Project> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RECOVER_DRAFT, id);
      },
      discard: (id: string): Promise<boolean> => {
        return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DISCARD_DRAFT, id);
      }
    }
  },
  dictionary: {
    create: (input: CreatePronunciationRuleInput): Promise<PronunciationRule> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_CREATE, input);
    },
    get: (id: string): Promise<PronunciationRule | null> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_GET, id);
    },
    list: (options?: DictionaryListOptionsInput): Promise<PronunciationRule[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_LIST, options);
    },
    update: (id: string, changes: UpdatePronunciationRuleInput): Promise<PronunciationRule> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_UPDATE, { id, changes });
    },
    remove: (id: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_DELETE, id);
    },
    removeMany: (ids: string[]): Promise<number> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_DELETE_MANY, ids);
    },
    setEnabled: (id: string, enabled: boolean): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_SET_ENABLED, { id, enabled });
    },
    setEnabledMany: (ids: string[], enabled: boolean): Promise<number> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_SET_ENABLED_MANY, { ids, enabled });
    },
    getCategories: (): Promise<string[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_GET_CATEGORIES);
    },
    getRevision: (): Promise<number> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_GET_REVISION);
    },
    testRule: (input: {
      rule: CreatePronunciationRuleInput;
      sampleText: string;
    }): Promise<{ original: string; processed: string; matched: boolean }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_TEST_RULE, input);
    },
    import: {
      selectFile: (): Promise<{ content: string; format: 'json' | 'csv'; filePath: string } | null> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_SELECT_IMPORT_FILE);
      },
      preview: (input: DictionaryImportInput): Promise<DictionaryImportPreviewResult> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_IMPORT_PREVIEW, input);
      },
      execute: (input: DictionaryImportInput): Promise<{ inserted: number; updated: number; skipped: number }> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_IMPORT_EXECUTE, input);
      }
    },
    export: {
      toFile: (input: DictionaryExportInput): Promise<boolean> => {
        return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_EXPORT_FILE, input);
      }
    }
  },
  textProcessing: {
    preview: (input: TextProcessingRequest): Promise<TextProcessingResult> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEXT_PROCESS_PREVIEW, input);
    },
    processProject: (
      projectId: string,
      settings?: Partial<TextProcessingSettings>
    ): Promise<TextProcessingResult> => {
      return ipcRenderer.invoke(IPC_CHANNELS.TEXT_PROCESS_PROJECT, { projectId, settings });
    }
  },
  providers: {
    getAll: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_ALL);
    },
    updateSettings: (input) => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_UPDATE_SETTINGS, input);
    },
    setSecret: (input) => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_SET_SECRET, input);
    },
    deleteSecret: (providerId, secretName) => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_DELETE_SECRET, providerId, secretName);
    },
    testConnection: (providerId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_TEST_CONNECTION, providerId);
    }
  },
  voices: {
    list: (filter) => {
      return ipcRenderer.invoke(IPC_CHANNELS.VOICE_LIST, filter);
    },
    refresh: (providerId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.VOICE_REFRESH, providerId);
    },
    toggleFavorite: (providerId, voiceId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.VOICE_TOGGLE_FAVORITE, providerId, voiceId);
    },
    getFavorites: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.VOICE_GET_FAVORITES);
    }
  },
  tts: {
    previewVoice: (request) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TTS_PREVIEW_VOICE, request);
    },
    generateProjectAudio: (request) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TTS_GENERATE_PROJECT_AUDIO, request);
    },
    getGeneration: (id) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TTS_GET_GENERATION, id);
    },
    listGenerations: (projectId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TTS_LIST_GENERATIONS, projectId);
    },
    deleteGeneration: (id) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TTS_DELETE_GENERATION, id);
    },
    openAudioFolder: (generationId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TTS_OPEN_AUDIO_FOLDER, generationId);
    }
  },
  segments: {
    build: (projectId, profile) => {
      return ipcRenderer.invoke(IPC_CHANNELS.SEGMENT_BUILD, projectId, profile);
    },
    list: (projectId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.SEGMENT_LIST, projectId);
    },
    get: (id) => {
      return ipcRenderer.invoke(IPC_CHANNELS.SEGMENT_GET, id);
    },
    updateOverride: (id, overrideText) => {
      return ipcRenderer.invoke(IPC_CHANNELS.SEGMENT_UPDATE_OVERRIDE, id, overrideText);
    },
    resetOverride: (id) => {
      return ipcRenderer.invoke(IPC_CHANNELS.SEGMENT_RESET_OVERRIDE, id);
    },
    updateVoice: (id, providerId, voiceId, settings) => {
      return ipcRenderer.invoke(IPC_CHANNELS.SEGMENT_UPDATE_VOICE, id, providerId, voiceId, settings);
    }
  },
  queue: {
    start: (projectId, segmentIds) => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUEUE_START, projectId, segmentIds);
    },
    pause: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUEUE_PAUSE);
    },
    resume: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUEUE_RESUME);
    },
    cancel: (projectId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUEUE_CANCEL, projectId);
    },
    getStatus: (projectId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUEUE_GET_STATUS, projectId);
    },
    regenerateSegment: (projectId, segmentId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.QUEUE_REGENERATE_SEGMENT, projectId, segmentId);
    },
    onEvent: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: QueueEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.QUEUE_EVENT, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.QUEUE_EVENT, handler);
      };
    }
  },
  compositions: {
    compose: (projectId, settings) => {
      return ipcRenderer.invoke(IPC_CHANNELS.COMPOSITION_COMPOSE, projectId, settings);
    },
    getLatest: (projectId) => {
      return ipcRenderer.invoke(IPC_CHANNELS.COMPOSITION_GET_LATEST, projectId);
    }
  },
  subtitles: {
    buildCues: (projectId, sentencePauseMs, paragraphPauseMs, settings) => {
      return ipcRenderer.invoke(
        IPC_CHANNELS.SUBTITLE_BUILD_CUES,
        projectId,
        sentencePauseMs,
        paragraphPauseMs,
        settings
      );
    },
    export: (projectId, format, sentencePauseMs, paragraphPauseMs, settings) => {
      return ipcRenderer.invoke(
        IPC_CHANNELS.SUBTITLE_EXPORT,
        projectId,
        format,
        sentencePauseMs,
        paragraphPauseMs,
        settings
      );
    }
  },
  export: {
    exportBundle: (projectId, targetDirectory, options) => {
      return ipcRenderer.invoke(
        IPC_CHANNELS.PROJECT_EXPORT_BUNDLE,
        projectId,
        targetDirectory,
        options
      );
    },
    selectExportDirectory: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_EXPORT_DIR);
    }
  },
  ffmpeg: {
    getStatus: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_GET_STATUS);
    }
  }
};
