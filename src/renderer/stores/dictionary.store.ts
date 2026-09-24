import { create } from 'zustand';
import type {
  PronunciationRule,
  CreatePronunciationRuleInput,
  UpdatePronunciationRuleInput,
  DictionarySortBy,
  ProviderScope,
  DictionaryImportInput,
  DictionaryImportPreviewResult
} from '@shared/types/dictionary.types';

interface DictionaryState {
  rules: PronunciationRule[];
  loading: boolean;
  searchQuery: string;
  categoryFilter: string;
  providerFilter: ProviderScope | 'ALL';
  statusFilter: 'ALL' | 'ENABLED' | 'DISABLED';
  sortBy: DictionarySortBy;
  sortOrder: 'asc' | 'desc';
  selectedRuleIds: string[];
  categories: string[];
  dictionaryRevision: number;
  error: string | null;

  // Actions
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string) => void;
  setProviderFilter: (provider: ProviderScope | 'ALL') => void;
  setStatusFilter: (status: 'ALL' | 'ENABLED' | 'DISABLED') => void;
  setSortBy: (sortBy: DictionarySortBy) => void;
  toggleSortOrder: () => void;
  toggleSelectRule: (id: string) => void;
  selectAllRules: (select: boolean) => void;

  fetchRules: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createRule: (input: CreatePronunciationRuleInput) => Promise<PronunciationRule>;
  updateRule: (id: string, changes: UpdatePronunciationRuleInput) => Promise<PronunciationRule>;
  deleteRule: (id: string) => Promise<boolean>;
  deleteSelectedRules: () => Promise<void>;
  toggleEnabled: (id: string, enabled: boolean) => Promise<void>;
  setSelectedRulesEnabled: (enabled: boolean) => Promise<void>;
  testRule: (rule: CreatePronunciationRuleInput, sampleText: string) => Promise<{ original: string; processed: string; matched: boolean }>;
  selectImportFile: () => Promise<{ content: string; format: 'json' | 'csv'; filePath: string } | null>;
  previewImport: (input: DictionaryImportInput) => Promise<DictionaryImportPreviewResult>;
  executeImport: (input: DictionaryImportInput) => Promise<{ inserted: number; updated: number; skipped: number }>;
  exportToFile: (format: 'json' | 'csv') => Promise<boolean>;
}

