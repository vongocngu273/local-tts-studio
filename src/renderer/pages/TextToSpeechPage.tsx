import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  Sliders,
  Play,
  Sparkles,
  RotateCcw,
  Clipboard,
  FileText,
  AlertTriangle,
  AlertCircle,
  FolderOpen,
  Plus,
  ExternalLink,
  Save,
  CheckCircle2,
  Clock,
  Edit2,
  X,
  BookOpen,
  RefreshCw,
  Layers,
  Volume2,
  Subtitles,
  Download
} from 'lucide-react';
import { useAppStore, useTranslation } from '../stores/app.store';
import { useProjectEditorStore } from '../stores/projectEditor.store';
import { useTextProcessingStore } from '../stores/textProcessing.store';
import { useDictionaryStore } from '../stores/dictionary.store';
import { useProviderStore } from '../stores/provider.store';
import { useVoiceStore } from '../stores/voice.store';
import { useGenerationStore } from '../stores/generation.store';
import { useSegmentStore } from '../stores/segment.store';
import { useCompositionStore } from '../stores/composition.store';
import { AudioPlayer } from '../components/audio/AudioPlayer';
import { EmptyState } from '../components/ui/EmptyState';
import { TextProcessingSettingsPanel } from '../components/text-processing/TextProcessingSettingsPanel';
import { TextProcessingDiffViewer } from '../components/text-processing/TextProcessingDiffViewer';
import { RuleEditorModal } from '../components/dictionary/RuleEditorModal';
import { QueueControlBar } from '../components/segments/QueueControlBar';
import { SegmentList } from '../components/segments/SegmentList';
import { WaveformTimeline } from '../components/audio/WaveformTimeline';
import { SubtitleViewer } from '../components/subtitles/SubtitleViewer';
import { ExportPanel } from '../components/export/ExportPanel';
import { DEFAULT_PROVIDERS, type ProviderId } from '@shared/types/provider.types';
import type { ProjectExportOptions } from '@shared/types/export.types';

