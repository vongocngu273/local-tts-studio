import React, { useEffect } from 'react';
import { Radio, ExternalLink } from 'lucide-react';
import { DEFAULT_PROVIDERS } from '@shared/types/provider.types';
import { StatusBadge } from './StatusBadge';
import { useTranslation, useAppStore } from '../../stores/app.store';
import { useProviderStore } from '../../stores/provider.store';

export const ProviderStatusCard: React.FC = () => {
  const { t } = useTranslation();
  const { setActiveRoute } = useAppStore();
  const { providers, fetchProviders, isLoading } = useProviderStore();

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Combine loaded live providers with DEFAULT_PROVIDERS
  const displayProviders = DEFAULT_PROVIDERS.map((def) => {
    const live = providers.find((p) => p.id === def.id);
    return live || {
      ...def,
      hasApiKey: false,
      capabilities: {
        requiresApiKey: def.id !== 'edge-tts'
      },
      voicesCount: 0
    };
  });

  const readyCount = displayProviders.filter((p) => p.enabled && p.configured).length;
  const isAnyReady = readyCount > 0;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Radio className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{t.dashboard.ttsProviders}</h3>
          </div>
          {isLoading && providers.length === 0 ? (
            <StatusBadge label={t.common.checking} variant="pending" />
          ) : isAnyReady ? (
            <StatusBadge label={`${readyCount} ${t.common.ready.toLowerCase()}`} variant="ready" />
          ) : (
            <StatusBadge label={t.common.notConfigured} variant="warning" />
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {t.dashboard.ttsProvidersDesc}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {displayProviders.map((provider) => {
            const isReady = provider.enabled && provider.configured;
            return (
              <div
                key={provider.id}
                onClick={() => setActiveRoute('settings')}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 hover:border-primary/40 hover:bg-muted/60 transition-colors cursor-pointer group"
                title={`Nhấn để cấu hình ${provider.name} trong Cài đặt`}
              >
                <div className="flex flex-col truncate pr-1">
                  <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {provider.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {provider.voicesCount && provider.voicesCount > 0
                      ? `${provider.voicesCount} giọng`
                      : provider.capabilities?.requiresApiKey
                        ? 'Cần API Key'
                        : 'Miễn phí'}
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {isReady ? (
                    <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {t.common.ready}
                    </span>
                  ) : !provider.enabled ? (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Đã tắt
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/80 font-mono">
                      {t.common.inactive}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
        <span>{t.common.isolatedRuntime}</span>
        <button
          onClick={() => setActiveRoute('settings')}
          className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-[11px]"
        >
          <span>{t.settings.providers.configureBtn}</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
