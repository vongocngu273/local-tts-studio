import { create } from 'zustand';
import type {
  TextProcessingResult,
  TextProcessingSettings
} from '@shared/types/textProcessing.types';
import type { ProviderScope } from '@shared/types/dictionary.types';

interface TextProcessingState {
  settings: TextProcessingSettings;
  processing: boolean;
  result: TextProcessingResult | null;
  viewMode: 'side-by-side' | 'processed-only';
  isStale: boolean;
  error: string | null;

  // Actions
  updateSettings: (newSettings: Partial<TextProcessingSettings>) => void;
  setProviderContext: (provider: ProviderScope) => void;
  setViewMode: (mode: 'side-by-side' | 'processed-only') => void;
  preview: (text: string) => Promise<void>;
  processProject: (projectId: string) => Promise<TextProcessingResult | null>;
  setResult: (result: TextProcessingResult | null) => void;
  setIsStale: (stale: boolean) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: TextProcessingSettings = {
  dictionaryEnabled: true,
  whitespaceNormalization: true,
  dateNormalization: false,
  numberNormalization: false,
  currencyNormalization: false,
  abbreviationNormalization: false,
  providerContext: 'ALL'
};

export const useTextProcessingStore = create<TextProcessingState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  processing: false,
  result: null,
  viewMode: 'side-by-side',
  isStale: false,
  error: null,

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
      isStale: true
    }));
  },

  setProviderContext: (provider) => {
    set((state) => ({
      settings: { ...state.settings, providerContext: provider },
      isStale: true
    }));
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setIsStale: (stale) => set({ isStale: stale }),

  setResult: (result) => set({ result, isStale: false, error: null }),

  preview: async (text: string) => {
    if (!window.localTTS?.textProcessing) return;
    set({ processing: true, error: null });

    try {
      const { settings } = get();
      const res = await window.localTTS.textProcessing.preview({
        text,
        settings
      });

      set({
        result: res,
        processing: false,
        isStale: false,
        error: null
      });
    } catch (err) {
      console.error('Failed to preview text processing:', err);
      set({
        processing: false,
        error: String(err)
      });
    }
  },

  processProject: async (projectId: string) => {
    if (!window.localTTS?.textProcessing) return null;
    set({ processing: true, error: null });

    try {
      const { settings } = get();
      const res = await window.localTTS.textProcessing.processProject(projectId, settings);

      set({
        result: res,
        processing: false,
        isStale: false,
        error: null
      });

      return res;
    } catch (err) {
      console.error('Failed to process project:', err);
      set({
        processing: false,
        error: String(err)
      });
      return null;
    }
  },

  reset: () => {
    set({
      settings: DEFAULT_SETTINGS,
      processing: false,
      result: null,
      isStale: false,
      error: null
    });
  }
}));