export const TextToSpeechPage: React.FC = () => {
  const { ttsDraft, updateTtsDraft, clearTtsDraft, setActiveRoute } = useAppStore();
  const { t } = useTranslation();

  const {
    currentProject,
    originalText,
    dirty,
    saveStatus,
    lastSavedAt,
    recoveryDraft,
    isLoading,
    loadProject,
    setOriginalText,
    saveNow,
    recoverDraft,
    discardRecovery,
    renameCurrentProject,
    closeProject
  } = useProjectEditorStore();

  const {
    result: textProcessingResult,
    isStale: textProcessingIsStale,
    processing: isTextProcessing,
    updateSettings: updateTextProcessingSettings,
    preview: previewTextProcessing,
    processProject: saveProcessedProject,
    setIsStale: setTextProcessingIsStale,
    setResult: setTextProcessingResult
  } = useTextProcessingStore();

  const { dictionaryRevision, fetchRules } = useDictionaryStore();
  const { providers, fetchProviders } = useProviderStore();
  const { voices, fetchVoices } = useVoiceStore();
  const {
    activeProjectGeneration,
    isGenerating,
    isPreviewing,
    generateProjectAudio,
    previewVoice,
    loadGenerations
  } = useGenerationStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [activeTab, setActiveTab] = useState<'original' | 'processed'>('original');

  // Studio tabs (Phase 5)
  type StudioTab = 'script' | 'segments' | 'audio' | 'subtitle' | 'export';
  const [studioTab, setStudioTab] = useState<StudioTab>('script');

  const {
    segments,
    queueStatus,
    isBuilding: isBuildingSegments,
    selectedSegment,
    loadSegments,
    buildSegments,
    startQueue,
    pauseQueue,
    resumeQueue,
    cancelQueue,
    regenerateSegment,
    updateOverride,
    resetOverride,
    setSelectedSegment,
    handleQueueEvent
  } = useSegmentStore();

  const {
    composition,
    cues,
    isComposing,
    isExporting,
    isLoadingCues,
    lastExportResult,
    loadLatestComposition,
    composeAudio,
    loadCues,
    exportSubtitles,
    exportBundle
  } = useCompositionStore();

  // Mini preview audio player state
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  useEffect(() => {
    const audio = previewAudioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, []);

  // Quick add to dictionary state
  const [quickAddRule, setQuickAddRule] = useState<{ term: string } | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch providers, voices, and project generations
  useEffect(() => {
    fetchProviders();
    fetchVoices();
    if (currentProject?.id) {
      loadGenerations(currentProject.id);
      loadSegments(currentProject.id);
      loadLatestComposition(currentProject.id);
      loadCues(currentProject.id);
    }
  }, [currentProject?.id, fetchProviders, fetchVoices, loadGenerations, loadSegments, loadLatestComposition, loadCues]);

  // Listen to queue events
  useEffect(() => {
    if (!currentProject?.id) return;
    const unsub = window.localTTS.queue.onEvent((event) => {
      handleQueueEvent(event);
      if (currentProject?.id && (event.type === 'job:completed' || event.type === 'job:failed')) {
        loadSegments(currentProject.id);
        loadCues(currentProject.id);
      }
    });
    return () => unsub();
  }, [currentProject?.id, handleQueueEvent, loadSegments, loadCues]);

  // Keyboard shortcut: Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentProject && dirty) {
          saveNow();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProject, dirty, saveNow]);

  // Sync settings when project loads
  const currentTextProcessing = currentProject?.settings?.textProcessing;
  useEffect(() => {
    if (currentTextProcessing) {
      updateTextProcessingSettings(currentTextProcessing);
    }
  }, [currentProject?.id, currentTextProcessing, updateTextProcessingSettings]);

  // Compute stale status
  const isStale = useMemo(() => {
    if (!currentProject) return false;
    if (textProcessingIsStale) return true;

    const procMeta = currentProject.settings?.textProcessing;
    if (procMeta?.processedFromRevision !== undefined) {
      if (currentProject.revision > procMeta.processedFromRevision) return true;
    }
    if (procMeta?.processedWithDictionaryRevision !== undefined) {
      if (dictionaryRevision > procMeta.processedWithDictionaryRevision) return true;
    }
    return false;
  }, [currentProject, textProcessingIsStale, dictionaryRevision]);

  const handlePaste = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setOriginalText(originalText ? `${originalText}\n${text}` : text);
        setTextProcessingIsStale(true);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleClearText = () => {
    setOriginalText('');
    clearTtsDraft();
    setTextProcessingResult(null);
  };

  const handleCreateNewProject = async () => {
    if (!window.localTTS?.projects) return;
    try {
      setIsCreatingNew(true);
      const proj = await window.localTTS.projects.create();
      await loadProject(proj.id);
    } catch (err) {
      console.error('Failed to create new project:', err);
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!currentProject || !window.localTTS?.projects) return;
    try {
      await window.localTTS.projects.openFolder(currentProject.id);
    } catch (err) {
      console.error('Failed to open project folder:', err);
    }
  };

  const handleStartRename = () => {
    if (!currentProject) return;
    setEditedName(currentProject.name);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSaveRename = async () => {
    if (!currentProject || !editedName.trim()) {
      setIsEditingName(false);
      return;
    }
    try {
      await renameCurrentProject(editedName.trim());
    } catch (err) {
      console.error('Failed to rename project:', err);
    } finally {
      setIsEditingName(false);
    }
  };

  const handleQuickAddToDictionary = (termOverride?: string) => {
    let termToAdd = termOverride || '';
    if (!termToAdd && textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        termToAdd = originalText.substring(start, end).trim();
      }
    }
    setQuickAddRule({ term: termToAdd });
    setIsQuickAddOpen(true);
  };

  const handleReprocess = async () => {
    if (!originalText.trim()) return;
    if (dirty) {
      await saveNow();
    }
    if (currentProject) {
      await saveProcessedProject(currentProject.id);
      await loadProject(currentProject.id);
    } else {
      await previewTextProcessing(originalText);
    }
  };

  const availableVoices = useMemo(() => {
    return voices.filter((v) => v.providerId === ttsDraft.provider);
  }, [voices, ttsDraft.provider]);

  const activeProvider = useMemo(() => {
    return providers.find((p) => p.id === ttsDraft.provider);
  }, [providers, ttsDraft.provider]);

  // Sync default voice if current draft voice doesn't belong to selected provider
  useEffect(() => {
    if (availableVoices.length > 0) {
      const exists = availableVoices.some((v) => v.id === ttsDraft.voice);
      if (!exists) {
        updateTtsDraft({ voice: availableVoices[0].id });
      }
    }
  }, [availableVoices, ttsDraft.voice, updateTtsDraft]);

  const handlePreviewVoice = async () => {
    if (isPlayingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.removeAttribute('src');
      previewAudioRef.current.load();
      setIsPlayingPreview(false);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      const sampleText = originalText.trim().slice(0, 200) || undefined;
      const gen = await previewVoice({
        providerId: ttsDraft.provider as ProviderId,
        voiceId: ttsDraft.voice,
        text: sampleText,
        settings: {
          speed: ttsDraft.speed,
          pitch: ttsDraft.pitch,
          volume: ttsDraft.volume
        }
      });

      if (gen) {
        const url = gen.playbackUrl || `localtts-audio://generation/${gen.id}`;
        setIsPlayingPreview(true);
        if (previewAudioRef.current) {
          const audio = previewAudioRef.current;
          audio.pause();
          audio.src = url;
          audio.load();
          audio.play().catch((err: unknown) => {
            const domErr = err as { name?: string; message?: string };
            if (domErr?.name === 'AbortError') {
              return;
            }
            if (domErr?.name === 'NotAllowedError') {
              console.warn('Preview playback blocked by autoplay policy:', err);
              setGenerateError('Vui lòng tương tác với ứng dụng để phát âm thanh.');
            } else {
              console.error('Preview playback failed:', err);
              setGenerateError('Trình duyệt không thể phát âm thanh xem trước.');
            }
            setIsPlayingPreview(false);
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to preview voice:', err);
      setGenerateError(`Lỗi nghe thử giọng: ${msg}`);
      setIsPlayingPreview(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!currentProject || !originalText.trim()) return;
    setGenerateError(null);
    setGenerateSuccess(null);

    try {
      if (dirty) {
        await saveNow();
      }
      if (isStale || !currentProject.processedText?.trim()) {
        await handleReprocess();
      }

      const updatedProj = useProjectEditorStore.getState().currentProject;
      if (!updatedProj?.processedText?.trim()) {
        throw new Error('Vui lòng nhập văn bản và xử lý kịch bản trước khi tạo âm thanh.');
      }

      const gen = await generateProjectAudio({
        projectId: updatedProj.id,
        providerId: ttsDraft.provider as ProviderId,
        voiceId: ttsDraft.voice,
        settings: {
          speed: ttsDraft.speed,
          pitch: ttsDraft.pitch,
          volume: ttsDraft.volume
        }
      });

      if (gen && gen.status === 'completed') {
        setGenerateSuccess('Đã tạo tệp âm thanh thành công! Bản ghi hiển thị bên dưới.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to generate audio track:', err);
      setGenerateError(`Lỗi tạo âm thanh: ${msg}`);
    }
  };

  const handleBuildSegments = async () => {
    if (!currentProject) return;
    setGenerateError(null);
    setGenerateSuccess(null);
    try {
      if (dirty) {
        await saveNow();
      }
      if (isStale || !currentProject.processedText?.trim()) {
        await handleReprocess();
      }
      const updatedProj = useProjectEditorStore.getState().currentProject;
      const res = await buildSegments(updatedProj?.id || currentProject.id);
      if (res) {
        setStudioTab('segments');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to build segments:', err);
      setGenerateError(`Lỗi phân đoạn kịch bản: ${msg}`);
    }
  };

  const handleComposeAudio = async () => {
    if (!currentProject) return;
    const comp = await composeAudio(currentProject.id);
    if (comp) {
      await loadCues(currentProject.id);
    }
  };

  const handleExportSubtitles = async (format: 'srt' | 'vtt') => {
    if (!currentProject) return;
    await exportSubtitles(currentProject.id, format);
  };

  const handleExportBundle = async (targetDir: string, opts: Partial<ProjectExportOptions>) => {
    if (!currentProject) return;
    await exportBundle(currentProject.id, targetDir, opts);
  };

  // Metrics
  const characterCount = originalText.length;
  const wordCount = originalText.trim() === '' ? 0 : originalText.trim().split(/\s+/).length;
  const paragraphCount = originalText.trim() === '' ? 0 : originalText.split(/\n\s*\n/).filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground text-xs">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
        <span>Loading project...</span>
      </div>
    );
  }

  // If no project is loaded, show empty state prompt
  if (!currentProject) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <EmptyState
          icon={FileText}
          title={t.tts.noProjectTitle}
          description={t.tts.noProjectDesc}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleCreateNewProject}
                disabled={isCreatingNew}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.tts.createNewProject}</span>
              </button>
              <button
                onClick={() => setActiveRoute('projects')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                <span>{t.tts.openProjectsList}</span>
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 max-w-7xl mx-auto pb-10">
      {/* CRASH RECOVERY BANNER */}
      {recoveryDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-500 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">{t.tts.recoveryNoticeTitle}</p>
              <p className="text-[11px] opacity-80">{t.tts.recoveryNoticeDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={recoverDraft}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black shadow-xs hover:bg-amber-400 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{t.tts.recoverBtn}</span>
            </button>
            <button
              onClick={discardRecovery}
              className="rounded-md border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              {t.tts.discardBtn}
            </button>
          </div>
        </div>
      )}

      {/* PROJECT TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        {/* Project Name inline edit */}
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className="rounded border border-primary bg-background px-2 py-0.5 text-xs font-semibold text-foreground focus:outline-none"
              />
              <button
                onClick={handleSaveRename}
                className="rounded p-1 text-primary hover:bg-primary/10"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate text-sm font-semibold text-foreground" title={currentProject.name}>
                {currentProject.name}
              </span>
              <button
                onClick={handleStartRename}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title={t.projects.rename}
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Revision tag */}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {t.common.revision} {currentProject.revision}
          </span>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Save status badge */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1 text-blue-500 font-medium animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {t.common.saving}
              </span>
            )}
            {saveStatus === 'dirty' && (
              <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                {t.common.dirty}
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t.common.saved}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="inline-flex items-center gap-1 text-destructive font-medium">
                {t.common.saveError}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Save Now Button */}
          <button
            onClick={saveNow}
            disabled={!dirty || saveStatus === 'saving'}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
            title="Cmd+S"
          >
            <Save className="h-3 w-3" />
            <span className="hidden md:inline">{t.common.saveNow}</span>
            <span className="md:hidden">{t.common.save}</span>
          </button>

          {/* Open Folder */}
          <button
            onClick={handleOpenFolder}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            title={t.tts.openFolder}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">{t.projects.openFolder}</span>
          </button>

          {/* Close Project */}
          <button
            onClick={closeProject}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Close project"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 5-TAB STUDIO NAVIGATION */}
      <div className="flex flex-wrap border-b border-border bg-card/80 backdrop-blur-sm px-2 pt-1 gap-1 rounded-t-xl">
        <button
          onClick={() => setStudioTab('script')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            studioTab === 'script'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Kịch bản (Script)</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {characterCount}
          </span>
        </button>

        <button
          onClick={() => setStudioTab('segments')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            studioTab === 'segments'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Phân đoạn (Segments)</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {segments.length}
          </span>
        </button>

        <button
          onClick={() => setStudioTab('audio')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            studioTab === 'audio'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <Volume2 className="h-4 w-4" />
          <span>Dạng sóng âm thanh (Audio)</span>
          {composition && (
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono">
              Ready
            </span>
          )}
        </button>

        <button
          onClick={() => setStudioTab('subtitle')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            studioTab === 'subtitle'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <Subtitles className="h-4 w-4" />
          <span>Phụ đề (Subtitle)</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            {cues.length}
          </span>
        </button>

        <button
          onClick={() => setStudioTab('export')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            studioTab === 'export'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>Xuất tệp (Export)</span>
        </button>
      </div>

      {studioTab === 'script' && (
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
        {/* SCRIPT EDITOR & PREVIEW (Left Column - 8 cols) */}
        <div className="lg:col-span-8 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Tabs & Toolbar */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border">
              <button
                onClick={() => setActiveTab('original')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'original'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{t.textProcessing.originalTab}</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('processed');
                  if (!textProcessingResult && originalText.trim()) {
                    previewTextProcessing(originalText);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'processed'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t.textProcessing.processedTab}</span>
                {isStale && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" title={t.textProcessing.needsRefresh} />
                )}
              </button>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBuildSegments}
                disabled={isBuildingSegments || isTextProcessing || !originalText.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
                title="Phân đoạn kịch bản và mở danh sách phân đoạn"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{isBuildingSegments ? 'Đang phân đoạn...' : 'Phân đoạn kịch bản'}</span>
              </button>

              {activeTab === 'original' ? (
                <>
                  <button
                    onClick={() => handleQuickAddToDictionary()}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    title={t.textProcessing.quickAddFromScript}
                  >
                    <BookOpen className="h-3 w-3 text-primary" />
                    <span className="hidden sm:inline">{t.textProcessing.quickAddFromScript}</span>
                  </button>

                  <button
                    onClick={handlePaste}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    title={t.tts.paste}
                  >
                    <Clipboard className="h-3 w-3" />
                    <span>{t.tts.paste}</span>
                  </button>

                  <button
                    onClick={handleClearText}
                    disabled={!originalText}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
                    title={t.tts.clear}
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{t.tts.clear}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleReprocess}
                  disabled={isTextProcessing}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{isTextProcessing ? '...' : t.textProcessing.reprocessBtn}</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'original' ? (
            <div className="flex flex-col flex-1">
              <textarea
                ref={textareaRef}
                value={originalText}
                onChange={(e) => {
                  setOriginalText(e.target.value);
                  updateTtsDraft({ text: e.target.value });
                  setTextProcessingIsStale(true);
                }}
                placeholder={t.tts.placeholder}
                className="flex-1 w-full min-h-[380px] resize-none bg-transparent p-4 text-sm font-normal text-foreground placeholder:text-muted-foreground/60 focus:outline-none leading-relaxed"
                rows={16}
              />

              {/* Editor Footer: Counters */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>
                    {t.common.paragraphs}: <strong className="font-mono text-foreground">{paragraphCount}</strong>
                  </span>
                  <span>
                    {t.common.words}: <strong className="font-mono text-foreground">{wordCount}</strong>
                  </span>
                  <span>
                    {t.common.characters}: <strong className="font-mono text-foreground">{characterCount}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  {lastSavedAt && (
                    <span className="flex items-center gap-1 opacity-75">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(lastSavedAt).toLocaleTimeString()}</span>
                    </span>
                  )}
                  <span>{t.tts.footerInfo}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Processed Preview / Diff View */
            <div className="p-4 flex-1 overflow-y-auto">
              {textProcessingResult ? (
                <TextProcessingDiffViewer
                  result={textProcessingResult}
                  isStale={isStale}
                  onReprocess={handleReprocess}
                  onQuickAddDictionary={(term) => handleQuickAddToDictionary(term)}
                />
              ) : currentProject.processedText ? (
                /* Fallback if project has processed text in db */
                <div className="space-y-4">
                  <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                        {t.textProcessing.processedTab}
                      </span>
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Đã lưu trong dự án
                      </span>
                    </div>
                    <div className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap p-4 rounded-lg bg-primary/5 border border-primary/10 max-h-[450px] overflow-y-auto">
                      {currentProject.processedText}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={handleReprocess}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t.textProcessing.previewBtn}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <Sparkles className="h-10 w-10 text-muted-foreground mx-auto" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Chưa xử lý văn bản</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nhấp nút bên dưới để chuẩn hóa ngày tháng, số tự nhiên, tiền tệ và áp dụng từ điển phát âm.
                    </p>
                  </div>
                  <button
                    onClick={handleReprocess}
                    disabled={isTextProcessing || !originalText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isTextProcessing ? 'Đang xử lý...' : t.textProcessing.previewBtn}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR PANELS (Right Column - 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* TEXT PROCESSING SETTINGS PANEL */}
          <TextProcessingSettingsPanel
            projectId={currentProject.id}
            originalText={originalText}
            onProcessed={() => setActiveTab('processed')}
          />

          {/* HIDDEN AUDIO ELEMENT FOR PREVIEWS */}
          <audio
            ref={previewAudioRef}
            onEnded={() => setIsPlayingPreview(false)}
            onError={() => setIsPlayingPreview(false)}
          />

          {/* VOICE SETTINGS CARD */}
          <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Sliders className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.tts.voiceSettings}
                </h2>
              </div>

              {/* Provider Selector */}
              <div className="space-y-1.5">
                <label htmlFor="tts-provider-select" className="text-xs font-medium text-foreground">
                  {t.tts.providerLabel}
                </label>
                <select
                  id="tts-provider-select"
                  aria-label={t.tts.providerLabel}
                  value={ttsDraft.provider}
                  onChange={(e) => updateTtsDraft({ provider: e.target.value as typeof ttsDraft.provider })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {(providers.length > 0 ? providers : DEFAULT_PROVIDERS).map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} {!provider.configured && provider.id !== 'edge-tts' ? `(${t.common.notConfigured})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Model Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="tts-voice-select" className="text-xs font-medium text-foreground">
                    {t.tts.voiceLabel}
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {availableVoices.length} giọng sẵn có
                  </span>
                </div>
                <select
                  id="tts-voice-select"
                  aria-label={t.tts.voiceLabel}
                  value={ttsDraft.voice}
                  onChange={(e) => updateTtsDraft({ voice: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableVoices.length > 0 ? (
                    availableVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.gender === 'female' ? 'Nữ' : v.gender === 'male' ? 'Nam' : 'Trung tính'} • {v.locale})
                      </option>
                    ))
                  ) : (
                    <option value="vi-VN-HoaiMyNeural">vi-VN-HoaiMyNeural (Mặc định)</option>
                  )}
                </select>
              </div>

              {/* Speed Slider (if supported) */}
              {(activeProvider?.capabilities.supportsRate ?? true) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="tts-speed-slider" className="text-muted-foreground">{t.tts.speedLabel}</label>
                    <span className="font-mono font-medium text-foreground">{ttsDraft.speed.toFixed(2)}x</span>
                  </div>
                  <input
                    id="tts-speed-slider"
                    aria-label={t.tts.speedLabel}
                    type="range"
                    min={activeProvider?.capabilities.minRate ?? 0.5}
                    max={activeProvider?.capabilities.maxRate ?? 2.0}
                    step="0.05"
                    value={ttsDraft.speed}
                    onChange={(e) => updateTtsDraft({ speed: parseFloat(e.target.value) })}
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>
              )}

              {/* Pitch Slider (if supported) */}
              {(activeProvider?.capabilities.supportsPitch ?? false) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="tts-pitch-slider" className="text-muted-foreground">{t.tts.pitchLabel}</label>
                    <span className="font-mono font-medium text-foreground">
                      {ttsDraft.pitch > 0 ? `+${ttsDraft.pitch}` : ttsDraft.pitch} Hz
                    </span>
                  </div>
                  <input
                    id="tts-pitch-slider"
                    aria-label={t.tts.pitchLabel}
                    type="range"
                    min={activeProvider?.capabilities.minPitch ?? -50}
                    max={activeProvider?.capabilities.maxPitch ?? 50}
                    step="5"
                    value={ttsDraft.pitch}
                    onChange={(e) => updateTtsDraft({ pitch: parseInt(e.target.value, 10) })}
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>
              )}

              {/* Volume Slider (if supported) */}
              {(activeProvider?.capabilities.supportsVolume ?? false) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="tts-volume-slider" className="text-muted-foreground">{t.tts.volumeLabel}</label>
                    <span className="font-mono font-medium text-foreground">{ttsDraft.volume}%</span>
                  </div>
                  <input
                    id="tts-volume-slider"
                    aria-label={t.tts.volumeLabel}
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={ttsDraft.volume}
                    onChange={(e) => updateTtsDraft({ volume: parseInt(e.target.value, 10) })}
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>
              )}
            </div>

            {/* Stale Script Warning Banner */}
            {(isStale || !currentProject.processedText?.trim()) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-500 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Kịch bản cần xử lý</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Văn bản gốc hoặc từ điển đã thay đổi. Để đảm bảo chất lượng, bạn cần xử lý lại kịch bản trước khi tạo âm thanh.
                </p>
                <button
                  onClick={handleReprocess}
                  disabled={isTextProcessing || !originalText.trim()}
                  className="w-full rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 py-1 text-[11px] font-medium transition-colors"
                >
                  {isTextProcessing ? 'Đang xử lý kịch bản...' : 'Xử lý lại kịch bản ngay'}
                </button>
              </div>
            )}

            {/* Action Buttons: Preview & Generate */}
            <div className="pt-2 border-t border-border space-y-2">
              <button
                onClick={handlePreviewVoice}
                disabled={isPreviewing || isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isPreviewing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : isPlayingPreview ? (
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{isPreviewing ? 'Đang tổng hợp mẫu...' : isPlayingPreview ? 'Dừng phát mẫu' : t.tts.previewBtn}</span>
              </button>

              <button
                onClick={handleGenerateAudio}
                disabled={
                  !originalText.trim() ||
                  isGenerating ||
                  (activeProvider && !activeProvider.configured && activeProvider.capabilities.requiresApiKey)
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{isGenerating ? 'Đang tạo âm thanh dự án...' : t.tts.generateBtn}</span>
              </button>

              {/* Status / Error feedback */}
              {generateError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{generateError}</div>
                </div>
              )}
              {generateSuccess && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-500 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{generateSuccess}</div>
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE PROJECT AUDIO PLAYER WIDGET */}
          {activeProjectGeneration && activeProjectGeneration.status === 'completed' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Bản thu âm gần nhất của dự án</span>
              </div>
              <AudioPlayer generation={activeProjectGeneration} autoPlay={false} />
            </div>
          )}
        </div>
      </div>
      )}

      {/* SEGMENTS TAB */}
      {studioTab === 'segments' && (
        <div className="space-y-4">
          <QueueControlBar
            queueStatus={queueStatus}
            segments={segments}
            onStartQueue={() => startQueue(currentProject.id)}
            onPauseQueue={pauseQueue}
            onResumeQueue={resumeQueue}
            onCancelQueue={() => cancelQueue(currentProject.id)}
          />
          <SegmentList
            segments={segments}
            isBuilding={isBuildingSegments}
            onBuildSegments={handleBuildSegments}
            onUpdateOverride={updateOverride}
            onResetOverride={resetOverride}
            onRegenerateSegment={(segId) => regenerateSegment(currentProject.id, segId)}
            onSelectSegment={(seg) => setSelectedSegment(seg)}
            selectedSegmentId={selectedSegment?.id}
          />
        </div>
      )}

      {/* AUDIO WAVEFORM TAB */}
      {studioTab === 'audio' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Ghép nối âm thanh dự án (FFmpeg Concat & Pauses)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hợp nhất toàn bộ các phân đoạn âm thanh theo thứ tự với khoảng nghỉ câu và đoạn văn tự nhiên.
              </p>
            </div>
            <button
              onClick={handleComposeAudio}
              disabled={isComposing || segments.length === 0 || segments.some((s) => s.status !== 'completed')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {isComposing ? 'Đang ghép âm thanh...' : 'Ghép âm thanh ngay'}
            </button>
          </div>

          <WaveformTimeline
            audioPath={composition?.outputMp3Path || null}
            onSelectSegment={(id) => {
              const seg = segments.find((s) => s.id === id);
              if (seg) setSelectedSegment(seg);
            }}
            selectedSegmentId={selectedSegment?.id}
          />
        </div>
      )}

      {/* SUBTITLE TAB */}
      {studioTab === 'subtitle' && (
        <SubtitleViewer
          cues={cues}
          isLoading={isLoadingCues}
          onExport={handleExportSubtitles}
        />
      )}

      {/* EXPORT TAB */}
      {studioTab === 'export' && (
        <ExportPanel
          projectId={currentProject.id}
          projectName={currentProject.name}
          isExporting={isExporting}
          lastExportResult={lastExportResult}
          onExportBundle={handleExportBundle}
        />
      )}

      {/* Quick Add Rule Modal */}
      {isQuickAddOpen && (
        <RuleEditorModal
          isOpen={true}
          rule={null}
          initialTerm={quickAddRule?.term}
          onClose={() => {
            setIsQuickAddOpen(false);
            setQuickAddRule(null);
          }}
          onSaved={() => {
            setIsQuickAddOpen(false);
            setQuickAddRule(null);
            fetchRules();
            setTextProcessingIsStale(true);
          }}
        />
      )}
    </div>
  );
};
