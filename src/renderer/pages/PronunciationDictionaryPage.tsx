import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  Sparkles,
  ArrowUpDown,
  CheckSquare,
  AlertTriangle,
  X,
  Check,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { RuleEditorModal } from '../components/dictionary/RuleEditorModal';
import { ImportDictionaryModal } from '../components/dictionary/ImportDictionaryModal';
import { TestRuleModal } from '../components/dictionary/TestRuleModal';
import { PronunciationAudioButton, stopAllPronunciationAudio } from '../components/dictionary/PronunciationAudioButton';
import { useDictionaryStore } from '../stores/dictionary.store';
import { useTranslation } from '../stores/app.store';
import type { PronunciationRule, ProviderScope, DictionarySortBy } from '@shared/types/dictionary.types';

export const PronunciationDictionaryPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    rules,
    loading,
    searchQuery,
    categoryFilter,
    providerFilter,
    statusFilter,
    sortBy,
    sortOrder,
    selectedRuleIds,
    categories,
    dictionaryRevision,
    setSearchQuery,
    setCategoryFilter,
    setProviderFilter,
    setStatusFilter,
    setSortBy,
    toggleSortOrder,
    toggleSelectRule,
    selectAllRules,
    fetchRules,
    fetchCategories,
    deleteRule,
    deleteSelectedRules,
    toggleEnabled,
    setSelectedRulesEnabled,
    exportToFile
  } = useDictionaryStore();

  // Modals state
  const [editorRule, setEditorRule] = useState<PronunciationRule | null | undefined>(undefined); // undefined: closed, null: add, object: edit
  const [testingRule, setTestingRule] = useState<PronunciationRule | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PronunciationRule | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetchRules();
    fetchCategories();
  }, [fetchRules, fetchCategories]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopAllPronunciationAudio();
    };
  }, []);

  // Debounced search & filter re-fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRules();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, providerFilter, statusFilter, sortBy, sortOrder, fetchRules]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExportDropdownOpen(false);
    const success = await exportToFile(format);
    if (success) {
      showToast(`Đã xuất từ điển dạng ${format.toUpperCase()} thành công!`);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    const success = await deleteRule(deleteTarget.id);
    setDeleteTarget(null);
    if (success) {
      showToast(`Đã xóa quy tắc "${deleteTarget.term}"!`);
    }
  };

  const handleBulkDelete = async () => {
    await deleteSelectedRules();
    setIsBulkDeleting(false);
    showToast(`Đã xóa các quy tắc được chọn!`);
  };

  const allSelected = rules.length > 0 && selectedRuleIds.length === rules.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t.dictionary.title}</h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
              Rev #{dictionaryRevision}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{t.dictionary.subtitle}</p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Import Button */}
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t.dictionary.importBtn}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t.dictionary.exportBtn}</span>
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 mt-1 w-36 rounded-lg border border-border bg-card shadow-lg py-1 z-30 animate-in fade-in duration-100">
                <button
                  onClick={() => handleExport('json')}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  {t.dictionary.exportJson}
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  {t.dictionary.exportCsv}
                </button>
              </div>
            )}
          </div>

          {/* Add Rule Button */}
          <button
            onClick={() => setEditorRule(null)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.dictionary.addRule}</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="h-4 w-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.dictionary.searchPlaceholder}
              className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label={t.dictionary.category}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t.dictionary.allCategories}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Provider Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as ProviderScope | 'ALL')}
              aria-label={t.dictionary.providerScope}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">{t.dictionary.allProviders}</option>
              <option value="EDGE">Edge TTS</option>
              <option value="LUCYLAB">LucyLab</option>
              <option value="ELEVENLABS">ElevenLabs</option>
              <option value="VBEE">Vbee</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ENABLED' | 'DISABLED')}
              aria-label={t.dictionary.status}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">{t.dictionary.status}: Tất cả</option>
              <option value="ENABLED">Đã bật</option>
              <option value="DISABLED">Đã tắt</option>
            </select>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as DictionarySortBy)}
            aria-label="Sắp xếp"
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="updatedAt">{t.dictionary.sortUpdated}</option>
            <option value="term">{t.dictionary.sortTermAsc}</option>
            <option value="category">{t.dictionary.sortCategory}</option>
            <option value="priority">{t.dictionary.sortPriority}</option>
          </select>

          <button
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? 'Tăng dần' : 'Giảm dần'}
            className="rounded-lg border border-input bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedRuleIds.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              Đã chọn {selectedRuleIds.length} / {rules.length} quy tắc
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedRulesEnabled(true)}
              className="rounded bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted border border-border"
            >
              {t.dictionary.enableSelected}
            </button>
            <button
              onClick={() => setSelectedRulesEnabled(false)}
              className="rounded bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted border border-border"
            >
              {t.dictionary.disableSelected}
            </button>
            <button
              onClick={() => setIsBulkDeleting(true)}
              className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive px-2.5 py-1 font-medium hover:bg-destructive/20 border border-destructive/20"
            >
              <Trash2 className="h-3 w-3" />
              <span>{t.dictionary.deleteSelected}</span>
            </button>
            <button
              onClick={() => selectAllRules(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Rules Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          <span>{t.common.checking}</span>
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t.dictionary.emptyTitle}
          description={t.dictionary.emptyDesc}
          action={
            <button
              onClick={() => setEditorRule(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.dictionary.addRule}</span>
            </button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium select-none">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => selectAllRules(e.target.checked)}
                      aria-label="Chọn tất cả"
                      className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                  </th>
                  <th className="p-3 font-semibold">{t.dictionary.term}</th>
                  <th className="p-3 font-semibold">{t.dictionary.spokenText}</th>
                  <th className="p-3 font-semibold">{t.dictionary.category}</th>
                  <th className="p-3 font-semibold">{t.dictionary.providerScope}</th>
                  <th className="p-3 font-semibold">Tùy chọn</th>
                  <th className="p-3 font-semibold text-center">{t.dictionary.priority}</th>
                  <th className="p-3 font-semibold text-center">{t.dictionary.enabled}</th>
                  <th className="p-3 font-semibold text-right">{t.dictionary.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rules.map((rule) => {
                  const isSelected = selectedRuleIds.includes(rule.id);
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRule(rule.id)}
                          aria-label={`Chọn quy tắc ${rule.term}`}
                          className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                      </td>

                      {/* Term */}
                      <td className="p-3 font-mono font-bold text-foreground">
                        {rule.term}
                      </td>

                      {/* Spoken Text */}
                      <td className="p-3 font-medium text-primary">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{rule.spokenText}</span>
                          <PronunciationAudioButton
                            text={rule.spokenText}
                            providerId={rule.providerScope}
                            size="sm"
                            title={`Nghe phát âm "${rule.spokenText}"`}
                          />
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        {rule.category ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium text-[11px] border border-border">
                            {rule.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic">—</span>
                        )}
                      </td>

                      {/* Provider Scope */}
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            rule.providerScope === 'ALL'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}
                        >
                          {rule.providerScope}
                        </span>
                      </td>

                      {/* Match Options */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            title={rule.wholeWord ? 'Khớp toàn bộ từ' : 'Khớp một phần từ'}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              rule.wholeWord
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {rule.wholeWord ? 'Whole' : 'Part'}
                          </span>
                          {rule.caseSensitive && (
                            <span
                              title="Phân biệt chữ hoa / chữ thường"
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium"
                            >
                              Aa
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="p-3 text-center font-mono text-[11px] text-muted-foreground">
                        {rule.priority}
                      </td>

                      {/* Enabled Toggle */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleEnabled(rule.id, !rule.enabled)}
                          title={rule.enabled ? 'Đang bật - Nhấp để tắt' : 'Đang tắt - Nhấp để bật'}
                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {rule.enabled ? (
                            <ToggleRight className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setTestingRule(rule)}
                            title={t.dictionary.testRule}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setEditorRule(rule)}
                            title={t.dictionary.editRule}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(rule)}
                            title="Xóa quy tắc"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {editorRule !== undefined && (
        <RuleEditorModal
          isOpen={true}
          rule={editorRule}
          onClose={() => setEditorRule(undefined)}
          onSaved={() => {
            showToast(editorRule ? 'Đã cập nhật quy tắc!' : 'Đã thêm quy tắc mới!');
            fetchCategories();
          }}
        />
      )}

      {/* Test Rule Modal */}
      {testingRule && (
        <TestRuleModal
          isOpen={true}
          rule={testingRule}
          onClose={() => setTestingRule(null)}
        />
      )}

      {/* Import Modal */}
      <ImportDictionaryModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          showToast('Nhập từ điển thành công!');
          fetchRules();
          fetchCategories();
        }}
      />

      {/* Single Rule Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t.dictionary.deleteConfirmTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  {t.dictionary.deleteConfirmDesc} <strong className="text-foreground">{deleteTarget.term}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDeleteSingle}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Xóa nhiều quy tắc</h3>
                <p className="text-xs text-muted-foreground">
                  Bạn có chắc muốn xóa {selectedRuleIds.length} quy tắc đã chọn? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setIsBulkDeleting(false)}
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleBulkDelete}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
