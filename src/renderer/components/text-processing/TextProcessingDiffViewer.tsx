import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Calendar,
  Hash,
  Coins,
  FileText,
  Space,
  Split,
  Eye
} from 'lucide-react';
import type { TextProcessingResult, TextTransformation } from '@shared/types/textProcessing.types';
import { useTranslation } from '../../stores/app.store';

interface TextProcessingDiffViewerProps {
  result: TextProcessingResult;
  isStale?: boolean;
  onReprocess?: () => void;
  onQuickAddDictionary?: (term: string) => void;
}

export const TextProcessingDiffViewer: React.FC<TextProcessingDiffViewerProps> = ({
  result,
  isStale = false,
  onReprocess,
  onQuickAddDictionary
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'side-by-side' | 'processed-only'>('side-by-side');
  const [showTrace, setShowTrace] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyProcessed = async () => {
    try {
      await navigator.clipboard.writeText(result.processedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy processed text:', err);
    }
  };

  const getStageBadge = (stage: TextTransformation['stage']) => {
    switch (stage) {
      case 'dictionary':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <BookOpen className="h-2.5 w-2.5" />
            Từ điển
          </span>
        );
      case 'date':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Calendar className="h-2.5 w-2.5" />
            Ngày tháng
          </span>
        );
      case 'number':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Hash className="h-2.5 w-2.5" />
            Số
          </span>
        );
      case 'currency':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Coins className="h-2.5 w-2.5" />
            Tiền tệ
          </span>
        );
      case 'abbreviation':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <FileText className="h-2.5 w-2.5" />
            Viết tắt
          </span>
        );
      case 'whitespace':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
            <Space className="h-2.5 w-2.5" />
            Khoảng trắng
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600 dark:text-amber-400 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">{t.textProcessing.needsRefresh}: </span>
              <span>{t.textProcessing.needsRefreshNotice}</span>
            </div>
          </div>
          {onReprocess && (
            <button
              onClick={onReprocess}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black hover:bg-amber-400 self-end sm:self-auto transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{t.textProcessing.reprocessBtn}</span>
            </button>
          )}
        </div>
      )}

      {/* Transformations Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-xs text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t.textProcessing.summaryTitle}:
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold border border-primary/20">
            {result.stats.totalTransformations} {t.textProcessing.changesCount}
          </span>

          {/* Quick counts */}
          {result.stats.dictionaryMatches > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
              Từ điển: {result.stats.dictionaryMatches}
            </span>
          )}
          {result.stats.datesNormalized > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
              Ngày: {result.stats.datesNormalized}
            </span>
          )}
          {result.stats.numbersNormalized > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              Số: {result.stats.numbersNormalized}
            </span>
          )}
          {result.stats.currenciesNormalized > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              Tiền: {result.stats.currenciesNormalized}
            </span>
          )}
          {result.stats.abbreviationsNormalized > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
              Viết tắt: {result.stats.abbreviationsNormalized}
            </span>
          )}
        </div>

        {/* View mode toggle & Copy button */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Split className="h-3 w-3" />
              <span>{t.textProcessing.sideBySide}</span>
            </button>
            <button
              onClick={() => setViewMode('processed-only')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                viewMode === 'processed-only'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>{t.textProcessing.processedOnly}</span>
            </button>
          </div>

          <button
            onClick={handleCopyProcessed}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>
        </div>
      </div>

      {/* Warnings Banner if any */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{t.textProcessing.warningsTitle}</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            {result.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Text Content Panels */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Original View */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t.textProcessing.originalTab}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {result.originalText.length} ký tự
              </span>
            </div>
            <div className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap p-2 rounded-lg bg-muted/30 max-h-96 overflow-y-auto">
              {result.originalText}
            </div>
          </div>

          {/* Processed View */}
          <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  {t.textProcessing.processedTab}
                </span>
                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-medium">
                  Chỉ đọc
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {result.processedText.length} ký tự
              </span>
            </div>
            <div className="font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap p-2 rounded-lg bg-primary/5 border border-primary/10 max-h-96 overflow-y-auto">
              {result.processedText}
            </div>
          </div>
        </div>
      ) : (
        /* Processed Only View */
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {t.textProcessing.processedTab}
              </span>
              <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-medium">
                Chỉ đọc
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {result.processedText.length} ký tự
            </span>
          </div>
          <div className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap p-4 rounded-lg bg-primary/5 border border-primary/10 max-h-[500px] overflow-y-auto">
            {result.processedText}
          </div>
        </div>
      )}

      {/* Trace / Change Details Accordion */}
      {result.transformations.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTrace(!showTrace)}
            className="w-full flex items-center justify-between p-3 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>
                Chi tiết vết biến đổi ({result.transformations.length} vị trí thay đổi)
              </span>
            </span>
            {showTrace ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showTrace && (
            <div className="p-3 border-t border-border bg-muted/20 space-y-2 max-h-64 overflow-y-auto text-xs">
              {result.transformations.map((tr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/80 text-xs"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStageBadge(tr.stage)}
                    <span className="font-mono font-medium line-through text-muted-foreground">
                      &quot;{tr.sourceText}&quot;
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono font-bold text-primary">
                      &quot;{tr.resultText}&quot;
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      pos: {tr.sourceStart}..{tr.sourceEnd}
                    </span>
                    {onQuickAddDictionary && tr.stage !== 'dictionary' && (
                      <button
                        onClick={() => onQuickAddDictionary(tr.sourceText)}
                        className="text-[10px] text-primary hover:underline"
                        title="Thêm từ gốc này vào từ điển phát âm"
                      >
                        Thêm từ điển
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
