import type { ITTSProvider, ProviderSynthesisRequest, ProviderSynthesisResult } from '../provider.types';
import type { ProviderId, ProviderCapabilities, VoiceDefinition } from '@shared/types/provider.types';
import { PROVIDER_CAPABILITIES } from '@shared/types/provider.types';
import { secretStorageService } from '../../services/security/secretStorage.service';
import {
  TTSAuthenticationError,
  TTSContentLengthError,
  TTSRateLimitError,
  TTSNetworkError,
  TTSProviderError,
  TTSTimeoutError
} from '../provider.errors';
import { logger } from '../../services/logger/logger';

const LUCYLAB_DEFAULT_ENDPOINT = 'https://api.lucylab.ai/v1';

export class LucyLabAdapter implements ITTSProvider {
  public readonly id: ProviderId = 'lucylab';
  public readonly name = 'LucyLab';
  public readonly capabilities: ProviderCapabilities = PROVIDER_CAPABILITIES['lucylab'];

  public isConfigured(): boolean {
    return secretStorageService.hasSecret(this.id);
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    const apiKey = secretStorageService.getSecret(this.id);
    if (!apiKey) {
      return { success: false, message: 'LucyLab API key is not configured.' };
    }

    try {
      const res = await fetch(`${LUCYLAB_DEFAULT_ENDPOINT}/voices`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed. Please verify your LucyLab API token.' };
      }

      if (res.ok) {
        return { success: true, message: 'Connected to LucyLab Vietnamese speech API successfully.' };
      }

      return { success: false, message: `LucyLab returned status HTTP ${res.status}` };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unable to connect to LucyLab server.'
      };
    }
  }

  public async getVoices(): Promise<VoiceDefinition[]> {
    const apiKey = secretStorageService.getSecret(this.id);
    if (apiKey) {
      try {
        const res = await fetch(`${LUCYLAB_DEFAULT_ENDPOINT}/voices`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = (await res.json()) as {
            voices?: Array<{
              id: string;
              name: string;
              gender?: string;
              locale?: string;
              description?: string;
            }>;
          };

          if (Array.isArray(data.voices) && data.voices.length > 0) {
            return data.voices.map((v) => ({
              id: v.id,
              providerId: this.id,
              name: v.name,
              locale: v.locale || 'vi-VN',
              language: 'VI',
              gender: v.gender === 'female' ? 'female' : v.gender === 'male' ? 'male' : 'neutral',
              description: v.description || `LucyLab ${v.name}`
            }));
          }
        }
      } catch (err) {
        logger.warn('lucylab', 'Failed to fetch live LucyLab voices, using fallback', err);
      }
    }

    return getLucyLabFallbackVoices();
  }

  public async synthesize(request: ProviderSynthesisRequest): Promise<ProviderSynthesisResult> {
    const apiKey = secretStorageService.getSecret(this.id);
    if (!apiKey) {
      throw new TTSAuthenticationError(this.id, 'LucyLab API token is missing.');
    }

    if (request.text.length > this.capabilities.maxTextLength) {
      throw new TTSContentLengthError(this.id, request.text.length, this.capabilities.maxTextLength);
    }

    const payload = {
      text: request.text,
      voice_id: request.voiceId,
      speed: request.speed ?? request.settings?.speed ?? 1.0,
      format: 'mp3',
      include_subtitles: true
    };

    try {
      // 1. Initiate synthesis job
      const res = await fetch(`${LUCYLAB_DEFAULT_ENDPOINT}/tts/async`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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

      // If synchronous response with direct audio:
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
        throw new TTSProviderError(this.id, 'JOB_INIT_FAILED', `LucyLab API error: ${errText}`, {
          statusCode: res.status
        });
      }

      const initData = (await res.json()) as {
        job_id?: string;
        audio_url?: string;
        srt_url?: string;
      };

      // If immediate audio URL returned
      if (initData.audio_url) {
        const audioRes = await fetch(initData.audio_url);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        let srtContent: string | undefined;
        if (initData.srt_url) {
          try {
            const srtRes = await fetch(initData.srt_url);
            if (srtRes.ok) srtContent = await srtRes.text();
          } catch {
            // ignore
          }
        }
        return {
          audioBuffer,
          format: 'mp3',
          mimeType: 'audio/mpeg',
          subtitles: srtContent,
          jobId: initData.job_id
        };
      }

      // 2. Poll async job status
      const jobId = initData.job_id;
      if (!jobId) {
        throw new TTSProviderError(this.id, 'INVALID_RESPONSE', 'No jobId or audioUrl returned from LucyLab');
      }

      const pollMaxTimeMs = 60000;
      const startTime = Date.now();
      let pollDelayMs = 1500;

      while (Date.now() - startTime < pollMaxTimeMs) {
        await new Promise((r) => setTimeout(r, pollDelayMs));
        pollDelayMs = Math.min(pollDelayMs * 1.25, 4000);

        const statusRes = await fetch(`${LUCYLAB_DEFAULT_ENDPOINT}/tts/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });

        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as {
            status: 'pending' | 'processing' | 'completed' | 'failed';
            audio_url?: string;
            srt_url?: string;
            error?: string;
          };

          if (statusData.status === 'completed' && statusData.audio_url) {
            const audioRes = await fetch(statusData.audio_url);
            const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

            let subtitles: string | undefined;
            if (statusData.srt_url) {
              try {
                const srtRes = await fetch(statusData.srt_url);
                if (srtRes.ok) subtitles = await srtRes.text();
              } catch {
                // ignore
              }
            }

            return {
              audioBuffer,
              format: 'mp3',
              mimeType: 'audio/mpeg',
              subtitles,
              jobId
            };
          }

          if (statusData.status === 'failed') {
            throw new TTSProviderError(this.id, 'SYNTHESIS_FAILED', statusData.error || 'LucyLab synthesis job failed');
          }
        }
      }

      throw new TTSTimeoutError(this.id, pollMaxTimeMs);
    } catch (err) {
      if (err instanceof TTSProviderError) throw err;
      throw new TTSNetworkError(this.id, 'Network communication failed with LucyLab API', err);
    }
  }
}

export function getLucyLabFallbackVoices(): VoiceDefinition[] {
  return [
    {
      id: 'lucy_hn_female_mai',
      providerId: 'lucylab',
      name: 'Mai (Nữ Hà Nội - Truyền cảm)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'female',
      description: 'Giọng nữ Hà Nội trong trẻo, phù hợp đọc truyện và tin tức'
    },
    {
      id: 'lucy_sg_male_thanh',
      providerId: 'lucylab',
      name: 'Thành (Nam Sài Gòn - Trầm ấm)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'male',
      description: 'Giọng nam miền Nam ấm áp, phong cách hội thoại hiện đại'
    },
    {
      id: 'lucy_hn_male_khoi',
      providerId: 'lucylab',
      name: 'Khôi (Nam Hà Nội - Bản tin)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'male',
      description: 'Giọng nam Hà Nội phong thái phát thanh viên truyền hình'
    },
    {
      id: 'lucy_sg_female_phuong',
      providerId: 'lucylab',
      name: 'Phương (Nữ Sài Gòn - Tươi sáng)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'female',
      description: 'Giọng nữ miền Nam trẻ trung, sôi nổi, tự nhiên'
    }
  ];
}

export const lucylabAdapter = new LucyLabAdapter();
