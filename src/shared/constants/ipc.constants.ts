export const IPC_CHANNELS = {
  // App & System Channels (Phase 1)
  APP_GET_INFO: 'app:get-info',
  APP_GET_PATHS: 'app:get-paths',
  APP_OPEN_WORKSPACE: 'app:open-workspace',
  SYSTEM_GET_INFO: 'system:get-info',

  // Project Channels (Phase 2)
  PROJECT_CREATE: 'project:create',
  PROJECT_GET: 'project:get',
  PROJECT_LIST: 'project:list',
  PROJECT_UPDATE: 'project:update',
  PROJECT_RENAME: 'project:rename',
  PROJECT_DUPLICATE: 'project:duplicate',
  PROJECT_DELETE: 'project:delete',
  PROJECT_RESTORE: 'project:restore',
  PROJECT_SAVE_TEXT: 'project:save-text',
  PROJECT_SAVE_DRAFT: 'project:save-draft',
  PROJECT_OPEN_FOLDER: 'project:open-folder',
  PROJECT_CHECK_RECOVERY: 'project:check-recovery',
  PROJECT_RECOVER_DRAFT: 'project:recover-draft',
  PROJECT_DISCARD_DRAFT: 'project:discard-draft',

  // Dictionary Channels (Phase 3)
  DICTIONARY_CREATE: 'dictionary:create',
  DICTIONARY_GET: 'dictionary:get',
  DICTIONARY_LIST: 'dictionary:list',
  DICTIONARY_UPDATE: 'dictionary:update',
  DICTIONARY_DELETE: 'dictionary:delete',
  DICTIONARY_DELETE_MANY: 'dictionary:delete-many',
  DICTIONARY_SET_ENABLED: 'dictionary:set-enabled',
  DICTIONARY_SET_ENABLED_MANY: 'dictionary:set-enabled-many',
  DICTIONARY_GET_CATEGORIES: 'dictionary:get-categories',
  DICTIONARY_GET_REVISION: 'dictionary:get-revision',
  DICTIONARY_TEST_RULE: 'dictionary:test-rule',
  DICTIONARY_IMPORT_PREVIEW: 'dictionary:import-preview',
  DICTIONARY_IMPORT_EXECUTE: 'dictionary:import-execute',
  DICTIONARY_SELECT_IMPORT_FILE: 'dictionary:select-import-file',
  DICTIONARY_EXPORT_FILE: 'dictionary:export-file',

  // Text Processing Channels (Phase 3)
  TEXT_PROCESS_PREVIEW: 'text:process-preview',
  TEXT_PROCESS_PROJECT: 'text:process-project',

  // TTS Providers & Voices Channels (Phase 4)
  PROVIDER_GET_ALL: 'provider:get-all',
  PROVIDER_UPDATE_SETTINGS: 'provider:update-settings',
  PROVIDER_SET_SECRET: 'provider:set-secret',
  PROVIDER_DELETE_SECRET: 'provider:delete-secret',
  PROVIDER_TEST_CONNECTION: 'provider:test-connection',

  // Voice Library Channels (Phase 4)
  VOICE_LIST: 'voice:list',
  VOICE_REFRESH: 'voice:refresh',
  VOICE_TOGGLE_FAVORITE: 'voice:toggle-favorite',
  VOICE_GET_FAVORITES: 'voice:get-favorites',

  // Audio Synthesis & Playback Channels (Phase 4)
  TTS_PREVIEW_VOICE: 'tts:preview-voice',
  TTS_GENERATE_PROJECT_AUDIO: 'tts:generate-project-audio',
  TTS_GET_GENERATION: 'tts:get-generation',
  TTS_LIST_GENERATIONS: 'tts:list-generations',
  TTS_DELETE_GENERATION: 'tts:delete-generation',
  TTS_OPEN_AUDIO_FOLDER: 'tts:open-audio-folder',

  // Segment Channels (Phase 5)
  SEGMENT_BUILD: 'segment:build',
  SEGMENT_LIST: 'segment:list',
  SEGMENT_GET: 'segment:get',
  SEGMENT_UPDATE_OVERRIDE: 'segment:update-override',
  SEGMENT_RESET_OVERRIDE: 'segment:reset-override',
  SEGMENT_UPDATE_VOICE: 'segment:update-voice',

  // Queue Channels (Phase 5)
  QUEUE_START: 'queue:start',
  QUEUE_PAUSE: 'queue:pause',
  QUEUE_RESUME: 'queue:resume',
  QUEUE_CANCEL: 'queue:cancel',
  QUEUE_GET_STATUS: 'queue:get-status',
  QUEUE_REGENERATE_SEGMENT: 'queue:regenerate-segment',
  QUEUE_EVENT: 'queue:event',

  // Audio Composition Channels (Phase 5)
  COMPOSITION_COMPOSE: 'composition:compose',
  COMPOSITION_GET_LATEST: 'composition:get-latest',

  // Subtitle Channels (Phase 5)
  SUBTITLE_BUILD_CUES: 'subtitle:build-cues',
  SUBTITLE_EXPORT: 'subtitle:export',

  // Export Channels (Phase 5)
  PROJECT_EXPORT_BUNDLE: 'project:export-bundle',
  PROJECT_SELECT_EXPORT_DIR: 'project:select-export-dir',

  // FFmpeg Channels (Phase 5)
  FFMPEG_GET_STATUS: 'ffmpeg:get-status'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
