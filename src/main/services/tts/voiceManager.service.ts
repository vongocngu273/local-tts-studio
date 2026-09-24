import type { VoiceDefinition, VoiceFilterOptions, ProviderId } from '@shared/types/provider.types';
import { voiceCacheRepository } from '../../database/repositories/voiceCache.repository';
import { voiceFavoritesRepository } from '../../database/repositories/voiceFavorites.repository';
import { providerRegistry } from '../../providers/provider.registry';
import { logger } from '../logger/logger';

export class VoiceManagerService {
  /**
   * Lists voices from SQLite cache with optional filtering.
   * Auto-populates cache from adapters on first run if cache is empty.
   */
  public async listVoices(filter?: VoiceFilterOptions): Promise<VoiceDefinition[]> {
    let voices = voiceCacheRepository.list(filter);

    // If cache is completely empty, initialize all provider caches
    if (voices.length === 0 && !filter?.search && !filter?.favoritesOnly) {
      logger.info('tts:voices', 'Voice cache empty, initializing from providers');
      await this.refreshVoices(filter?.providerId === 'ALL' ? undefined : filter?.providerId);
      voices = voiceCacheRepository.list(filter);
    }

    return voices;
  }

  /**
   * Refreshes voices from live provider adapter(s) and updates SQLite cache.
   */
  public async refreshVoices(providerId?: ProviderId): Promise<VoiceDefinition[]> {
    const providers = providerId
      ? [providerRegistry.getProvider(providerId)]
      : providerRegistry.getAll();

    const allDiscovered: VoiceDefinition[] = [];

    for (const provider of providers) {
      try {
        logger.info('tts:voices', `Fetching voice list for provider: ${provider.id}`);
        const voices = await provider.getVoices();
        voiceCacheRepository.upsertMany(voices);
        allDiscovered.push(...voices);
        logger.info('tts:voices', `Cached ${voices.length} voices for ${provider.id}`);
      } catch (err) {
        logger.error('tts:voices', `Failed to fetch voices for ${provider.id}`, err);
      }
    }

    return allDiscovered;
  }

  public toggleFavorite(providerId: ProviderId, voiceId: string): boolean {
    return voiceFavoritesRepository.toggle(providerId, voiceId);
  }

  public getFavorites(): { providerId: ProviderId; voiceId: string }[] {
    return voiceFavoritesRepository.getAll();
  }
}

export const voiceManagerService = new VoiceManagerService();
