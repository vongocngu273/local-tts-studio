import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useTranslation } from '../stores/app.store';

export const VoicePresetsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t.presets.title}</h1>
        <p className="text-xs text-muted-foreground">{t.presets.subtitle}</p>
      </div>

      <EmptyState
        icon={SlidersHorizontal}
        title={t.presets.emptyTitle}
        description={t.presets.emptyDesc}
      />
    </div>
  );
};
