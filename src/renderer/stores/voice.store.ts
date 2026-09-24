import { create } from 'zustand';
import type { VoiceDefinition, VoiceFilterOptions, ProviderId } from '@shared/types/provider.types';

interface VoiceState {
  voices: VoiceDefinition[];
  isLoading: boolean;
  isRefreshing: boolean;
  filter: VoiceFilterOptions;
  previewingVoiceId: string | null;

  setFilter: (filter: Partial<VoiceFilterOptions>) => void;
  fetchVoices: () => Promise<void>;
  refreshVoices: (providerId?: ProviderId) => Promise<void>;
  toggleFavorite: (providerId: ProviderId, voiceId: string) => Promise<boolean>;
  setPreviewingVoiceId: (voiceId: string | null) => void;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  voices: [],
  isLoading: false,
  isRefreshing: false,
  filter: {
    providerId: 'ALL',
    gender: 'ALL',
    search: '',
    favoritesOnly: false
  },
  previewingVoiceId: null,

  setFilter: (newFilter) => {
    set((state) => ({
      filter: { ...state.filter, ...newFilter }
    }));
    get().fetchVoices();
  },

  fetchVoices: async () => {
    if (!window.localTTS?.voices) return;
    set({ isLoading: true });
    try {
      const list = await window.localTTS.voices.list(get().filter);
      set({ voices: list });
    } catch (err) {
      console.error('Failed to fetch voices:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshVoices: async (providerId) => {
    if (!window.localTTS?.voices) return;
    set({ isRefreshing: true });
    try {
      await window.localTTS.voices.refresh(providerId);
      await get().fetchVoices();
    } catch (err) {
      console.error('Failed to refresh voices:', err);
    } finally {
      set({ isRefreshing: false });
    }
  },

  toggleFavorite: async (providerId, voiceId) => {
    if (!window.localTTS?.voices) return false;
    try {
      const isFav = await window.localTTS.voices.toggleFavorite(providerId, voiceId);
      set((state) => ({
        voices: state.voices.map((v) =>
          v.providerId === providerId && v.id === voiceId ? { ...v, isFavorite: isFav } : v
        )
      }));
      return isFav;
    } catch (err) {
      console.error('Failed to toggle voice favorite:', err);
      return false;
    }
  },

  setPreviewingVoiceId: (voiceId) => {
    set({ previewingVoiceId: voiceId });
  }
}));
