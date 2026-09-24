import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { TTSGenerationService } from '../src/main/services/tts/ttsGeneration.service';
import { providerRegistry } from '../src/main/providers/provider.registry';
import { generationRepository } from '../src/main/database/repositories/generation.repository';
import { providerSettingsRepository } from '../src/main/database/repositories/providerSettings.repository';
import type { ITTSProvider } from '../src/main/providers/provider.types';
import type { TTSGeneration, ProviderId } from '../src/shared/types/provider.types';

describe('QA Pronunciation Dictionary Audio Preview Test Suite (TC-20260924-DICTIONARY-AUDIO-PREVIEW)', () => {
  let tempBaseDir: string;
  let ttsService: TTSGenerationService;
  let generationStore: Map<string, TTSGeneration>;
  let synthesizeSpy: MockInstance<ITTSProvider['synthesize']>;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-qa-dict-preview-'));
    appPathsService.initialize(tempBaseDir);

    generationStore = new Map();

    vi.spyOn(providerSettingsRepository, 'get').mockReturnValue(null);

    vi.spyOn(generationRepository, 'create').mockImplementation((input) => {
      const now = new Date().toISOString();
      const gen: TTSGeneration = {
        dictionaryRevision: 1,
        processorVersion: 1,
        characterCount: input.characterCount ?? 0,
        settings: input.settings || {},
        ...input,
        purpose: input.purpose || 'preview',
        status: input.status || 'processing',
        outputFormat: 'mp3',
        mimeType: 'audio/mpeg',
        createdAt: now
      };
      generationStore.set(gen.id, gen);
      return gen;
    });

    vi.spyOn(generationRepository, 'update').mockImplementation((id, partial) => {
      const existing = generationStore.get(id);
      if (!existing) return null;
      const outputPath = partial.outputPath !== undefined ? partial.outputPath : existing.outputPath;
      const updated: TTSGeneration = {
        ...existing,
        ...partial,
        playbackUrl: outputPath ? `localtts-audio://generation/${id}` : null
      };
      generationStore.set(id, updated);
      return updated;
    });

    vi.spyOn(generationRepository, 'getByHash').mockImplementation((hash, purpose) => {
      for (const gen of generationStore.values()) {
        if (gen.inputHash === hash && gen.purpose === purpose && gen.status === 'completed') {
          return gen;
        }
      }
      return null;
    });

    const edgeProvider = providerRegistry.getProvider('edge-tts');
    synthesizeSpy = vi.spyOn(edgeProvider, 'synthesize').mockResolvedValue({
      audioBuffer: Buffer.from('QA_MOCK_EDGE_TTS_PREVIEW_AUDIO_STREAM_BINARY'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      timings: [{ text: 'sample', offset: 0, duration: 250 }]
    });

    ttsService = new TTSGenerationService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Minimal text payload audio synthesis
  // --------------------------------------------------------------------------
  describe('Minimal Payload Audio Synthesis', () => {
    it('synthesizes pronunciation preview with minimal payload (only text provided)', async () => {
      const result = await ttsService.previewVoice({
        text: 'Trí tuệ nhân tạo'
      });

      expect(synthesizeSpy).toHaveBeenCalledTimes(1);
      expect(synthesizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Trí tuệ nhân tạo',
          voiceId: 'vi-VN-HoaiMyNeural'
        })
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.providerId).toBe('edge-tts');
      expect(result.voiceId).toBe('vi-VN-HoaiMyNeural');
      expect(result.outputPath).not.toBeNull();
      expect(fs.existsSync(result.outputPath!)).toBe(true);
      expect(result.playbackUrl).toBe(`localtts-audio://generation/${result.id}`);
    });

    it('falls back to default voice when providerId and voiceId are blank strings', async () => {
      const result = await ttsService.previewVoice({
        text: 'Thử nghiệm dự phòng',
        providerId: '   ' as unknown as ProviderId,
        voiceId: '   '
      });

      expect(synthesizeSpy).toHaveBeenCalledTimes(1);
      expect(synthesizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Thử nghiệm dự phòng',
          voiceId: 'vi-VN-HoaiMyNeural'
        })
      );

      expect(result.providerId).toBe('edge-tts');
      expect(result.voiceId).toBe('vi-VN-HoaiMyNeural');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Explicit provider & voice payloads
  // --------------------------------------------------------------------------
  describe('Explicit Provider & Voice Audio Synthesis', () => {
    it('synthesizes pronunciation preview with explicit providerId and voiceId', async () => {
      const result = await ttsService.previewVoice({
        text: 'Công nghệ thông tin',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-NamMinhNeural'
      });

      expect(synthesizeSpy).toHaveBeenCalledTimes(1);
      expect(synthesizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Công nghệ thông tin',
          voiceId: 'vi-VN-NamMinhNeural'
        })
      );

      expect(result.providerId).toBe('edge-tts');
      expect(result.voiceId).toBe('vi-VN-NamMinhNeural');
      expect(result.status).toBe('completed');
      expect(fs.existsSync(result.outputPath!)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Repeated text caching behavior
  // --------------------------------------------------------------------------
  describe('Repeated Text Caching Behavior', () => {
    it('serves cached preview for repeated requests with identical pronunciation text', async () => {
      const preview1 = await ttsService.previewVoice({
        text: 'cụm từ kiểm tra cache'
      });

      expect(synthesizeSpy).toHaveBeenCalledTimes(1);
      expect(preview1.status).toBe('completed');
      expect(fs.existsSync(preview1.outputPath!)).toBe(true);

      // Repeat request with exact same text
      const preview2 = await ttsService.previewVoice({
        text: 'cụm từ kiểm tra cache'
      });

      // Provider synthesize should NOT be triggered again
      expect(synthesizeSpy).toHaveBeenCalledTimes(1);
      expect(preview2.id).toBe(preview1.id);
      expect(preview2.inputHash).toBe(preview1.inputHash);
      expect(preview2.outputPath).toBe(preview1.outputPath);

      // Different text should trigger a new synthesis
      const preview3 = await ttsService.previewVoice({
        text: 'cụm từ hoàn toàn mới'
      });

      expect(synthesizeSpy).toHaveBeenCalledTimes(2);
      expect(preview3.id).not.toBe(preview1.id);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Component Code Sanity & Audio Lifecycle (PronunciationAudioButton.tsx)
  // --------------------------------------------------------------------------
  describe('PronunciationAudioButton Component Sanity', () => {
    it('verifies PronunciationAudioButton.tsx properly implements audio lifecycle, singleton playback, and unmount cleanup', () => {
      const buttonPath = path.resolve(__dirname, '../src/renderer/components/dictionary/PronunciationAudioButton.tsx');
      expect(fs.existsSync(buttonPath)).toBe(true);

      const content = fs.readFileSync(buttonPath, 'utf-8');

      // 1. Singleton audio instance management
      expect(content).toContain('let globalAudioInstance: HTMLAudioElement | null = null;');
      expect(content).toContain('let globalStopCallback: (() => void) | null = null;');
      expect(content).toContain('export const stopAllPronunciationAudio = (): void => {');

      // 2. Unmount cleanup effect
      expect(content).toContain('useEffect(() => {');
      expect(content).toContain('return () => {');
      expect(content).toContain('audio.pause()');
      expect(content).toContain("audio.removeAttribute('src')");
      expect(content).toContain('audio.load()');

      // 3. Audio error handling & AbortError guard
      expect(content).toContain("'AbortError'");
      expect(content).toContain('audio.onended =');
      expect(content).toContain('audio.onerror =');

      // 4. Accessibility attributes
      expect(content).toContain('title={title || defaultTooltip}');
      expect(content).toContain('aria-label={title || defaultTooltip}');
      expect(content).toContain("type=\"button\"");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Integration Verification in Modals and Dictionary Page
  // --------------------------------------------------------------------------
  describe('Modal & Dictionary Page Integration Verification', () => {
    it('verifies RuleEditorModal.tsx integrates audio preview buttons for spoken text and comparison results', () => {
      const ruleEditorPath = path.resolve(__dirname, '../src/renderer/components/dictionary/RuleEditorModal.tsx');
      expect(fs.existsSync(ruleEditorPath)).toBe(true);

      const content = fs.readFileSync(ruleEditorPath, 'utf-8');

      expect(content).toContain("import { PronunciationAudioButton, stopAllPronunciationAudio } from './PronunciationAudioButton';");

      // Spoken text preview button
      expect(content).toContain('<PronunciationAudioButton');
      expect(content).toContain('text={spokenText}');
      expect(content).toContain('label="Nghe thử"');

      // Compare Original preview button
      expect(content).toContain('text={testResult.original}');
      expect(content).toContain('label="Nghe gốc"');

      // Compare Processed preview button
      expect(content).toContain('text={testResult.processed}');
      expect(content).toContain('label="Nghe sau xử lý"');

      // Cleans up audio when modal closes
      expect(content).toContain('stopAllPronunciationAudio()');
    });

    it('verifies TestRuleModal.tsx integrates audio preview buttons for spoken text and comparison results', () => {
      const testModalPath = path.resolve(__dirname, '../src/renderer/components/dictionary/TestRuleModal.tsx');
      expect(fs.existsSync(testModalPath)).toBe(true);

      const content = fs.readFileSync(testModalPath, 'utf-8');

      expect(content).toContain("import { PronunciationAudioButton, stopAllPronunciationAudio } from './PronunciationAudioButton';");

      // Spoken text preview button
      expect(content).toContain('text={rule.spokenText}');
      expect(content).toContain('label="Nghe"');

      // Before result preview
      expect(content).toContain('text={result.original}');
      expect(content).toContain('label="Nghe gốc"');

      // After result preview
      expect(content).toContain('text={result.processed}');
      expect(content).toContain('label="Nghe sau xử lý"');

      // Cleans up audio when modal closes
      expect(content).toContain('stopAllPronunciationAudio()');
    });

    it('verifies PronunciationDictionaryPage.tsx integrates audio preview icon in rule table rows', () => {
      const dictPagePath = path.resolve(__dirname, '../src/renderer/pages/PronunciationDictionaryPage.tsx');
      expect(fs.existsSync(dictPagePath)).toBe(true);

      const content = fs.readFileSync(dictPagePath, 'utf-8');

      expect(content).toContain("import { PronunciationAudioButton, stopAllPronunciationAudio } from '../components/dictionary/PronunciationAudioButton';");

      // Table row spoken text audio button with accessible title
      expect(content).toContain('<PronunciationAudioButton');
      expect(content).toContain('text={rule.spokenText}');
      expect(content).toContain('providerId={rule.providerScope}');
      expect(content).toContain('title={`Nghe phát âm "${rule.spokenText}"`}');
    });
  });
});
