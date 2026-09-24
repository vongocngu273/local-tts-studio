import type {
  ProviderId,
  ProviderCapabilities,
  VoiceDefinition,
  VoiceSettings
} from '@shared/types/provider.types';

export interface ProviderSynthesisRequest {
  text: string;
  voiceId: string;
  modelId?: string | null;
  speed?: number;
  pitch?: number;
  volume?: number;
  settings?: VoiceSettings;
}

export interface ProviderSynthesisResult {
  audioBuffer: Buffer;
  format: string; // 'mp3'
  mimeType: string; // 'audio/mpeg'
  timings?: unknown;
  subtitles?: string; // SRT format
  requestId?: string;
  jobId?: string;
}

export interface ITTSProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  isConfigured(): boolean;
  testConnection(): Promise<{ success: boolean; message: string }>;
  getVoices(): Promise<VoiceDefinition[]>;
  synthesize(request: ProviderSynthesisRequest): Promise<ProviderSynthesisResult>;
}
