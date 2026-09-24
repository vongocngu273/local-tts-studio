import React, { useEffect, useState } from 'react';
import { FolderPlus, ArrowRight, FolderKanban, Clock, FileText, ChevronRight } from 'lucide-react';
import { SystemStatusCard } from '../components/ui/SystemStatusCard';
import { LocalStorageCard } from '../components/ui/LocalStorageCard';
import { ProviderStatusCard } from '../components/ui/ProviderStatusCard';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore, useTranslation } from '../stores/app.store';
import { useProjectEditorStore } from '../stores/projectEditor.store';
import { APP_NAME } from '@shared/constants/app.constants';
import type { Project } from '@shared/types/project.types';

export const DashboardPage: React.FC = () => {
  const { setActiveRoute } = useAppStore();
  const { loadProject } = useProjectEditorStore();
  const { t } = useTranslation();

  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadRecent = async () => {
      if (!window.localTTS?.projects) return;
      try {
        setLoading(true);
        const list = await window.localTTS.projects.list({
          limit: 5,
          sort: 'recently_updated'
        });
        if (isMounted) {
          setRecentProjects(list);
        }
      } catch (err) {
        console.error('Failed to load recent projects on dashboard:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRecent();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenProject = async (project: Project) => {
    await loadProject(project.id);
    setActiveRoute('tts');
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.dashboard.subtitle}
          </p>
        </div>

        <button
          onClick={() => setActiveRoute('tts')}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none"
        >
          <span>{t.dashboard.startSynthesis}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid of status and storage cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <SystemStatusCard />
        <LocalStorageCard />
        <ProviderStatusCard />
      </div>

      {/* Recent Projects Card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <FolderKanban className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.dashboard.recentProjects}</h3>
              <p className="text-xs text-muted-foreground">{t.dashboard.recentProjectsDesc}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveRoute('projects')}
            className="text-xs font-medium text-primary hover:underline"
          >
            {recentProjects.length > 0 ? `${recentProjects.length} ${t.dashboard.totalProjectsCount}` : `0 ${t.dashboard.totalProjectsCount}`}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            <span>Loading recent projects...</span>
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title={t.dashboard.noProjectsTitle}
            description={t.dashboard.noProjectsDesc}
            action={
              <button
                onClick={() => setActiveRoute('tts')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                {t.dashboard.openStudioBtn}
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {recentProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => handleOpenProject(proj)}
                className="flex items-center justify-between py-3 px-2 hover:bg-accent/40 rounded-lg transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {proj.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {proj.originalText || 'No script text'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 pl-3">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {formatDate(proj.updatedAt)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
