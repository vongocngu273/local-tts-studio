import React from 'react';
import {
  Menu,
  Sun,
  Moon,
  Laptop,
  AudioWaveform,
  Globe
} from 'lucide-react';
import { useAppStore, AppTheme, AppRoute, useTranslation } from '../../stores/app.store';
import { APP_NAME } from '@shared/constants/app.constants';

export const AppHeader: React.FC = () => {
  const { activeRoute, toggleSidebar, theme, setTheme, language, setLanguage } = useAppStore();
  const { t } = useTranslation();

  const routeTitles: Record<AppRoute, string> = {
    dashboard: t.nav.dashboard,
    tts: t.nav.tts,
    projects: t.nav.projects,
    history: t.nav.history,
    voices: t.nav.voices,
    presets: t.nav.presets,
    dictionary: t.nav.dictionary,
    settings: t.nav.settings
  };

  const handleCycleTheme = (): void => {
    const cycle: Record<AppTheme, AppTheme> = {
      light: 'dark',
      dark: 'system',
      system: 'light'
    };
    setTheme(cycle[theme]);
  };

  const handleToggleLanguage = (): void => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  };

  const getThemeIcon = (): React.ReactNode => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4 text-amber-500" />;
      case 'dark':
        return <Moon className="h-4 w-4 text-blue-400" />;
      case 'system':
      default:
        return <Laptop className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getThemeLabel = (): string => {
    switch (theme) {
      case 'light':
        return t.settings.appearance.light;
      case 'dark':
        return t.settings.appearance.dark;
      case 'system':
      default:
        return t.settings.appearance.system;
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur app-drag-region">
      <div className="flex items-center gap-3 app-no-drag">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none"
          title={t.header.toggleSidebar}
          aria-label={t.header.toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <AudioWaveform className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs font-medium text-muted-foreground">
            {routeTitles[activeRoute]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 app-no-drag">
        {/* Language switch button */}
        <button
          onClick={handleToggleLanguage}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none"
          title={t.header.languageTitle}
        >
          <Globe className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">{language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
        </button>

        {/* Theme toggle button */}
        <button
          onClick={handleCycleTheme}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none"
          title={`${t.header.themeTitle}: ${getThemeLabel()}`}
        >
          {getThemeIcon()}
          <span className="hidden sm:inline">{getThemeLabel()}</span>
        </button>
      </div>
    </header>
  );
};
