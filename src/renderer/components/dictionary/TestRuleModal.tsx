import React, { useState, useEffect, useCallback } from 'react';
import { X, Play, CheckCircle2, AlertCircle, Sparkles, Volume2 } from 'lucide-react';
import type { PronunciationRule, CreatePronunciationRuleInput } from '@shared/types/dictionary.types';
import { useDictionaryStore } from '../../stores/dictionary.store';
import { useTranslation } from '../../stores/app.store';
import { useVoiceStore } from '../../stores/voice.store';
import { PronunciationAudioButton, stopAllPronunciationAudio } from './PronunciationAudioButton';

interface TestRuleModalProps {
  rule: PronunciationRule | CreatePronunciationRuleInput;
  isOpen: boolean;
  onClose: () => void;
}

export const TestRuleModal: React.FC<TestRuleModalProps> = ({ rule, isOpen, onClose }) => {
  const { testRule } = useDictionaryStore();
  const { t } = useTranslation();
  const { voices, fetchVoices } = useVoiceStore();

  const [selectedVoiceId, setSelectedVoiceId] = useState('vi-VN-HoaiMyNeural');
  const [selectedProviderId, setSelectedProviderId] = useState('edge-tts');

  const [sampleText, setSampleText] = useState<string>(
    rule.term ? `Đây là câu thử nghiệm với từ ${rule.term} trong ngữ cảnh thực tế.` : ''
  );
  const [result, setResult] = useState<{ original: string; processed: string; matched: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (voices.length === 0) {
      fetchVoices();
    }
  }, [voices.length, fetchVoices]);

  const runTest = useCallback(async (textToTest: string) => {
    if (!textToTest.trim() || !rule.term) {
      setResult(null);
      return;
    }
    try {
      setTesting(true);
      const res = await testRule(rule, textToTest);
      setResult(res);
    } catch (err) {
      console.error('Failed to test rule:', err);
    } finally {
      setTesting(false);
    }
  }, [rule, testRule]);

  useEffect(() => {
    if (isOpen && rule.term) {
      const defaultSample = `Đây là câu thử nghiệm với từ ${rule.term} trong ngữ cảnh thực tế.`;
      setSampleText(defaultSample);
      runTest(defaultSample);
    }
  }, [isOpen, rule.term, runTest]);

  if (!isOpen) return null;

  const handleClose = () => {
    stopAllPronunciationAudio();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {t.dictionary.testRule}: <span className="text-primary font-mono">{rule.term}</span>
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>
                {t.dictionary.spokenText}: <strong className="text-foreground">{rule.spokenText || '(chưa nhập)'}</strong>
              </span>
              {rule.spokenText && (
                <PronunciationAudioButton
                  text={rule.spokenText}
                  voiceId={selectedVoiceId}
                  providerId={selectedProviderId}
                  size="sm"
                  label="Nghe"
                />
              )}
            </div>
            <span className="bg-muted px-2 py-0.5 rounded text-[10px]">
              {rule.providerScope || 'ALL'} • {rule.wholeWord ? 'Toàn bộ từ' : 'Từng phần'}
            </span>
          </div>

          {/* Compact Voice Selector */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              <span>Giọng đọc thử:</span>
            </span>
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
              className="rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[220px]"
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

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {t.dictionary.sampleText}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runTest(sampleText)}
                placeholder={t.dictionary.sampleTextPlaceholder}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => runTest(sampleText)}
                disabled={testing || !sampleText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{testing ? '...' : 'Thử'}</span>
              </button>
            </div>
          </div>

          {result && (
            <div className="space-y-3 pt-2">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  result.matched
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                {result.matched ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{t.dictionary.testMatched}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{t.dictionary.testNotMatched}</span>
                  </>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Trước xử lý */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t.dictionary.testResultBefore}:</span>
                    <PronunciationAudioButton
                      text={result.original}
                      voiceId={selectedVoiceId}
                      providerId={selectedProviderId}
                      size="sm"
                      label="Nghe gốc"
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border text-foreground font-mono">
                    {result.original}
                  </div>
                </div>

                {/* Sau xử lý */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium text-primary">
                    <span>{t.dictionary.testResultAfter}:</span>
                    <PronunciationAudioButton
                      text={result.processed}
                      voiceId={selectedVoiceId}
                      providerId={selectedProviderId}
                      size="sm"
                      label="Nghe sau xử lý"
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-foreground font-mono font-medium">
                    {result.processed}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            onClick={handleClose}
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
