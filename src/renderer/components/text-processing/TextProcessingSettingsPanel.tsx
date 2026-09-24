import React from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  BookOpen,
  Calendar,
  Hash,
  Coins,
  FileText,
  Space,
  Save
} from 'lucide-react';
import { useTextProcessingStore } from '../../stores/textProcessing.store';
import { useTranslation } from '../../stores/app.store';
import type { ProviderScope } from '@shared/types/dictionary.types';

interface TextProcessingSettingsPanelProps {
  projectId?: string;
  originalText: string;
  onProcessed?: () => void;
}

export const TextProcessingSettingsPanel: React.FC<TextProcessingSettingsPanelProps> = ({
  projectId,
  originalText,
  onProcessed
}) => {
  const { t } = useTranslation();
  const {
    settings,
    processing,
    updateSettings,
    preview,
    processProject
  } = useTextProcessingStore();

  const handlePreview = async () => {
    if (!originalText.trim()) return;
    await preview(originalText);
    if (onProcessed) onProcessed();
  };

  const handleSaveProcessed = async () => {
    if (!projectId) return;
    await processProject(projectId);
    if (onProcessed) onProcessed();
  };

  const toggles = [
    {
      key: 'dictionaryEnabled' as const,
      label: t.textProcessing.dictionaryToggle,
      hint: t.textProcessing.dictionaryHint,
      icon: BookOpen,
      checked: settings.dictionaryEnabled,
      onChange: (val: boolean) => updateSettings({ dictionaryEnabled: val })
    },
    {
      key: 'whitespaceNormalization' as const,
      label: t.textProcessing.whitespaceToggle,
      hint: t.textProcessing.whitespaceHint,
      icon: Space,
      checked: settings.whitespaceNormalization,
      onChange: (val: boolean) => updateSettings({ whitespaceNormalization: val })
    },
    {
      key: 'dateNormalization' as const,
      label: t.textProcessing.dateToggle,
      hint: t.textProcessing.dateHint,
      icon: Calendar,
      checked: settings.dateNormalization,
      onChange: (val: boolean) => updateSettings({ dateNormalization: val })
    },
    {
      key: 'numberNormalization' as const,
      label: t.textProcessing.numberToggle,
      hint: t.textProcessing.numberHint,
      icon: Hash,
      checked: settings.numberNormalization,
      onChange: (val: boolean) => updateSettings({ numberNormalization: val })
    },
    {
      key: 'currencyNormalization' as const,
      label: t.textProcessing.currencyToggle,
      hint: t.textProcessing.currencyHint,
      icon: Coins,
      checked: settings.currencyNormalization,
      onChange: (val: boolean) => updateSettings({ currencyNormalization: val })
    },
    {
      key: 'abbreviationNormalization' as const,
      label: t.textProcessing.abbreviationToggle,
      hint: t.textProcessing.abbreviationHint,
      icon: FileText,
      checked: settings.abbreviationNormalization,
      onChange: (val: boolean) => updateSettings({ abbreviationNormalization: val })
    }
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.textProcessing.panelTitle}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            data-testid="tp-provider-select"
            value={settings.providerContext}
            onChange={(e) => updateSettings({ providerContext: e.target.value as ProviderScope })}
            aria-label={t.textProcessing.providerContext}
            className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">{t.dictionary.allProviders}</option>
            <option value="EDGE">Edge TTS</option>
            <option value="LUCYLAB">LucyLab</option>
            <option value="ELEVENLABS">ElevenLabs</option>
            <option value="VBEE">Vbee</option>
          </select>
        </div>
      </div>

      {/* Normalizer Toggles */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {toggles.map((item) => {
          const Icon = item.icon;
          return (
            <label
              key={item.key}
              data-testid={`tp-toggle-${item.key}`}
              title={`${item.label} (${item.hint})`}
              className={`flex items-start gap-2.5 p-2.5 min-h-[64px] rounded-lg border transition-all cursor-pointer select-none ${
                item.checked
                  ? 'bg-primary/10 border-primary/40 text-foreground shadow-xs'
                  : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 mt-0.5 shrink-0"
              />
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium leading-snug break-words whitespace-normal">
                  {item.label}
                </span>
                <span className="text-[10px] leading-relaxed break-words whitespace-normal text-slate-400 mt-0.5">
                  {item.hint}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          data-testid="tp-preview-btn"
          onClick={handlePreview}
          disabled={processing || !originalText.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>{processing ? t.textProcessing.processingStatus : t.textProcessing.previewBtn}</span>
        </button>

        {projectId && (
          <button
            type="button"
            data-testid="tp-save-processed-btn"
            onClick={handleSaveProcessed}
            disabled={processing || !originalText.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{processing ? t.textProcessing.processingStatus : t.textProcessing.processProjectBtn}</span>
          </button>
        )}
      </div>
    </div>
  );
};
