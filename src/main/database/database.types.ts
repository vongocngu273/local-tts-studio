export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  original_text: string;
  processed_text: string;
  provider_id: string | null;
  voice_id: string | null;
  settings_json: string;
  project_path: string;
  revision: number;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  deleted_at: string | null;
}

export interface ProjectDraftRow {
  project_id: string;
  original_text: string;
  processed_text: string;
  revision: number;
  updated_at: string;
}

export interface AppMetadataRow {
  key: string;
  value: string;
  updated_at: string;
}

export interface SchemaMigrationRow {
  id: number;
  version: number;
  name: string;
  applied_at: string;
}

export interface PronunciationDictionaryRow {
  id: string;
  term: string;
  spoken_text: string;
  enabled: number; // 0 or 1 in SQLite
  case_sensitive: number; // 0 or 1 in SQLite
  whole_word: number; // 0 or 1 in SQLite
  provider_scope: string;
  category: string | null;
  priority: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSettingsRow {
  provider_id: string;
  enabled: number; // 0 or 1
  default_voice_id: string | null;
  default_model_id: string | null;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderSecretRow {
  provider_id: string;
  secret_name: string;
  encrypted_value: string; // Base64 encoded encrypted Buffer
  encryption_version: number;
  updated_at: string;
}

export interface TtsVoiceCacheRow {
  provider_id: string;
  voice_id: string;
  name: string;
  locale: string;
  language: string;
  gender: string;
  description: string | null;
  metadata_json: string;
  cached_at: string;
}

export interface TtsGenerationRow {
  id: string;
  project_id: string | null;
  purpose: string; // 'preview' | 'project'
  provider_id: string;
  voice_id: string;
  model_id: string | null;
  input_hash: string;
  dictionary_revision: number;
  processor_version: number;
  character_count: number;
  status: string; // 'processing' | 'completed' | 'failed' | 'cancelled'
  output_path: string | null;
  output_format: string;
  mime_type: string;
  size_bytes: number | null;
  provider_request_id: string | null;
  provider_job_id: string | null;
  settings_json: string;
  timing_path: string | null;
  provider_subtitle_path: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface VoiceFavoriteRow {
  provider_id: string;
  voice_id: string;
  created_at: string;
}

export interface ProjectSegmentRow {
  id: string;
  project_id: string;
  segment_index: number;
  text: string;
  text_hash: string;
  base_text: string;
  override_text: string | null;
  has_override: number; // 0 or 1
  source_start: number;
  source_end: number;
  paragraph_index: number;
  status: string;
  provider_id: string | null;
  voice_id: string | null;
  model_id: string | null;
  settings_json: string;
  generation_id: string | null;
  audio_path: string | null;
  timing_path: string | null;
  duration_ms: number | null;
  character_count: number;
  pause_after_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TtsJobRow {
  id: string;
  project_id: string;
  segment_id: string | null;
  job_type: string;
  provider_id: string;
  status: string;
  priority: number;
  attempt: number;
  max_attempts: number;
  provider_job_id: string | null;
  payload_json: string;
  result_json: string | null;
  available_at: string;
  started_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioCompositionRow {
  id: string;
  project_id: string;
  source_fingerprint: string;
  segment_count: number;
  output_mp3_path: string | null;
  output_wav_path: string | null;
  duration_ms: number | null;
  size_bytes: number | null;
  settings_json: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface SubtitleExportRow {
  id: string;
  project_id: string;
  composition_id: string | null;
  format: string;
  source_type: string;
  output_path: string;
  cue_count: number;
  settings_json: string;
  created_at: string;
}

