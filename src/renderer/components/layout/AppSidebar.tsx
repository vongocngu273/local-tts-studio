import React from 'react';
import {
  LayoutDashboard,
  AudioLines,
  FolderOpen,
  History,
  Mic2,
  SlidersHorizontal,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAppStore, AppRoute, useTranslation } from '../../stores/app.store';
import { APP_VERSION, APP_AUTHOR, APP_YEAR, APP_COPYRIGHT } from '@shared/constants/app.constants';
import { clsx } from 'clsx';

export const AppSidebar: React.FC = () => {
  const { activeRoute, setActiveRoute, sidebarCollapsed, toggleSidebar } = useAppStore();
  const { t } = useTranslation();

  const navItems = [
    { id: 'dashboard' as AppRoute, label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'tts' as AppRoute, label: t.nav.tts, icon: AudioLines },
    { id: 'projects' as AppRoute, label: t.nav.projects, icon: FolderOpen },
    { id: 'history' as AppRoute, label: t.nav.history, icon: History },
    { id: 'voices' as AppRoute, label: t.nav.voices, icon: Mic2 },
    { id: 'presets' as AppRoute, label: t.nav.presets, icon: SlidersHorizontal },
    { id: 'dictionary' as AppRoute, label: t.nav.dictionary, icon: BookOpen },
    { id: 'settings' as AppRoute, label: t.nav.settings, icon: Settings }
  ];

  return (
    <aside
      className={clsx(
        'relative flex flex-col border-r border-border bg-card transition-all duration-200 ease-in-out select-none',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Workspace branding header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-3.5">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="truncate text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              {t.nav.workspace}
            </span>
          </div>
        ) : (
          <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveRoute(item.id)}
              className={clsx(
                'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon
                className={clsx(
                  'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {!sidebarCollapsed && <span className="truncate text-left">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom system status badge & copyright footer */}
      <div className="border-t border-border p-3 space-y-2">
        {!sidebarCollapsed ? (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-[11px] font-medium text-foreground">{t.nav.localEngine}</span>
                <span className="truncate text-[10px] text-muted-foreground">{t.nav.readyOffline}</span>
              </div>
            </div>
            <div className="text-center text-[10px] text-muted-foreground/70 font-mono tracking-tight select-none pt-0.5">
              v{APP_VERSION} • © {APP_YEAR} {APP_AUTHOR}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5" title={`${APP_COPYRIGHT} (v${APP_VERSION})`}>
            <div className="flex justify-center" title={`${t.nav.localEngine}: ${t.nav.readyOffline}`}>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <span className="text-[9px] text-muted-foreground/70 font-mono tracking-tighter select-none">
              © {APP_YEAR}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
