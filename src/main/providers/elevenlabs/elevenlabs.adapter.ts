import type { ITTSProvider, ProviderSynthesisRequest, ProviderSynthesisResult } from '../provider.types';
import type { ProviderId, ProviderCapabilities, VoiceDefinition, VoiceGender } from '@shared/types/provider.types';
import { PROVIDER_CAPABILITIES } from '@shared/types/provider.types';
import { secretStorageService } from '../../services/security/secretStorage.service';
import {
  TTSAuthenticationError,
  TTSContentLengthError,
  TTSRateLimitError,
  TTSNetworkError,
  TTSProviderError
} from '../provider.errors';
import { logger } from '../../services/logger/logger';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export class ElevenLabsAdapter implements ITTSProvider {
  public readonly id: ProviderId = 'elevenlabs';
  public readonly name = 'ElevenLabs';
  public readonly capabilities: ProviderCapabilities = PROVIDER_CAPABILITIES['elevenlabs'];

  public isConfigured(): boolean {
    return secretStorageService.hasSecret(this.id);
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    const apiKey = secretStorageService.getSecret(this.id);
    if (!apiKey) {
      return { success: false, message: 'API key is missing. Please enter your ElevenLabs API key.' };
    }

    try {
      const res = await fetch(`${ELEVENLABS_BASE_URL}/user`, {
        headers: { 'xi-api-key': apiKey }
      });

      if (res.status === 401) {
        return { success: false, message: 'Authentication failed. Invalid ElevenLabs API key.' };
      }

      if (!res.ok) {
        return { success: false, message: `ElevenLabs API error: HTTP ${res.status}` };
      }

      const user = (await res.json()) as { subscription?: { character_count?: number; character_limit?: number } };
      const charsUsed = user.subscription?.character_count ?? 0;
      const charsLimit = user.subscription?.character_limit ?? 0;

      return {
        success: true,
        message: `Connected to ElevenLabs! Quota: ${charsUsed.toLocaleString()} / ${charsLimit.toLocaleString()} characters.`
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to connect to ElevenLabs API.'
      };
    }
  }

  public async getVoices(): Promise<VoiceDefinition[]> {
    const apiKey = secretStorageService.getSecret(this.id);
    if (apiKey) {
      try {
        const res = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
          headers: { 'xi-api-key': apiKey }
        });

        if (res.ok) {
          const data = (await res.json()) as {
            voices: Array<{
              voice_id: string;
              name: string;
              labels?: Record<string, string>;
              description?: string;
              preview_url?: string;
            }>;
          };

          if (Array.isArray(data.voices)) {
            return data.voices.map((v) => {
              const genderRaw = v.labels?.gender?.toLowerCase() || '';
              const gender: VoiceGender =
                genderRaw === 'female' ? 'female' : genderRaw === 'male' ? 'male' : 'neutral';
              const accent = v.labels?.accent || v.labels?.['descriptive'] || 'Multilingual';

              return {
                id: v.voice_id,
                providerId: this.id,
                name: `${v.name} (${accent})`,
                locale: 'multilingual',
                language: 'MULTILINGUAL',
                gender,
                description: v.description || `ElevenLabs AI voice: ${v.name}`,
                metadata: {
                  voiceId: v.voice_id,
                  labels: v.labels,
                  previewUrl: v.preview_url
                }
              };
            });
          }
        }
      } catch (err) {
        logger.warn('elevenlabs', 'Failed to fetch voices list from API, using curated fallback', err);
      }
    }

    return getElevenLabsFallbackVoices();
  }

  public async synthesize(request: ProviderSynthesisRequest): Promise<ProviderSynthesisResult> {
    const apiKey = secretStorageService.getSecret(this.id);
    if (!apiKey) {
      throw new TTSAuthenticationError(this.id, 'ElevenLabs API key is not configured.');
    }

    if (request.text.length > this.capabilities.maxTextLength) {
      throw new TTSContentLengthError(this.id, request.text.length, this.capabilities.maxTextLength);
    }

    const voiceId = request.voiceId;
    const modelId = request.modelId || request.settings?.modelId || 'eleven_multilingual_v2';

    const payload = {
      text: request.text,
      model_id: modelId,
      voice_settings: {
        stability: request.settings?.stability ?? 0.5,
        similarity_boost: request.settings?.similarityBoost ?? 0.75,
        style: request.settings?.style ?? 0.0,
        use_speaker_boost: request.settings?.useSpeakerBoost ?? true
      }
    };

    try {
      const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}/with-timestamps`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        throw new TTSAuthenticationError(this.id, 'Invalid ElevenLabs API key');
      }
      if (res.status === 429) {
        throw new TTSRateLimitError(this.id, 'ElevenLabs quota or rate limit exceeded');
      }
      if (!res.ok) {
        const errorText = await res.text();
        throw new TTSProviderError(this.id, 'SYNTHESIS_FAILED', `ElevenLabs returned HTTP ${res.status}: ${errorText}`, {
          statusCode: res.status
        });
      }

      const json = (await res.json()) as {
        audio_base64: string;
        alignment?: {
          characters: string[];
          character_start_times_seconds: number[];
          character_end_times_seconds: number[];
        };
      };

      if (!json.audio_base64) {
        throw new TTSProviderError(this.id, 'EMPTY_AUDIO', 'ElevenLabs did not return audio data');
      }

      const audioBuffer = Buffer.from(json.audio_base64, 'base64');
      const requestId = res.headers.get('request-id') || undefined;

      return {
        audioBuffer,
        format: 'mp3',
        mimeType: 'audio/mpeg',
        timings: json.alignment,
        requestId
      };
    } catch (err) {
      if (err instanceof TTSProviderError) throw err;
      throw new TTSNetworkError(this.id, 'Network error while calling ElevenLabs API', err);
    }
  }
}

export function getElevenLabsFallbackVoices(): VoiceDefinition[] {
  return [
    {
      id: '21m00Tcm4TlvDq8ikWAM',
      providerId: 'elevenlabs',
      name: 'Rachel (Calm, Multilingual)',
      locale: 'multilingual',
      language: 'MULTILINGUAL',
      gender: 'female',
      description: 'ElevenLabs standard calm female voice with multilingual support'
    },
    {
      id: 'AZnzlk1XvdvUeBnXmlld',
      providerId: 'elevenlabs',
      name: 'Domi (Empathetic, Multilingual)',
      locale: 'multilingual',
      language: 'MULTILINGUAL',
      gender: 'female',
      description: 'Strong, engaged female voice'
    },
    {
      id: 'EXAVITQu4vr4xnSDxMaL',
      providerId: 'elevenlabs',
      name: 'Bella (Soft, Multilingual)',
      locale: 'multilingual',
      language: 'MULTILINGUAL',
      gender: 'female',
      description: 'Soft and pleasant young female voice'
    },
    {
      id: 'ErXwobaYiN019PkySvjV',
      providerId: 'elevenlabs',
      name: 'Antoni (Well-rounded, Multilingual)',
      locale: 'multilingual',
      language: 'MULTILINGUAL',
      gender: 'male',
      description: 'Warm and natural male narration voice'
    },
    {
      id: 'VR6AewLTigWG4xSOukaG',
      providerId: 'elevenlabs',
      name: 'Arnold (Crisp, Multilingual)',
      locale: 'multilingual',
      language: 'MULTILINGUAL',
      gender: 'male',
      description: 'Deep and clear male voice'
    }
  ];
}

export const elevenlabsAdapter = new ElevenLabsAdapter();
