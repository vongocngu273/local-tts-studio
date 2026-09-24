import React, { useEffect, useState } from 'react';
import {
  Settings,
  HardDrive,
  Radio,
  Palette,
  Cpu,
  FolderOpen,
  CheckCircle2,
  ExternalLink,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import { useAppStore, AppTheme, useTranslation } from '../stores/app.store';
import {
  APP_NAME,
  APP_ID,
  APP_VERSION,
  APP_AUTHOR,
  APP_YEAR,
  APP_COPYRIGHT
} from '@shared/constants/app.constants';
import type { AppPaths } from '@shared/schemas/app.schema';
import type { SystemInfo, FFmpegStatus } from '@shared/schemas/system.schema';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { Language } from '../i18n/translations';
import { useProviderStore } from '../stores/provider.store';
import { ProviderCard } from '../components/providers/ProviderCard';

type SettingsTab = 'general' | 'storage' | 'providers' | 'appearance' | 'system';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, language, setLanguage } = useAppStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [ffmpegStatus, setFfmpegStatus] = useState<FFmpegStatus | null>(null);
  const [opening, setOpening] = useState(false);
  const [isTestingFFmpeg, setIsTestingFFmpeg] = useState(false);

  const handleTestFFmpeg = async () => {
    setIsTestingFFmpeg(true);
    try {
      if (window.localTTS?.ffmpeg) {
        const status = await window.localTTS.ffmpeg.getStatus();
        setFfmpegStatus({
          available: status.available,
          version: status.version,
          path: status.ffmpegPath,
          error: status.error
        });
      }
    } finally {
      setIsTestingFFmpeg(false);
    }
  };

  const {
    providers,
    testingProviderId,
    testResults,
    fetchProviders,
    setSecret,
    deleteSecret,
    updateSettings,
    testConnection
  } = useProviderStore();

  useEffect(() => {
    const loadDiagnostics = async (): Promise<void> => {
      try {
        if (window.localTTS?.app) {
          const loadedPaths = await window.localTTS.app.getPaths();
          setPaths(loadedPaths);
        }
        if (window.localTTS?.system) {
          const sys = await window.localTTS.system.getInfo();
          setSystemInfo(sys);
          const ffmpeg = await window.localTTS.system.getFFmpegStatus();
          setFfmpegStatus(ffmpeg);
        }
        fetchProviders();
      } catch (err) {
        console.error('Failed to load settings telemetry:', err);
      }
    };

    loadDiagnostics();
  }, [fetchProviders]);

  const handleOpenWorkspace = async (): Promise<void> => {
    if (!window.localTTS?.app) return;
    try {
      setOpening(true);
      await window.localTTS.app.openWorkspace();
    } catch (err) {
      console.error('Failed to open workspace directory:', err);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t.settings.title}</h1>
        <p className="text-xs text-muted-foreground">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-border space-x-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'general'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>{t.settings.tabs.general}</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'storage'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <HardDrive className="h-3.5 w-3.5" />
          <span>{t.settings.tabs.storage}</span>
        </button>

        <button
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'providers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>{t.settings.tabs.providers}</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'appearance'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>{t.settings.tabs.appearance}</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
            activeTab === 'system'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>{t.settings.tabs.system}</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">{t.settings.general.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.general.appName}</div>
                  <div className="font-semibold text-foreground">{APP_NAME}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.general.appId}</div>
                  <div className="font-mono text-foreground">{APP_ID}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.general.version}</div>
                  <div className="font-mono font-medium text-foreground">v{systemInfo?.appVersion || APP_VERSION}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.general.releaseYear}</div>
                  <div className="font-mono text-foreground">{APP_YEAR}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.general.author}</div>
                  <div className="font-medium text-primary">{APP_AUTHOR}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.general.architectureModel}</div>
                  <div className="font-medium text-foreground">{t.settings.general.localFirstDesc}</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 md:col-span-2">
                  <div className="text-muted-foreground mb-1">{t.settings.general.copyright}</div>
                  <div className="font-medium text-foreground">{APP_COPYRIGHT}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STORAGE TAB */}
        {activeTab === 'storage' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{t.settings.storage.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {t.settings.storage.subtitle}
                  </p>
                </div>
                <button
                  onClick={handleOpenWorkspace}
                  disabled={opening || !paths}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>{opening ? t.common.opening : t.settings.storage.openInExplorer}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {paths &&
                  Object.entries(paths).map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 font-mono"
                    >
                      <span className="font-medium text-muted-foreground capitalize w-28">{key}:</span>
                      <span className="truncate text-foreground select-all text-[11px]" title={val}>
                        {val}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* PROVIDERS TAB */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <h2 className="text-sm font-semibold text-foreground mb-1">{t.settings.providers.title}</h2>
              <p className="text-xs text-muted-foreground">
                {t.settings.providers.subtitle}
              </p>
            </div>

            <div className="space-y-4">
              {providers.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isTesting={testingProviderId === provider.id}
                  testResult={testResults[provider.id]}
                  onTest={(id) => testConnection(id)}
                  onSaveKey={(id, key) => setSecret(id, key)}
                  onDeleteKey={(id) => deleteSecret(id)}
                  onToggleEnabled={(id, enabled) => updateSettings({ providerId: id, enabled })}
                />
              ))}
            </div>
          </div>
        )}

        {/* APPEARANCE & LANGUAGE TAB */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* Language Selection */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">{t.settings.appearance.languageTitle}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {t.settings.appearance.languageSubtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { code: 'vi' as Language, label: 'Tiếng Việt', flag: '🇻🇳' },
                  { code: 'en' as Language, label: 'English', flag: '🇬🇧' }
                ].map((item) => {
                  const isSelected = language === item.code;
                  return (
                    <button
                      key={item.code}
                      onClick={() => setLanguage(item.code)}
                      className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border bg-card hover:bg-accent text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.flag}</span>
                        <span className="font-semibold text-sm">{item.label}</span>
                      </div>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t.settings.appearance.active}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Selection */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">{t.settings.appearance.themeTitle}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {t.settings.appearance.themeSubtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['light', 'dark', 'system'] as AppTheme[]).map((themeOption) => {
                  const isSelected = theme === themeOption;
                  return (
                    <button
                      key={themeOption}
                      onClick={() => setTheme(themeOption)}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border bg-card hover:bg-accent text-foreground'
                      }`}
                    >
                      {themeOption === 'light' && <Sun className="h-5 w-5 text-amber-500" />}
                      {themeOption === 'dark' && <Moon className="h-5 w-5 text-blue-400" />}
                      {themeOption === 'system' && <Laptop className="h-5 w-5 text-muted-foreground" />}
                      <span className="capitalize">
                        {themeOption === 'light'
                          ? t.settings.appearance.light
                          : themeOption === 'dark'
                          ? t.settings.appearance.dark
                          : t.settings.appearance.system}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] text-primary">
                          <CheckCircle2 className="h-3 w-3" /> {t.settings.appearance.active}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM TAB */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">{t.settings.system.title}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-6">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.system.platform}</div>
                  <div className="font-medium text-foreground">{systemInfo?.platform} ({systemInfo?.os})</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.system.arch}</div>
                  <div className="font-mono text-foreground">{systemInfo?.arch}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.system.cpu}</div>
                  <div className="font-medium text-foreground truncate" title={systemInfo?.cpuModel}>
                    {systemInfo?.cpuCores} {t.dashboard.coresUnit} • {systemInfo?.cpuModel}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.system.memory}</div>
                  <div className="font-medium text-foreground">
                    {systemInfo?.freeRamFormatted} {t.dashboard.freeOf} {systemInfo?.totalRamFormatted}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.system.nodeEngine}</div>
                  <div className="font-mono text-foreground">{systemInfo?.nodeVersion}</div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="text-muted-foreground mb-1">{t.settings.system.electronEngine}</div>
                  <div className="font-mono text-foreground">{systemInfo?.electronVersion}</div>
                </div>
              </div>

              {/* FFmpeg status section */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">{t.settings.system.ffmpegTitle}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {t.settings.system.ffmpegDesc}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ffmpegStatus?.available ? (
                      <StatusBadge label={t.common.ready} variant="ready" />
                    ) : (
                      <StatusBadge label={t.common.notConfigured} variant="warning" />
                    )}
                    <button
                      type="button"
                      onClick={handleTestFFmpeg}
                      disabled={isTestingFFmpeg}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors disabled:opacity-50"
                    >
                      {isTestingFFmpeg ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
                    </button>
                  </div>
                </div>

                {ffmpegStatus?.available && (
                  <div className="text-[11px] text-muted-foreground font-mono space-y-0.5 pt-2 border-t border-border/40">
                    <div>Phiên bản: {ffmpegStatus.version || 'FFmpeg 9.x'}</div>
                    {ffmpegStatus.path && <div className="truncate">Đường dẫn: {ffmpegStatus.path}</div>}
                  </div>
                )}
                {ffmpegStatus && !ffmpegStatus.available && ffmpegStatus.error && (
                  <div className="text-[11px] text-destructive pt-2 border-t border-border/40">
                    Lỗi: {ffmpegStatus.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
