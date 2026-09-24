import { create } from 'zustand';
import type { ProviderId, ProviderPublicInfo, UpdateProviderSettingsInput } from '@shared/types/provider.types';

interface ProviderState {
  providers: ProviderPublicInfo[];
  isLoading: boolean;
  testingProviderId: ProviderId | null;
  testResults: Record<string, { success: boolean; message: string }>;

  fetchProviders: () => Promise<void>;
  updateSettings: (input: UpdateProviderSettingsInput) => Promise<boolean>;
  setSecret: (providerId: ProviderId, secretValue: string) => Promise<boolean>;
  deleteSecret: (providerId: ProviderId) => Promise<boolean>;
  testConnection: (providerId: ProviderId) => Promise<{ success: boolean; message: string }>;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  isLoading: false,
  testingProviderId: null,
  testResults: {},

  fetchProviders: async () => {
    if (!window.localTTS?.providers) return;
    set({ isLoading: true });
    try {
      const list = await window.localTTS.providers.getAll();
      set({ providers: list });
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (input) => {
    if (!window.localTTS?.providers) return false;
    try {
      await window.localTTS.providers.updateSettings(input);
      await get().fetchProviders();
      return true;
    } catch (err) {
      console.error('Failed to update provider settings:', err);
      return false;
    }
  },

  setSecret: async (providerId, secretValue) => {
    if (!window.localTTS?.providers) return false;
    try {
      await window.localTTS.providers.setSecret({
        providerId,
        secretName: 'api_key',
        secretValue
      });
      await get().fetchProviders();
      return true;
    } catch (err) {
      console.error('Failed to set provider secret:', err);
      return false;
    }
  },

  deleteSecret: async (providerId) => {
    if (!window.localTTS?.providers) return false;
    try {
      await window.localTTS.providers.deleteSecret(providerId, 'api_key');
      await get().fetchProviders();
      return true;
    } catch (err) {
      console.error('Failed to delete provider secret:', err);
      return false;
    }
  },

  testConnection: async (providerId) => {
    if (!window.localTTS?.providers) {
      return { success: false, message: 'Provider API not available' };
    }
    set({ testingProviderId: providerId });
    try {
      const result = await window.localTTS.providers.testConnection(providerId);
      set((state) => ({
        testResults: { ...state.testResults, [providerId]: result }
      }));
      await get().fetchProviders();
      return result;
    } catch (err) {
      const result = {
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed'
      };
      set((state) => ({
        testResults: { ...state.testResults, [providerId]: result }
      }));
      return result;
    } finally {
      set({ testingProviderId: null });
    }
  }
}));
