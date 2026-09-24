import type { ProviderScope } from './dictionary.types';

export type ProviderId = 'edge-tts' | 'lucylab' | 'elevenlabs' | 'vbee';

export type VoiceGender = 'male' | 'female' | 'neutral';

export interface ProviderCapabilities {
  supportsPitch: boolean;
  supportsRate: boolean;
  supportsVolume: boolean;
  supportsTimings: boolean;
  supportsSrt: boolean;
  supportsCustomModels: boolean;
  minRate: number;
  maxRate: number;
  minPitch: number;
  maxPitch: number;
  requiresApiKey: boolean;
  maxTextLength: number;
}

export interface VoiceDefinition {
  id: string;
  providerId: ProviderId;
  name: string;
  locale: string;
  language: string;
  gender: VoiceGender;
  description?: string;
  sampleRate?: number;
  isFavorite?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TTSProviderDefinition {
  id: ProviderId;
  name: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  isCloud: boolean;
}

export interface ProviderPublicInfo extends TTSProviderDefinition {
  hasApiKey: boolean;
  defaultVoiceId?: string | null;
  defaultModelId?: string | null;
  capabilities: ProviderCapabilities;
  voicesCount: number;
}

export interface VoiceSettings {
  speed?: number; // 0.5 - 2.0 (default 1.0)
  pitch?: number; // -50 to +50 Hz or % (default 0)
  volume?: number; // 0 - 100% (default 100)
  modelId?: string;
  // ElevenLabs specific
  stability?: number; // 0.0 - 1.0
  similarityBoost?: number; // 0.0 - 1.0
  style?: number; // 0.0 - 1.0
  useSpeakerBoost?: boolean;
  // Generic custom options
  extra?: Record<string, unknown>;
}

export type GenerationPurpose = 'preview' | 'project';
export type GenerationStatus = 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TTSGeneration {
  id: string;
  projectId?: string | null;
  purpose: GenerationPurpose;
  providerId: ProviderId;
  voiceId: string;
  modelId?: string | null;
  inputHash: string;
  dictionaryRevision: number;
  processorVersion: number;
  characterCount: number;
  status: GenerationStatus;
  outputPath?: string | null;
  outputFormat: string;
  mimeType: string;
  sizeBytes?: number | null;
  providerRequestId?: string | null;
  providerJobId?: string | null;
  settings: VoiceSettings;
  timingPath?: string | null;
  providerSubtitlePath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  playbackUrl?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface VoiceFilterOptions {
  providerId?: ProviderId | 'ALL';
  locale?: string;
  gender?: VoiceGender | 'ALL';
  search?: string;
  favoritesOnly?: boolean;
}

export interface VoicePreviewRequest {
  providerId: ProviderId;
  voiceId: string;
  text?: string;
  settings?: VoiceSettings;
}

export interface SetProviderSecretInput {
  providerId: ProviderId;
  secretName: string;
  secretValue: string;
}

export interface UpdateProviderSettingsInput {
  providerId: ProviderId;
  enabled?: boolean;
  defaultVoiceId?: string | null;
  defaultModelId?: string | null;
  config?: Record<string, unknown>;
}

export interface ProjectAudioGenerateRequest {
  projectId: string;
  providerId?: ProviderId;
  voiceId?: string;
  settings?: VoiceSettings;
}

export const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  'edge-tts': {
    supportsPitch: true,
    supportsRate: true,
    supportsVolume: true,
    supportsTimings: true,
    supportsSrt: false,
    supportsCustomModels: false,
    minRate: 0.5,
    maxRate: 2.0,
    minPitch: -50,
    maxPitch: 50,
    requiresApiKey: false,
    maxTextLength: 100000
  },
  'lucylab': {
    supportsPitch: false,
    supportsRate: true,
    supportsVolume: false,
    supportsTimings: true,
    supportsSrt: true,
    supportsCustomModels: false,
    minRate: 0.5,
    maxRate: 2.0,
    minPitch: 0,
    maxPitch: 0,
    requiresApiKey: true,
    maxTextLength: 50000
  },
  'elevenlabs': {
    supportsPitch: false,
    supportsRate: false,
    supportsVolume: false,
    supportsTimings: true,
    supportsSrt: false,
    supportsCustomModels: true,
    minRate: 1.0,
    maxRate: 1.0,
    minPitch: 0,
    maxPitch: 0,
    requiresApiKey: true,
    maxTextLength: 10000
  },
  'vbee': {
    supportsPitch: false,
    supportsRate: true,
    supportsVolume: false,
    supportsTimings: false,
    supportsSrt: false,
    supportsCustomModels: false,
    minRate: 0.7,
    maxRate: 1.5,
    minPitch: 0,
    maxPitch: 0,
    requiresApiKey: true,
    maxTextLength: 20000
  }
};

export const DEFAULT_PROVIDERS: TTSProviderDefinition[] = [
  {
    id: 'edge-tts',
    name: 'Edge TTS',
    description: 'Microsoft Edge online neural text-to-speech service',
    enabled: true,
    configured: true, // Edge TTS requires no API key
    isCloud: true
  },
  {
    id: 'lucylab',
    name: 'LucyLab',
    description: 'High-quality Vietnamese and multilingual speech synthesis',
    enabled: true,
    configured: false,
    isCloud: true
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Premium AI generative voice cloning and TTS platform',
    enabled: true,
    configured: false,
    isCloud: true
  },
  {
    id: 'vbee',
    name: 'Vbee',
    description: 'Vietnamese conversational speech platform',
    enabled: true,
    configured: false,
    isCloud: true
  }
];

export function providerIdToScope(id: ProviderId): ProviderScope {
  switch (id) {
    case 'edge-tts':
      return 'EDGE';
    case 'lucylab':
      return 'LUCYLAB';
    case 'elevenlabs':
      return 'ELEVENLABS';
    case 'vbee':
      return 'VBEE';
    default:
      return 'ALL';
  }
}

export function scopeToProviderId(scope: ProviderScope): ProviderId | null {
  switch (scope) {
    case 'EDGE':
      return 'edge-tts';
    case 'LUCYLAB':
      return 'lucylab';
    case 'ELEVENLABS':
      return 'elevenlabs';
    case 'VBEE':
      return 'vbee';
    default:
      return null;
  }
}