export const useDictionaryStore = create<DictionaryState>((set, get) => ({
  rules: [],
  loading: false,
  searchQuery: '',
  categoryFilter: '',
  providerFilter: 'ALL',
  statusFilter: 'ALL',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  selectedRuleIds: [],
  categories: [],
  dictionaryRevision: 0,
  error: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategoryFilter: (category) => set({ categoryFilter: category }),
  setProviderFilter: (provider) => set({ providerFilter: provider }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleSortOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

  toggleSelectRule: (id) =>
    set((state) => ({
      selectedRuleIds: state.selectedRuleIds.includes(id)
        ? state.selectedRuleIds.filter((item) => item !== id)
        : [...state.selectedRuleIds, id]
    })),

  selectAllRules: (select) =>
    set((state) => ({
      selectedRuleIds: select ? state.rules.map((r) => r.id) : []
    })),

  fetchRules: async () => {
    if (!window.localTTS?.dictionary) return;
    set({ loading: true, error: null });

    try {
      const { searchQuery, categoryFilter, providerFilter, statusFilter, sortBy, sortOrder } = get();

      const options: Parameters<typeof window.localTTS.dictionary.list>[0] = {
        search: searchQuery.trim() || undefined,
        category: categoryFilter || undefined,
        providerScope: providerFilter !== 'ALL' ? providerFilter : undefined,
        enabled: statusFilter === 'ALL' ? undefined : statusFilter === 'ENABLED',
        sortBy,
        sortOrder
      };

      const [list, revision] = await Promise.all([
        window.localTTS.dictionary.list(options),
        window.localTTS.dictionary.getRevision()
      ]);

      set({
        rules: list,
        dictionaryRevision: revision,
        loading: false
      });
    } catch (err) {
      console.error('Failed to fetch dictionary rules:', err);
      set({ error: String(err), loading: false });
    }
  },

  fetchCategories: async () => {
    if (!window.localTTS?.dictionary) return;
    try {
      const categories = await window.localTTS.dictionary.getCategories();
      set({ categories });
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  },

  createRule: async (input) => {
    if (!window.localTTS?.dictionary) throw new Error('Dictionary API not available');
    try {
      const newRule = await window.localTTS.dictionary.create(input);
      await get().fetchRules();
      await get().fetchCategories();
      return newRule;
    } catch (err) {
      console.error('Failed to create rule:', err);
      throw err;
    }
  },

  updateRule: async (id, changes) => {
    if (!window.localTTS?.dictionary) throw new Error('Dictionary API not available');
    try {
      const updated = await window.localTTS.dictionary.update(id, changes);
      await get().fetchRules();
      await get().fetchCategories();
      return updated;
    } catch (err) {
      console.error('Failed to update rule:', err);
      throw err;
    }
  },

  deleteRule: async (id) => {
    if (!window.localTTS?.dictionary) return false;
    try {
      const res = await window.localTTS.dictionary.remove(id);
      set((state) => ({
        selectedRuleIds: state.selectedRuleIds.filter((ruleId) => ruleId !== id)
      }));
      await get().fetchRules();
      await get().fetchCategories();
      return res;
    } catch (err) {
      console.error('Failed to delete rule:', err);
      return false;
    }
  },

  deleteSelectedRules: async () => {
    if (!window.localTTS?.dictionary) return;
    const { selectedRuleIds } = get();
    if (selectedRuleIds.length === 0) return;

    try {
      await window.localTTS.dictionary.removeMany(selectedRuleIds);
      set({ selectedRuleIds: [] });
      await get().fetchRules();
      await get().fetchCategories();
    } catch (err) {
      console.error('Failed to delete selected rules:', err);
    }
  },

  toggleEnabled: async (id, enabled) => {
    if (!window.localTTS?.dictionary) return;
    try {
      await window.localTTS.dictionary.setEnabled(id, enabled);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? { ...r, enabled } : r))
      }));
    } catch (err) {
      console.error('Failed to toggle rule enabled:', err);
    }
  },

  setSelectedRulesEnabled: async (enabled) => {
    if (!window.localTTS?.dictionary) return;
    const { selectedRuleIds } = get();
    if (selectedRuleIds.length === 0) return;

    try {
      await window.localTTS.dictionary.setEnabledMany(selectedRuleIds, enabled);
      await get().fetchRules();
    } catch (err) {
      console.error('Failed to set enabled on selected rules:', err);
    }
  },

  testRule: async (rule, sampleText) => {
    if (!window.localTTS?.dictionary) throw new Error('Dictionary API not available');
    return window.localTTS.dictionary.testRule({ rule, sampleText });
  },

  selectImportFile: async () => {
    if (!window.localTTS?.dictionary) return null;
    return window.localTTS.dictionary.import.selectFile();
  },

  previewImport: async (input) => {
    if (!window.localTTS?.dictionary) throw new Error('Dictionary API not available');
    return window.localTTS.dictionary.import.preview(input);
  },

  executeImport: async (input) => {
    if (!window.localTTS?.dictionary) throw new Error('Dictionary API not available');
    const result = await window.localTTS.dictionary.import.execute(input);
    await get().fetchRules();
    await get().fetchCategories();
    return result;
  },

  exportToFile: async (format) => {
    if (!window.localTTS?.dictionary) return false;
    const { categoryFilter, providerFilter } = get();
    return window.localTTS.dictionary.export.toFile({
      format,
      category: categoryFilter || undefined,
      providerScope: providerFilter !== 'ALL' ? providerFilter : undefined
    });
  }
}));
