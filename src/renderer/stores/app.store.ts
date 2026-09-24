import { create } from 'zustand';
import type { ProviderId } from '@shared/types/provider.types';
import { translations, type Language } from '../i18n/translations';

export type AppRoute =
  | 'dashboard'
  | 'tts'
  | 'projects'
  | 'history'
  | 'voices'
  | 'presets'
  | 'dictionary'
  | 'settings';

export type AppTheme = 'light' | 'dark' | 'system';

interface TtsDraftState {
  text: string;
  provider: ProviderId;
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
}

interface AppStoreState {
  activeRoute: AppRoute;
  sidebarCollapsed: boolean;
  theme: AppTheme;
  language: Language;
  ttsDraft: TtsDraftState;

  // Actions
  setActiveRoute: (route: AppRoute) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: Language) => void;
  updateTtsDraft: (updates: Partial<TtsDraftState>) => void;
  clearTtsDraft: () => void;
}

const getInitialTheme = (): AppTheme => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem('app-theme') as AppTheme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  }
  return 'dark';
};

const getInitialLanguage = (): Language => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem('app-language') as Language | null;
    if (saved === 'vi' || saved === 'en') {
      return saved;
    }
  }
  return 'vi'; // Default to Vietnamese as requested
};

export const useAppStore = create<AppStoreState>((set) => ({
  activeRoute: 'dashboard',
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  language: getInitialLanguage(),
  ttsDraft: {
    text: '',
    provider: 'edge-tts',
    voice: 'vi-VN-HoaiMyNeural',
    speed: 1.0,
    pitch: 0,
    volume: 100
  },

  setActiveRoute: (route) => set({ activeRoute: route }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('app-theme', theme);
    }
    set({ theme });
  },
  setLanguage: (language) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('app-language', language);
    }
    set({ language });
  },
  updateTtsDraft: (updates) =>
    set((state) => ({
      ttsDraft: { ...state.ttsDraft, ...updates }
    })),
  clearTtsDraft: () =>
    set((state) => ({
      ttsDraft: { ...state.ttsDraft, text: '' }
    }))
}));

export const useTranslation = () => {
  const language = useAppStore((state) => state.language);
  return {
    t: translations[language],
    language,
    setLanguage: useAppStore.getState().setLanguage
  };
};
