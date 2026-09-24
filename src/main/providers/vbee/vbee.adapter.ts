import type { ITTSProvider, ProviderSynthesisRequest, ProviderSynthesisResult } from '../provider.types';
import type { ProviderId, ProviderCapabilities, VoiceDefinition } from '@shared/types/provider.types';
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

const VBEE_DEFAULT_ENDPOINT = 'https://api.vbee.ai/v1';

export class VbeeAdapter implements ITTSProvider {
  public readonly id: ProviderId = 'vbee';
  public readonly name = 'Vbee';
  public readonly capabilities: ProviderCapabilities = PROVIDER_CAPABILITIES['vbee'];

  public isConfigured(): boolean {
    return secretStorageService.hasSecret(this.id);
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    const token = secretStorageService.getSecret(this.id);
    if (!token) {
      return { success: false, message: 'Vbee API token is not configured.' };
    }

    try {
      const res = await fetch(`${VBEE_DEFAULT_ENDPOINT}/voices`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed. Please verify your Vbee API token.' };
      }

      if (res.ok) {
        return { success: true, message: 'Connected to Vbee Vietnamese speech platform successfully.' };
      }

      return { success: false, message: `Vbee returned HTTP ${res.status}` };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unable to reach Vbee API servers.'
      };
    }
  }

  public async getVoices(): Promise<VoiceDefinition[]> {
    const token = secretStorageService.getSecret(this.id);
    if (token) {
      try {
        const res = await fetch(`${VBEE_DEFAULT_ENDPOINT}/voices`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = (await res.json()) as {
            voices?: Array<{
              voice_code: string;
              name: string;
              gender?: string;
              region?: string;
              sample_url?: string;
            }>;
          };

          if (Array.isArray(data.voices) && data.voices.length > 0) {
            return data.voices.map((v) => ({
              id: v.voice_code,
              providerId: this.id,
              name: `${v.name} (${v.region || 'VN'})`,
              locale: 'vi-VN',
              language: 'VI',
              gender: v.gender === 'female' ? 'female' : v.gender === 'male' ? 'male' : 'neutral',
              description: `Vbee ${v.name} (${v.region})`
            }));
          }
        }
      } catch (err) {
        logger.warn('vbee', 'Failed to fetch live voices from Vbee API, using fallback', err);
      }
    }

    return getVbeeFallbackVoices();
  }

  public async synthesize(request: ProviderSynthesisRequest): Promise<ProviderSynthesisResult> {
    const token = secretStorageService.getSecret(this.id);
    if (!token) {
      throw new TTSAuthenticationError(this.id, 'Vbee API token is not configured.');
    }

    if (request.text.length > this.capabilities.maxTextLength) {
      throw new TTSContentLengthError(this.id, request.text.length, this.capabilities.maxTextLength);
    }

    const payload = {
      input_text: request.text,
      voice_code: request.voiceId,
      rate: request.speed ?? request.settings?.speed ?? 1.0,
      audio_type: 'mp3'
    };

    try {
      const res = await fetch(`${VBEE_DEFAULT_ENDPOINT}/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) {
        throw new TTSAuthenticationError(this.id);
      }
      if (res.status === 429) {
        throw new TTSRateLimitError(this.id);
      }

      // Check if direct binary audio returned
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && (contentType.includes('audio/') || contentType.includes('application/octet-stream'))) {
        const audioBuffer = Buffer.from(await res.arrayBuffer());
        return {
          audioBuffer,
          format: 'mp3',
          mimeType: 'audio/mpeg'
        };
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new TTSProviderError(this.id, 'SYNTHESIS_FAILED', `Vbee API returned HTTP ${res.status}: ${errText}`, {
          statusCode: res.status
        });
      }

      const json = (await res.json()) as {
        audio_url?: string;
        audio_link?: string;
        result?: { audio_link?: string };
        status?: number | string;
        error_message?: string;
        callback_required?: boolean;
      };

      const audioUrl = json.audio_url || json.audio_link || json.result?.audio_link;

      if (audioUrl) {
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) {
          throw new TTSNetworkError(this.id, `Failed to download audio from Vbee URL: HTTP ${audioRes.status}`);
        }
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        return {
          audioBuffer,
          format: 'mp3',
          mimeType: 'audio/mpeg'
        };
      }

      // Handle documented Vbee callback limitation if returned
      if (json.callback_required || (!audioUrl && json.status === 'processing')) {
        throw new TTSProviderError(
          this.id,
          'CALLBACK_UNSUPPORTED',
          'Vbee requires an external webhook callback URL for this voice/tier, which is not supported in direct local-first desktop mode without a public webhook receiver.'
        );
      }

      throw new TTSProviderError(this.id, 'UNKNOWN_RESPONSE', json.error_message || 'Unrecognized response format from Vbee');
    } catch (err) {
      if (err instanceof TTSProviderError) throw err;
      throw new TTSNetworkError(this.id, 'Failed to communicate with Vbee TTS service', err);
    }
  }
}

export function getVbeeFallbackVoices(): VoiceDefinition[] {
  return [
    {
      id: 'sg_female_lan_vd_48k',
      providerId: 'vbee',
      name: 'Lan (Nữ miền Nam)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'female',
      description: 'Giọng đọc nữ miền Nam tự nhiên, trong trẻo'
    },
    {
      id: 'hn_male_manhdung_news_48k',
      providerId: 'vbee',
      name: 'Mạnh Dũng (Nam miền Bắc)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'male',
      description: 'Giọng nam miền Bắc chuẩn phát thanh truyền hình'
    },
    {
      id: 'hn_female_thutrang_phrase_48k',
      providerId: 'vbee',
      name: 'Thu Trang (Nữ miền Bắc)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'female',
      description: 'Giọng đọc nữ miền Bắc truyền cảm, diễn cảm tốt'
    },
    {
      id: 'hue_female_huonggiang_48k',
      providerId: 'vbee',
      name: 'Hương Giang (Nữ miền Trung)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'female',
      description: 'Giọng nữ xứ Huế dịu dàng, sâu lắng'
    }
  ];
}

export const vbeeAdapter = new VbeeAdapter();
