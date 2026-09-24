import { create } from 'zustand';
import type { Project, ProjectDraft, SaveStatus } from '@shared/types/project.types';

interface ProjectEditorState {
  currentProject: Project | null;
  originalText: string;
  dirty: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  recoveryDraft: ProjectDraft | null;
  isLoading: boolean;
  errorMessage: string | null;

  // Actions
  loadProject: (id: string) => Promise<void>;
  setOriginalText: (text: string) => void;
  saveNow: () => Promise<void>;
  recoverDraft: () => Promise<void>;
  discardRecovery: () => Promise<void>;
  renameCurrentProject: (newName: string) => Promise<void>;
  closeProject: () => Promise<void>;
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useProjectEditorStore = create<ProjectEditorState>((set, get) => ({
  currentProject: null,
  originalText: '',
  dirty: false,
  saveStatus: 'idle',
  lastSavedAt: null,
  recoveryDraft: null,
  isLoading: false,
  errorMessage: null,

  loadProject: async (id: string) => {
    // If current project is dirty, save it before switching
    const { dirty, saveNow } = get();
    if (dirty) {
      await saveNow();
    }

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    if (draftSaveTimer) clearTimeout(draftSaveTimer);

    set({ isLoading: true, errorMessage: null });

    try {
      if (!window.localTTS?.projects) {
        throw new Error('LocalTTS projects API not available');
      }

      const project = await window.localTTS.projects.get(id);
      if (!project) {
        set({
          isLoading: false,
          errorMessage: 'PROJECT_NOT_FOUND',
          currentProject: null
        });
        return;
      }

      // Check for crash recovery draft
      const recoveryDraft = await window.localTTS.projects.recovery.check(id);

      set({
        currentProject: project,
        originalText: project.originalText,
        dirty: false,
        saveStatus: 'saved',
        lastSavedAt: project.updatedAt,
        recoveryDraft,
        isLoading: false,
        errorMessage: null
      });
    } catch (err) {
      console.error('Failed to load project:', err);
      set({
        isLoading: false,
        errorMessage: String(err)
      });
    }
  },

  setOriginalText: (text: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({
      originalText: text,
      dirty: true,
      saveStatus: 'dirty'
    });

    // 1. Debounced intermediate draft save (400ms) for crash recovery
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      if (window.localTTS?.projects && get().currentProject) {
        window.localTTS.projects.saveDraft({
          projectId: currentProject.id,
          originalText: text,
          revision: currentProject.revision
        }).catch((err) => console.warn('Background draft save error:', err));
      }
    }, 400);

    // 2. Section 27: Debounced main auto-save (1000ms)
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      get().saveNow();
    }, 1000);
  },

  saveNow: async () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = null;
    }

    const { currentProject, originalText, dirty } = get();
    if (!currentProject || !dirty) return;

    set({ saveStatus: 'saving' });

    try {
      if (!window.localTTS?.projects) {
        throw new Error('LocalTTS projects API not available');
      }

      const updated = await window.localTTS.projects.saveText({
        projectId: currentProject.id,
        originalText,
        expectedRevision: currentProject.revision
      });

      set({
        currentProject: updated,
        dirty: false,
        saveStatus: 'saved',
        lastSavedAt: updated.updatedAt,
        errorMessage: null
      });
    } catch (err) {
      console.error('Failed to save project:', err);
      set({
        saveStatus: 'error',
        errorMessage: String(err)
      });
    }
  },

  recoverDraft: async () => {
    const { currentProject, recoveryDraft } = get();
    if (!currentProject || !recoveryDraft) return;

    try {
      set({ saveStatus: 'saving' });
      const recovered = await window.localTTS.projects.recovery.recover(currentProject.id);

      set({
        currentProject: recovered,
        originalText: recovered.originalText,
        dirty: false,
        saveStatus: 'saved',
        lastSavedAt: recovered.updatedAt,
        recoveryDraft: null
      });
    } catch (err) {
      console.error('Error recovering draft:', err);
      set({ saveStatus: 'error', errorMessage: 'Could not recover draft' });
    }
  },

  discardRecovery: async () => {
    const { currentProject } = get();
    if (!currentProject) return;

    try {
      await window.localTTS.projects.recovery.discard(currentProject.id);
      set({ recoveryDraft: null });
    } catch (err) {
      console.error('Error discarding recovery:', err);
    }
  },

  renameCurrentProject: async (newName: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    try {
      const updated = await window.localTTS.projects.rename(currentProject.id, newName);
      set({ currentProject: updated });
    } catch (err) {
      console.error('Failed to rename project:', err);
      throw err;
    }
  },

  closeProject: async () => {
    const { dirty, saveNow } = get();
    if (dirty) {
      await saveNow();
    }
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    if (draftSaveTimer) clearTimeout(draftSaveTimer);

    set({
      currentProject: null,
      originalText: '',
      dirty: false,
      saveStatus: 'idle',
      lastSavedAt: null,
      recoveryDraft: null,
      errorMessage: null
    });
  }
}));
