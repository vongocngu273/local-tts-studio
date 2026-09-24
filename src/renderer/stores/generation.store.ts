import { create } from 'zustand';
import type {
  TTSGeneration,
  ProjectAudioGenerateRequest,
  VoicePreviewRequest
} from '@shared/types/provider.types';

interface GenerationState {
  generations: TTSGeneration[];
  activeProjectGeneration: TTSGeneration | null;
  activePreviewGeneration: TTSGeneration | null;
  isGenerating: boolean;
  isPreviewing: boolean;
  error: string | null;

  loadGenerations: (projectId?: string) => Promise<void>;
  generateProjectAudio: (request: ProjectAudioGenerateRequest) => Promise<TTSGeneration | null>;
  previewVoice: (request: VoicePreviewRequest) => Promise<TTSGeneration | null>;
  deleteGeneration: (id: string) => Promise<boolean>;
  clearError: () => void;
  setActiveProjectGeneration: (gen: TTSGeneration | null) => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  generations: [],
  activeProjectGeneration: null,
  activePreviewGeneration: null,
  isGenerating: false,
  isPreviewing: false,
  error: null,

  loadGenerations: async (projectId) => {
    if (!window.localTTS?.tts) return;
    try {
      const list = await window.localTTS.tts.listGenerations(projectId);
      set({ generations: list });
      if (projectId && list.length > 0) {
        // Set most recent generation as active for this project
        const latest = list[0];
        if (latest && latest.status === 'completed') {
          set({ activeProjectGeneration: latest });
        }
      }
    } catch (err) {
      console.error('Failed to load generations:', err);
    }
  },

  generateProjectAudio: async (request) => {
    if (!window.localTTS?.tts) return null;
    set({ isGenerating: true, error: null });
    try {
      const result = await window.localTTS.tts.generateProjectAudio(request);
      set((state) => ({
        activeProjectGeneration: result,
        generations: [result, ...state.generations.filter((g) => g.id !== result.id)]
      }));
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audio synthesis failed';
      set({ error: msg });
      throw err;
    } finally {
      set({ isGenerating: false });
    }
  },

  previewVoice: async (request) => {
    if (!window.localTTS?.tts) return null;
    set({ isPreviewing: true, error: null });
    try {
      const result = await window.localTTS.tts.previewVoice(request);
      set({ activePreviewGeneration: result });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice preview failed';
      set({ error: msg });
      throw err;
    } finally {
      set({ isPreviewing: false });
    }
  },

  deleteGeneration: async (id) => {
    if (!window.localTTS?.tts) return false;
    try {
      const success = await window.localTTS.tts.deleteGeneration(id);
      if (success) {
        set((state) => ({
          generations: state.generations.filter((g) => g.id !== id),
          activeProjectGeneration:
            state.activeProjectGeneration?.id === id ? null : state.activeProjectGeneration
        }));
      }
      return success;
    } catch (err) {
      console.error('Failed to delete generation:', err);
      return false;
    }
  },

  clearError: () => set({ error: null }),
  setActiveProjectGeneration: (gen) => set({ activeProjectGeneration: gen })
}));
