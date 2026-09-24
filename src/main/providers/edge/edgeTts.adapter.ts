import type { ITTSProvider, ProviderSynthesisRequest, ProviderSynthesisResult } from '../provider.types';
import type { ProviderId, ProviderCapabilities, VoiceDefinition } from '@shared/types/provider.types';
import { PROVIDER_CAPABILITIES } from '@shared/types/provider.types';
import { edgeTtsClient } from './edgeTtsClient';
import { TTSContentLengthError } from '../provider.errors';
import { logger } from '../../services/logger/logger';

export class EdgeTtsAdapter implements ITTSProvider {
  public readonly id: ProviderId = 'edge-tts';
  public readonly name = 'Edge TTS';
  public readonly capabilities: ProviderCapabilities = PROVIDER_CAPABILITIES['edge-tts'];

  public isConfigured(): boolean {
    // Edge TTS does not require an API key
    return true;
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const voices = await edgeTtsClient.fetchVoices();
      if (voices.length > 0) {
        return {
          success: true,
          message: `Connected to Edge TTS successfully. Discovered ${voices.length} voices.`
        };
      }
      return {
        success: true,
        message: 'Connected to Edge TTS.'
      };
    } catch (err) {
      logger.error('edge-tts', 'Test connection failed', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to connect to Microsoft Edge speech service.'
      };
    }
  }

  public async getVoices(): Promise<VoiceDefinition[]> {
    return await edgeTtsClient.fetchVoices();
  }

  public async synthesize(request: ProviderSynthesisRequest): Promise<ProviderSynthesisResult> {
    if (request.text.length > this.capabilities.maxTextLength) {
      throw new TTSContentLengthError(this.id, request.text.length, this.capabilities.maxTextLength);
    }

    const result = await edgeTtsClient.synthesize({
      text: request.text,
      voice: request.voiceId,
      speed: request.speed ?? request.settings?.speed ?? 1.0,
      pitch: request.pitch ?? request.settings?.pitch ?? 0,
      volume: request.volume ?? request.settings?.volume ?? 100
    });

    return {
      audioBuffer: result.audioBuffer,
      format: result.format,
      mimeType: result.mimeType,
      timings: result.boundaries.length > 0 ? result.boundaries : undefined
    };
  }
}

export const edgeTtsAdapter = new EdgeTtsAdapter();
