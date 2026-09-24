import React from 'react';
import { useAppStore } from '../stores/app.store';
import { DashboardPage } from '../pages/DashboardPage';
import { TextToSpeechPage } from '../pages/TextToSpeechPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { HistoryPage } from '../pages/HistoryPage';
import { VoicesPage } from '../pages/VoicesPage';
import { VoicePresetsPage } from '../pages/VoicePresetsPage';
import { PronunciationDictionaryPage } from '../pages/PronunciationDictionaryPage';
import { SettingsPage } from '../pages/SettingsPage';

export const AppRouter: React.FC = () => {
  const { activeRoute } = useAppStore();

  switch (activeRoute) {
    case 'dashboard':
      return <DashboardPage />;
    case 'tts':
      return <TextToSpeechPage />;
    case 'projects':
      return <ProjectsPage />;
    case 'history':
      return <HistoryPage />;
    case 'voices':
      return <VoicesPage />;
    case 'presets':
      return <VoicePresetsPage />;
    case 'dictionary':
      return <PronunciationDictionaryPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
};
