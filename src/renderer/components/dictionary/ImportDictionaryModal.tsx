import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { DictionaryImportPreviewResult, DictionaryConflictPolicy } from '@shared/types/dictionary.types';
import { useDictionaryStore } from '../../stores/dictionary.store';
import { useTranslation } from '../../stores/app.store';

interface ImportDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportDictionaryModal: React.FC<ImportDictionaryModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { selectImportFile, previewImport, executeImport } = useDictionaryStore();
  const { t } = useTranslation();

  const [fileData, setFileData] = useState<{ content: string; format: 'json' | 'csv'; filePath: string } | null>(null);
  const [preview, setPreview] = useState<DictionaryImportPreviewResult | null>(null);
  const [conflictPolicy, setConflictPolicy] = useState<DictionaryConflictPolicy>('skip');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setImportResult(null);

      const file = await selectImportFile();
      if (!file) {
        setIsLoading(false);
        return;
      }

      setFileData(file);
      const previewRes = await previewImport({
        format: file.format,
        content: file.content,
        conflictPolicy
      });
      setPreview(previewRes);
    } catch (err: unknown) {
      console.error('File selection/preview error:', err);
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp từ điển');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConflictPolicyChange = async (newPolicy: DictionaryConflictPolicy) => {
    setConflictPolicy(newPolicy);
    if (fileData) {
      try {
        const previewRes = await previewImport({
          format: fileData.format,
          content: fileData.content,
          conflictPolicy: newPolicy
        });
        setPreview(previewRes);
      } catch (err) {
        console.error('Failed to re-preview on policy change:', err);
      }
    }
  };

  const handleExecuteImport = async () => {
    if (!fileData) return;
    try {
      setIsImporting(true);
      setError(null);
      const res = await executeImport({
        format: fileData.format,
        content: fileData.content,
        conflictPolicy
      });
      setImportResult(res);
      onSuccess();
    } catch (err: unknown) {
      console.error('Import execution error:', err);
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi nhập từ điển');
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setFileData(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">{t.dictionary.importTitle}</h3>
          </div>
          <button
            onClick={resetState}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {importResult ? (
          <div className="space-y-4 py-4 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Nhập từ điển hoàn tất</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Đã thêm {importResult.inserted} mục mới, cập nhật {importResult.updated} mục, bỏ qua {importResult.skipped} mục.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={resetState}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: File selection */}
            {!fileData ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Chọn tệp từ điển cần nhập
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hỗ trợ tệp JSON (.json) và CSV (.csv UTF-8)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSelectFile}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isLoading ? 'Đang đọc tệp...' : t.dictionary.selectFile}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate font-mono font-medium text-foreground">
                      {fileData.filePath.split(/[/\\]/).pop()}
                    </span>
                    <span className="uppercase text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {fileData.format}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFileData(null);
                      setPreview(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                  >
                    Đổi tệp
                  </button>
                </div>

                {/* Preview Stats */}
                {preview && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-muted/40 p-2 border border-border">
                        <span className="block text-lg font-bold text-foreground">{preview.total}</span>
                        <span className="text-[10px] text-muted-foreground">{t.dictionary.totalRows}</span>
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/20">
                        <span className="block text-lg font-bold text-emerald-500">{preview.newCount}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{t.dictionary.newRules}</span>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2 border border-amber-500/20">
                        <span className="block text-lg font-bold text-amber-500">{preview.conflictCount}</span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">{t.dictionary.conflicts}</span>
                      </div>
                      <div className="rounded-lg bg-rose-500/10 p-2 border border-rose-500/20">
                        <span className="block text-lg font-bold text-rose-500">{preview.invalidCount}</span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400">{t.dictionary.invalidRules}</span>
                      </div>
                    </div>

                    {/* Conflict policy */}
                    {preview.conflictCount > 0 && (
                      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                        <span className="text-xs font-semibold text-foreground block">
                          {t.dictionary.importConflictPolicy}:
                        </span>
                        <div className="space-y-1.5 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="conflictPolicy"
                              value="skip"
                              checked={conflictPolicy === 'skip'}
                              onChange={() => handleConflictPolicyChange('skip')}
                              className="text-primary focus:ring-primary"
                            />
                            <span>{t.dictionary.skipExisting}</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="conflictPolicy"
                              value="replace"
                              checked={conflictPolicy === 'replace'}
                              onChange={() => handleConflictPolicyChange('replace')}
                              className="text-primary focus:ring-primary"
                            />
                            <span>{t.dictionary.replaceExisting}</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Sample preview items for conflicts */}
                    {preview.conflicts.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Mục trùng lặp ({Math.min(preview.conflicts.length, 5)} / {preview.conflicts.length}):
                        </span>
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-border text-xs divide-y divide-border">
                          {preview.conflicts.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="p-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-foreground">{item.term}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground line-through">{item.existingRule.spokenText}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-primary font-medium">{item.incomingRule.spokenText}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={resetState}
                    disabled={isImporting}
                    className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting || !preview || preview.newCount + (conflictPolicy === 'replace' ? preview.conflictCount : 0) === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{isImporting ? 'Đang nhập...' : t.dictionary.executeImport}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
