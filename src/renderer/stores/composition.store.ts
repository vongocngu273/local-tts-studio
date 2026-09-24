import { create } from 'zustand';
import type { AudioComposition, AudioCompositionSettings } from '@shared/types/composition.types';
import type { SubtitleCue, SubtitleExportFormat, SubtitleExportResult, SubtitleSettings } from '@shared/types/subtitle.types';
import type { ProjectExportOptions, ProjectExportResult } from '@shared/types/export.types';

interface CompositionState {
  composition: AudioComposition | null;
  cues: SubtitleCue[];
  isComposing: boolean;
  isExporting: boolean;
  isLoadingCues: boolean;
  error: string | null;
  lastExportResult: ProjectExportResult | null;
  lastSubtitleResult: SubtitleExportResult | null;

  loadLatestComposition: (projectId: string) => Promise<void>;
  composeAudio: (projectId: string, settings?: Partial<AudioCompositionSettings>) => Promise<AudioComposition | null>;
  loadCues: (projectId: string, sentencePauseMs?: number, paragraphPauseMs?: number, settings?: Partial<SubtitleSettings>) => Promise<void>;
  exportSubtitles: (projectId: string, format: SubtitleExportFormat, sentencePauseMs?: number, paragraphPauseMs?: number, settings?: Partial<SubtitleSettings>) => Promise<SubtitleExportResult | null>;
  exportBundle: (projectId: string, targetDirectory: string, options?: Partial<ProjectExportOptions>) => Promise<ProjectExportResult | null>;
}

export const useCompositionStore = create<CompositionState>((set) => ({
  composition: null,
  cues: [],
  isComposing: false,
  isExporting: false,
  isLoadingCues: false,
  error: null,
  lastExportResult: null,
  lastSubtitleResult: null,

  loadLatestComposition: async (projectId: string) => {
    try {
      const comp = await window.localTTS.compositions.getLatest(projectId);
      set({ composition: comp });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  composeAudio: async (projectId: string, settings?: Partial<AudioCompositionSettings>) => {
    set({ isComposing: true, error: null });
    try {
      const result = await window.localTTS.compositions.compose(projectId, settings);
      set({ composition: result.composition, isComposing: false });
      return result.composition;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isComposing: false });
      return null;
    }
  },

  loadCues: async (projectId: string, sentencePauseMs?: number, paragraphPauseMs?: number, settings?: Partial<SubtitleSettings>) => {
    set({ isLoadingCues: true, error: null });
    try {
      const cues = await window.localTTS.subtitles.buildCues(projectId, sentencePauseMs, paragraphPauseMs, settings);
      set({ cues, isLoadingCues: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoadingCues: false });
    }
  },

  exportSubtitles: async (projectId: string, format: SubtitleExportFormat, sentencePauseMs?: number, paragraphPauseMs?: number, settings?: Partial<SubtitleSettings>) => {
    try {
      const res = await window.localTTS.subtitles.export(projectId, format, sentencePauseMs, paragraphPauseMs, settings);
      set({ lastSubtitleResult: res });
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    }
  },

  exportBundle: async (projectId: string, targetDirectory: string, options?: Partial<ProjectExportOptions>) => {
    set({ isExporting: true, error: null });
    try {
      const res = await window.localTTS.export.exportBundle(projectId, targetDirectory, options);
      set({ lastExportResult: res, isExporting: false });
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isExporting: false });
      return null;
    }
  }
}));
