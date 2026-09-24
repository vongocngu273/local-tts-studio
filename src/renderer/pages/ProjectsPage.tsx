import React, { useEffect, useState, useCallback } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  Folder,
  Copy,
  Edit2,
  Trash2,
  ExternalLink,
  Clock,
  FileText,
  AlertTriangle,
  X,
  Check
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAppStore, useTranslation } from '../stores/app.store';
import { useProjectEditorStore } from '../stores/projectEditor.store';
import type { Project, ProjectSortOption } from '@shared/types/project.types';

export const ProjectsPage: React.FC = () => {
  const { setActiveRoute } = useAppStore();
  const { loadProject, currentProject, closeProject } = useProjectEditorStore();
  const { t } = useTranslation();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<ProjectSortOption>('recently_updated');

  // Modals state
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchProjects = useCallback(async () => {
    if (!window.localTTS?.projects) return;
    try {
      setLoading(true);
      const list = await window.localTTS.projects.list({
        search: searchQuery.trim() || undefined,
        sort: sortOption
      });
      setProjects(list);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortOption]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  const handleCreateNewProject = async () => {
    if (!window.localTTS?.projects) return;
    try {
      setIsSubmitting(true);
      const newProj = await window.localTTS.projects.create();
      await loadProject(newProj.id);
      setActiveRoute('tts');
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenProject = async (project: Project) => {
    await loadProject(project.id);
    setActiveRoute('tts');
  };

  const handleOpenFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.localTTS?.projects) return;
    try {
      await window.localTTS.projects.openFolder(id);
    } catch (err) {
      console.error('Failed to open project folder:', err);
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.localTTS?.projects) return;
    try {
      await window.localTTS.projects.duplicate(id);
      await fetchProjects();
    } catch (err) {
      console.error('Failed to duplicate project:', err);
    }
  };

  const openRenameModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setRenameTarget(project);
    setRenameValue(project.name);
  };

  const handleSaveRename = async () => {
    if (!renameTarget || !renameValue.trim() || !window.localTTS?.projects) return;
    try {
      setIsSubmitting(true);
      await window.localTTS.projects.rename(renameTarget.id, renameValue.trim());
      if (currentProject?.id === renameTarget.id) {
        await loadProject(renameTarget.id);
      }
      setRenameTarget(null);
      await fetchProjects();
    } catch (err) {
      console.error('Failed to rename project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDeleteTarget(project);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !window.localTTS?.projects) return;
    try {
      setIsSubmitting(true);
      await window.localTTS.projects.remove(deleteTarget.id);
      if (currentProject?.id === deleteTarget.id) {
        await closeProject();
      }
      setDeleteTarget(null);
      await fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t.projects.title}</h1>
          <p className="text-xs text-muted-foreground">{t.projects.subtitle}</p>
        </div>

        <button
          onClick={handleCreateNewProject}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t.projects.newProject}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.projects.searchPlaceholder}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <label htmlFor="projects-sort-select" className="text-xs text-muted-foreground whitespace-nowrap">
            {t.projects.sortLabel}
          </label>
          <select
            id="projects-sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as ProjectSortOption)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="recently_updated">{t.projects.sortUpdated}</option>
            <option value="recently_created">{t.projects.sortCreated}</option>
            <option value="name_asc">{t.projects.sortNameAsc}</option>
            <option value="name_desc">{t.projects.sortNameDesc}</option>
          </select>
        </div>
      </div>

      {/* Projects List or Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          <span>{t.common.checking}</span>
        </div>
      ) : projects.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon={Search}
            title={t.projects.noSearchResultsTitle}
            description={t.projects.noSearchResultsDesc}
            action={
              <button
                onClick={() => setSearchQuery('')}
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Clear filter
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={FolderOpen}
            title={t.projects.emptyTitle}
            description={t.projects.emptyDesc}
            action={
              <button
                onClick={handleCreateNewProject}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.projects.newProject}</span>
              </button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const isCurrent = currentProject?.id === proj.id;
            const wordCount = proj.originalText.trim() === '' ? 0 : proj.originalText.trim().split(/\s+/).length;
            const charCount = proj.originalText.length;

            return (
              <div
                key={proj.id}
                onClick={() => handleOpenProject(proj)}
                className={`group relative flex flex-col justify-between rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-all hover:border-primary/50 hover:shadow cursor-pointer ${
                  isCurrent ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Folder className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors" title={proj.name}>
                        {proj.name}
                      </h3>
                    </div>

                    <StatusBadge
                      label={proj.status === 'draft' ? 'Draft' : proj.status}
                      variant={proj.status === 'draft' ? 'pending' : 'ready'}
                      className="shrink-0 text-[10px] py-0 px-2"
                    />
                  </div>

                  <p className="line-clamp-2 text-xs text-muted-foreground min-h-[2.5rem] mb-3">
                    {proj.originalText ? proj.originalText : <span className="italic opacity-60">No script content yet...</span>}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{wordCount} {t.projects.wordsCount}</span>
                      </span>
                      <span>{charCount} {t.projects.charsCount}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px]" title={proj.updatedAt}>
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(proj.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex items-center justify-end gap-1 pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleOpenFolder(e, proj.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.projects.openFolder}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => openRenameModal(e, proj)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.projects.rename}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDuplicate(e, proj.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.projects.duplicate}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => openDeleteModal(e, proj)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title={t.projects.delete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RENAME MODAL */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-sm font-semibold text-foreground mb-1">{t.projects.rename}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t.tts.renamePrompt}</p>

            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') setRenameTarget(null);
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={!renameValue.trim() || isSubmitting}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{t.common.save}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-destructive mb-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-semibold text-foreground">{t.projects.confirmDeleteTitle}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              <strong className="text-foreground font-semibold">&ldquo;{deleteTarget.name}&rdquo;</strong>{' '}
              {t.projects.confirmDeleteMessage}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.common.delete}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
