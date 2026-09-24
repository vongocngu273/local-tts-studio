import React, { useEffect, useState } from 'react';
import { FolderOpen, ExternalLink, HardDrive } from 'lucide-react';
import type { AppPaths } from '@shared/schemas/app.schema';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from '../../stores/app.store';

export const LocalStorageCard: React.FC = () => {
  const { t } = useTranslation();
  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const fetchPaths = async (): Promise<void> => {
      try {
        if (window.localTTS?.app) {
          const appPaths = await window.localTTS.app.getPaths();
          setPaths(appPaths);
        }
      } catch (err) {
        console.error('Failed to load app paths:', err);
      }
    };
    fetchPaths();
  }, []);

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
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <HardDrive className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{t.dashboard.localWorkspace}</h3>
          </div>
          <StatusBadge label={t.common.workspaceReady} variant="ready" />
        </div>

        <div className="mt-4 space-y-3 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">{t.dashboard.projectsStorage}:</div>
            <div
              className="truncate rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground select-all"
              title={paths?.projects}
            >
              {paths?.projects || t.common.checking}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">{t.dashboard.databaseStorage}:</div>
            <div
              className="truncate rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground select-all"
              title={paths?.database}
            >
              {paths?.database || t.common.checking}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{t.dashboard.standardUserData}</span>
        <button
          onClick={handleOpenWorkspace}
          disabled={opening || !paths}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>{opening ? t.common.opening : t.common.openWorkspace}</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </button>
      </div>
    </div>
  );
};
