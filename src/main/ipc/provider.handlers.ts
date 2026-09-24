import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { providerRegistry } from '../providers/provider.registry';
import { providerSettingsRepository } from '../database/repositories/providerSettings.repository';
import { secretStorageService } from '../services/security/secretStorage.service';
import { voiceManagerService } from '../services/tts/voiceManager.service';
import {
  ProviderIdSchema,
  SetProviderSecretInputSchema,
  UpdateProviderSettingsInputSchema,
  VoiceFilterOptionsSchema
} from '@shared/schemas/provider.schema';
import { z } from 'zod';
import { logger } from '../services/logger/logger';

export function registerProviderHandlers(): void {
  // 1. Providers Management
  ipcMain.handle(IPC_CHANNELS.PROVIDER_GET_ALL, async () => {
    try {
      return providerRegistry.getPublicInfoList();
    } catch (err) {
      logger.error('ipc:provider', 'Error getting providers list', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDER_UPDATE_SETTINGS, async (_event, rawInput) => {
    try {
      const input = UpdateProviderSettingsInputSchema.parse(rawInput);
      providerSettingsRepository.upsert({
        provider_id: input.providerId,
        enabled: input.enabled,
        default_voice_id: input.defaultVoiceId,
        default_model_id: input.defaultModelId,
        config_json: input.config ? JSON.stringify(input.config) : undefined
      });
      return true;
    } catch (err) {
      logger.error('ipc:provider', 'Error updating provider settings', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDER_SET_SECRET, async (_event, rawInput) => {
    try {
      const input = SetProviderSecretInputSchema.parse(rawInput);
      secretStorageService.setSecret(input.providerId, input.secretName, input.secretValue);
      return true;
    } catch (err) {
      logger.error('ipc:provider', 'Error setting provider secret', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDER_DELETE_SECRET, async (_event, rawId, rawSecretName) => {
    try {
      const providerId = ProviderIdSchema.parse(rawId);
      const secretName = rawSecretName ? z.string().parse(rawSecretName) : 'api_key';
      return secretStorageService.deleteSecret(providerId, secretName);
    } catch (err) {
      logger.error('ipc:provider', 'Error deleting provider secret', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROVIDER_TEST_CONNECTION, async (_event, rawId) => {
    try {
      const providerId = ProviderIdSchema.parse(rawId);
      const provider = providerRegistry.getProvider(providerId);
      return await provider.testConnection();
    } catch (err) {
      logger.error('ipc:provider', `Error testing connection for ${rawId}`, err);
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err)
      };
    }
  });

  // 2. Voice Catalog
  ipcMain.handle(IPC_CHANNELS.VOICE_LIST, async (_event, rawFilter) => {
    try {
      const filter = rawFilter ? VoiceFilterOptionsSchema.parse(rawFilter) : undefined;
      return await voiceManagerService.listVoices(filter);
    } catch (err) {
      logger.error('ipc:provider', 'Error listing voices', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VOICE_REFRESH, async (_event, rawId) => {
    try {
      const providerId = rawId ? ProviderIdSchema.parse(rawId) : undefined;
      return await voiceManagerService.refreshVoices(providerId);
    } catch (err) {
      logger.error('ipc:provider', 'Error refreshing voices', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VOICE_TOGGLE_FAVORITE, async (_event, rawId, rawVoiceId) => {
    try {
      const providerId = ProviderIdSchema.parse(rawId);
      const voiceId = z.string().min(1).parse(rawVoiceId);
      return voiceManagerService.toggleFavorite(providerId, voiceId);
    } catch (err) {
      logger.error('ipc:provider', 'Error toggling voice favorite', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VOICE_GET_FAVORITES, async () => {
    try {
      return voiceManagerService.getFavorites();
    } catch (err) {
      logger.error('ipc:provider', 'Error getting voice favorites', err);
      throw err;
    }
  });
}
