import { create } from 'zustand';
import type { ProjectSegment, BuildSegmentsResult, SegmentationProfile } from '@shared/types/segment.types';
import type { QueueStatus, QueueEvent, TTSJob } from '@shared/types/queue.types';
import type { ProviderId, VoiceSettings } from '@shared/types/provider.types';

interface SegmentState {
  segments: ProjectSegment[];
  isLoading: boolean;
  isBuilding: boolean;
  queueStatus: QueueStatus | null;
  activeSegmentId: string | null;
  selectedSegment: ProjectSegment | null;
  editingSegment: ProjectSegment | null;
  error: string | null;

  loadSegments: (projectId: string) => Promise<void>;
  buildSegments: (projectId: string, profile?: Partial<SegmentationProfile>) => Promise<BuildSegmentsResult | null>;
  updateOverride: (id: string, overrideText: string) => Promise<void>;
  resetOverride: (id: string) => Promise<void>;
  updateVoice: (id: string, providerId: ProviderId, voiceId: string, settings?: VoiceSettings) => Promise<void>;
  startQueue: (projectId: string, segmentIds?: string[]) => Promise<TTSJob[]>;
  pauseQueue: () => Promise<void>;
  resumeQueue: () => Promise<void>;
  cancelQueue: (projectId: string) => Promise<void>;
  regenerateSegment: (projectId: string, segmentId: string) => Promise<void>;
  fetchQueueStatus: (projectId?: string) => Promise<void>;
  setSelectedSegment: (seg: ProjectSegment | null) => void;
  setEditingSegment: (seg: ProjectSegment | null) => void;
  setActiveSegmentId: (id: string | null) => void;
  handleQueueEvent: (event: QueueEvent) => void;
}

export const useSegmentStore = create<SegmentState>((set, get) => ({
  segments: [],
  isLoading: false,
  isBuilding: false,
  queueStatus: null,
  activeSegmentId: null,
  selectedSegment: null,
  editingSegment: null,
  error: null,

  loadSegments: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const segments = await window.localTTS.segments.list(projectId);
      set({ segments, isLoading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
    }
  },

  buildSegments: async (projectId: string, profile?: Partial<SegmentationProfile>) => {
    set({ isBuilding: true, error: null });
    try {
      const result = await window.localTTS.segments.build(projectId, profile);
      set({ segments: result.segments, isBuilding: false });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isBuilding: false });
      return null;
    }
  },

  updateOverride: async (id: string, overrideText: string) => {
    try {
      const updated = await window.localTTS.segments.updateOverride(id, overrideText);
      set((state) => ({
        segments: state.segments.map((s) => (s.id === id ? updated : s)),
        editingSegment: null
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  resetOverride: async (id: string) => {
    try {
      const updated = await window.localTTS.segments.resetOverride(id);
      set((state) => ({
        segments: state.segments.map((s) => (s.id === id ? updated : s)),
        editingSegment: null
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  updateVoice: async (id: string, providerId: ProviderId, voiceId: string, settings?: VoiceSettings) => {
    try {
      const updated = await window.localTTS.segments.updateVoice(id, providerId, voiceId, settings);
      set((state) => ({
        segments: state.segments.map((s) => (s.id === id ? updated : s))
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  startQueue: async (projectId: string, segmentIds?: string[]) => {
    try {
      const jobs = await window.localTTS.queue.start(projectId, segmentIds);
      await get().fetchQueueStatus(projectId);
      await get().loadSegments(projectId);
      return jobs;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return [];
    }
  },

  pauseQueue: async () => {
    await window.localTTS.queue.pause();
    const status = await window.localTTS.queue.getStatus();
    set({ queueStatus: status });
  },

  resumeQueue: async () => {
    await window.localTTS.queue.resume();
    const status = await window.localTTS.queue.getStatus();
    set({ queueStatus: status });
  },

  cancelQueue: async (projectId: string) => {
    await window.localTTS.queue.cancel(projectId);
    await get().fetchQueueStatus(projectId);
    await get().loadSegments(projectId);
  },

  regenerateSegment: async (projectId: string, segmentId: string) => {
    try {
      await window.localTTS.queue.regenerateSegment(projectId, segmentId);
      await get().fetchQueueStatus(projectId);
      await get().loadSegments(projectId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  fetchQueueStatus: async (projectId?: string) => {
    try {
      const status = await window.localTTS.queue.getStatus(projectId);
      set({ queueStatus: status });
    } catch {
      // ignore
    }
  },

  setSelectedSegment: (seg: ProjectSegment | null) => {
    set({ selectedSegment: seg });
  },

  setEditingSegment: (seg: ProjectSegment | null) => {
    set({ editingSegment: seg });
  },

  setActiveSegmentId: (id: string | null) => {
    set({ activeSegmentId: id });
  },

  handleQueueEvent: (event: QueueEvent) => {
    if (event.status) {
      set({ queueStatus: event.status });
    }

    if (event.job?.segmentId) {
      const segId = event.job.segmentId;
      set((state) => ({
        segments: state.segments.map((s) => {
          if (s.id !== segId) return s;
          if (event.type === 'job:started') {
            return { ...s, status: 'processing' };
          }
          if (event.type === 'job:completed') {
            return { ...s, status: 'completed' };
          }
          if (event.type === 'job:failed') {
            return { ...s, status: 'failed', errorMessage: event.job?.errorMessage || null };
          }
          return s;
        })
      }));
    }
  }
}));
