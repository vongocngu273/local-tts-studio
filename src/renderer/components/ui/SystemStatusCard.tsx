import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, RefreshCw } from 'lucide-react';
import type { SystemInfo } from '@shared/schemas/system.schema';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from '../../stores/app.store';

export const SystemStatusCard: React.FC = () => {
  const { t } = useTranslation();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemInfo = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      if (window.localTTS?.system) {
        const info = await window.localTTS.system.getInfo();
        setSystemInfo(info);
      } else {
        throw new Error('LocalTTS IPC API not available');
      }
    } catch (err) {
      console.error('Failed to load system information:', err);
      setError('Could not retrieve hardware diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Cpu className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{t.dashboard.systemStatus}</h3>
          </div>
          {loading ? (
            <StatusBadge label={t.common.checking} variant="pending" />
          ) : systemInfo?.localProcessingReady ? (
            <StatusBadge label={t.common.localProcessingReady} variant="ready" />
          ) : (
            <StatusBadge label={t.common.degraded} variant="warning" />
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="mt-4 flex items-center justify-center py-6 text-xs text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> {t.common.fetchingTelemetry}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">{t.dashboard.os}:</span>
              <span className="font-medium text-foreground">{systemInfo?.os}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">{t.dashboard.arch}:</span>
              <span className="font-mono font-medium text-foreground">{systemInfo?.arch}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">{t.dashboard.cpuModel}:</span>
              <span className="truncate max-w-[200px] font-medium text-foreground" title={systemInfo?.cpuModel}>
                {systemInfo?.cpuModel}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">{t.dashboard.cpuCores}:</span>
              <span className="font-medium text-foreground">{systemInfo?.cpuCores} {t.dashboard.coresUnit}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">{t.dashboard.memory}:</span>
              <span className="font-medium text-foreground">
                {systemInfo?.freeRamFormatted} {t.dashboard.freeOf} {systemInfo?.totalRamFormatted}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">{t.dashboard.runtime}:</span>
              <span className="font-mono text-muted-foreground">
                Node {systemInfo?.nodeVersion} • Electron {systemInfo?.electronVersion}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>{t.common.isolatedRuntime}</span>
      </div>
    </div>
  );
};
