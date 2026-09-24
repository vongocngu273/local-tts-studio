import type { ProviderId, ProviderPublicInfo } from '@shared/types/provider.types';
import type { ITTSProvider } from './provider.types';
import { edgeTtsAdapter } from './edge/edgeTts.adapter';
import { lucylabAdapter } from './lucylab/lucylab.adapter';
import { elevenlabsAdapter } from './elevenlabs/elevenlabs.adapter';
import { vbeeAdapter } from './vbee/vbee.adapter';
import { providerSettingsRepository } from '../database/repositories/providerSettings.repository';
import { secretStorageService } from '../services/security/secretStorage.service';
import { voiceCacheRepository } from '../database/repositories/voiceCache.repository';

export class ProviderRegistry {
  private providers = new Map<ProviderId, ITTSProvider>();

  constructor() {
    this.register(edgeTtsAdapter);
    this.register(lucylabAdapter);
    this.register(elevenlabsAdapter);
    this.register(vbeeAdapter);
  }

  public register(provider: ITTSProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: ProviderId): ITTSProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`TTS Provider "${id}" is not registered in ProviderRegistry.`);
    }
    return provider;
  }

  public getAll(): ITTSProvider[] {
    return Array.from(this.providers.values());
  }

  public getPublicInfoList(): ProviderPublicInfo[] {
    return this.getAll().map((provider) => {
      const settings = providerSettingsRepository.get(provider.id);
      const hasKey = secretStorageService.hasSecret(provider.id);
      const configured = provider.isConfigured();
      const voicesCount = voiceCacheRepository.countByProvider(provider.id);

      return {
        id: provider.id,
        name: provider.name,
        description: this.getProviderDescription(provider.id),
        enabled: settings ? settings.enabled === 1 : true,
        configured,
        isCloud: true,
        hasApiKey: hasKey,
        defaultVoiceId: settings?.default_voice_id ?? null,
        defaultModelId: settings?.default_model_id ?? null,
        capabilities: provider.capabilities,
        voicesCount
      };
    });
  }

  private getProviderDescription(id: ProviderId): string {
    switch (id) {
      case 'edge-tts':
        return 'Microsoft Edge online neural text-to-speech service (Free, zero config)';
      case 'lucylab':
        return 'High-quality Vietnamese and multilingual speech synthesis';
      case 'elevenlabs':
        return 'Premium AI generative voice cloning and TTS platform';
      case 'vbee':
        return 'Vietnamese conversational speech platform';
      default:
        return '';
    }
  }
}

export const providerRegistry = new ProviderRegistry();
