import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Check, Play, Volume2 } from 'lucide-react';
import type {
  PronunciationRule,
  CreatePronunciationRuleInput,
  UpdatePronunciationRuleInput,
  ProviderScope
} from '@shared/types/dictionary.types';
import { useDictionaryStore } from '../../stores/dictionary.store';
import { useTranslation } from '../../stores/app.store';
import { useVoiceStore } from '../../stores/voice.store';
import { PronunciationAudioButton, stopAllPronunciationAudio } from './PronunciationAudioButton';

interface RuleEditorModalProps {
  rule?: PronunciationRule | null; // null for Create mode
  initialTerm?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (rule: PronunciationRule) => void;
}

export const RuleEditorModal: React.FC<RuleEditorModalProps> = ({
  rule,
  initialTerm,
  isOpen,
  onClose,
  onSaved
}) => {
  const { createRule, updateRule, categories, testRule } = useDictionaryStore();
  const { t } = useTranslation();
  const { voices, fetchVoices } = useVoiceStore();

  const [term, setTerm] = useState('');
  const [spokenText, setSpokenText] = useState('');
  const [category, setCategory] = useState('');
  const [providerScope, setProviderScope] = useState<ProviderScope>('ALL');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(true);
  const [priority, setPriority] = useState(0);
  const [note, setNote] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Testing inside modal
  const [sampleText, setSampleText] = useState('');
  const [testResult, setTestResult] = useState<{ original: string; processed: string; matched: boolean } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Audio preview voice
  const [selectedVoiceId, setSelectedVoiceId] = useState('vi-VN-HoaiMyNeural');
  const [selectedProviderId, setSelectedProviderId] = useState('edge-tts');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (voices.length === 0) {
      fetchVoices();
    }
  }, [voices.length, fetchVoices]);

  useEffect(() => {
    if (rule) {
      setTerm(rule.term);
      setSpokenText(rule.spokenText);
      setCategory(rule.category || '');
      setProviderScope(rule.providerScope);
      setCaseSensitive(rule.caseSensitive);
      setWholeWord(rule.wholeWord);
      setPriority(rule.priority);
      setNote(rule.note || '');
      setEnabled(rule.enabled);
      setSampleText(`Ví dụ văn bản thử nghiệm chứa từ ${rule.term} ở đây.`);
    } else {
      setTerm(initialTerm || '');
      setSpokenText('');
      setCategory('');
      setProviderScope('ALL');
      setCaseSensitive(false);
      setWholeWord(true);
      setPriority(0);
      setNote('');
      setEnabled(true);
      setSampleText(initialTerm ? `Ví dụ văn bản chứa từ ${initialTerm} cần đọc.` : '');
    }
    setTestResult(null);
    setError(null);
  }, [rule, initialTerm, isOpen]);

  if (!isOpen) return null;

  const handleTestInModal = async () => {
    if (!term.trim() || !spokenText.trim()) {
      setError('Vui lòng nhập từ gốc và cách phát âm trước khi thử.');
      return;
    }
    const testSample = sampleText.trim() || `Thử nghiệm câu với từ ${term} trong ngữ cảnh thực tế.`;
    try {
      setIsTesting(true);
      const res = await testRule(
        {
          term: term.trim(),
          spokenText: spokenText.trim(),
          category: category.trim() || undefined,
          providerScope,
          caseSensitive,
          wholeWord,
          priority,
          note: note.trim() || undefined,
          enabled: true
        },
        testSample
      );
      setTestResult(res);
    } catch (err) {
      console.error('Modal test error:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !spokenText.trim()) {
      setError('Từ gốc và cách phát âm không được để trống.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (rule) {
        const changes: UpdatePronunciationRuleInput = {
          term: term.trim(),
          spokenText: spokenText.trim(),
          category: category.trim() || undefined,
          providerScope,
          caseSensitive,
          wholeWord,
          priority,
          note: note.trim() || undefined,
          enabled
        };
        const updated = await updateRule(rule.id, changes);
        onSaved(updated);
      } else {
        const input: CreatePronunciationRuleInput = {
          term: term.trim(),
          spokenText: spokenText.trim(),
          category: category.trim() || undefined,
          providerScope,
          caseSensitive,
          wholeWord,
          priority,
          note: note.trim() || undefined,
          enabled
        };
        const created = await createRule(input);
        onSaved(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('DICTIONARY_RULE_ALREADY_EXISTS') || msg.includes('already exists')) {
        setError(t.dictionary.ruleAlreadyExists);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {rule ? t.dictionary.editRule : t.dictionary.addRule}
            </h3>
            <p className="text-xs text-muted-foreground">{t.dictionary.exampleNotice}</p>
          </div>
          <button
            onClick={() => {
              stopAllPronunciationAudio();
              onClose();
            }}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Term */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t.dictionary.term} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={250}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t.dictionary.termPlaceholder}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            {/* Spoken Text */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-foreground">
                  {t.dictionary.spokenText} <span className="text-destructive">*</span>
                </label>
                {spokenText.trim() && (
                  <PronunciationAudioButton
                    text={spokenText}
                    voiceId={selectedVoiceId}
                    providerId={selectedProviderId}
                    size="sm"
                    label="Nghe thử"
                  />
                )}
              </div>
              <input
                type="text"
                required
                maxLength={1000}
                value={spokenText}
                onChange={(e) => setSpokenText(e.target.value)}
                placeholder={t.dictionary.spokenTextPlaceholder}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t.dictionary.category}
              </label>
              <input
                type="text"
                list="category-suggestions"
                maxLength={100}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t.dictionary.categoryPlaceholder}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <datalist id="category-suggestions">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            {/* Provider Scope */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t.dictionary.providerScope}
              </label>
              <select
                value={providerScope}
                onChange={(e) => setProviderScope(e.target.value as ProviderScope)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">{t.dictionary.allProviders}</option>
                <option value="EDGE">Edge TTS</option>
                <option value="LUCYLAB">LucyLab</option>
                <option value="ELEVENLABS">ElevenLabs</option>
                <option value="VBEE">Vbee</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t.dictionary.priority} (Mặc định: 0)
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-6 py-2 border-y border-border/60">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={wholeWord}
                onChange={(e) => setWholeWord(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span>{t.dictionary.wholeWord}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span>{t.dictionary.caseSensitive}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span>{t.dictionary.enabled}</span>
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {t.dictionary.note}
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.dictionary.notePlaceholder}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Inline Live Test section */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t.dictionary.testRule}
              </span>

              {/* Compact Voice Selector */}
              <div className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">Giọng đọc:</span>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => {
                    const vId = e.target.value;
                    setSelectedVoiceId(vId);
                    const matched = voices.find((v) => v.id === vId);
                    if (matched) {
                      setSelectedProviderId(matched.providerId);
                    }
                  }}
                  aria-label="Chọn giọng đọc thử nghiệm"
                  className="rounded border border-input bg-background px-2 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[200px]"
                >
                  {(voices.length > 0
                    ? voices
                    : [
                        { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My', providerId: 'edge-tts' },
                        { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh', providerId: 'edge-tts' }
                      ]
                  ).map((v) => (
                    <option key={`${v.providerId}:${v.id}`} value={v.id}>
                      {v.name} ({v.providerId === 'edge-tts' ? 'Edge' : v.providerId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                placeholder={t.dictionary.sampleTextPlaceholder}
                className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleTestInModal}
                disabled={isTesting || !term.trim()}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 shrink-0"
              >
                <Play className="h-3 w-3" />
                <span>{isTesting ? '...' : 'Kiểm tra ngay'}</span>
              </button>
            </div>

            {testResult && (
              <div className="text-xs space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium">Kết quả thử nghiệm:</span>
                  <span
                    className={
                      testResult.matched
                        ? 'text-emerald-500 font-medium'
                        : 'text-amber-500 font-medium'
                    }
                  >
                    {testResult.matched ? t.dictionary.testMatched : t.dictionary.testNotMatched}
                  </span>
                </div>

                {/* Compare Original */}
                <div className="p-2 rounded bg-background/70 border border-border space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t.dictionary.testResultBefore} (Gốc):</span>
                    <PronunciationAudioButton
                      text={testResult.original}
                      voiceId={selectedVoiceId}
                      providerId={selectedProviderId}
                      size="sm"
                      label="Nghe gốc"
                    />
                  </div>
                  <div className="text-muted-foreground font-mono text-[11px] break-words">
                    {testResult.original}
                  </div>
                </div>

                {/* Compare Processed */}
                <div className="p-2 rounded bg-primary/5 border border-primary/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-primary">
                    <span>{t.dictionary.testResultAfter} (Đã áp dụng quy tắc):</span>
                    <PronunciationAudioButton
                      text={testResult.processed}
                      voiceId={selectedVoiceId}
                      providerId={selectedProviderId}
                      size="sm"
                      label="Nghe sau xử lý"
                    />
                  </div>
                  <div className="text-foreground font-mono text-[11px] font-semibold break-words">
                    {testResult.processed}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                stopAllPronunciationAudio();
                onClose();
              }}
              disabled={isSubmitting}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !term.trim() || !spokenText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Đang lưu...' : t.common.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
