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

describe('Pronunciation Dictionary Audio Preview', () => {
  let tempBaseDir: string;
  let ttsService: TTSGenerationService;
  let generationStore: Map<string, TTSGeneration>;
  let synthesizeSpy: MockInstance<ITTSProvider['synthesize']>;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-dict-preview-'));
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
      const updated: TTSGeneration = {
        ...existing,
        ...partial
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
      audioBuffer: Buffer.from('MOCK_EDGE_TTS_PREVIEW_AUDIO_STREAM_BINARY'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      timings: [{ text: 'sample', offset: 0, duration: 200 }]
    });

    ttsService = new TTSGenerationService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('synthesizes audio preview with explicit text, provider, and voice', async () => {
    const result = await ttsService.previewVoice({
      text: 'Trí tuệ nhân tạo AI',
      providerId: 'edge-tts',
      voiceId: 'vi-VN-NamMinhNeural'
    });

    expect(synthesizeSpy).toHaveBeenCalledTimes(1);
    expect(synthesizeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Trí tuệ nhân tạo AI',
        voiceId: 'vi-VN-NamMinhNeural'
      })
    );

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.providerId).toBe('edge-tts');
    expect(result.voiceId).toBe('vi-VN-NamMinhNeural');
    expect(result.outputPath).not.toBeNull();
    expect(fs.existsSync(result.outputPath!)).toBe(true);
  });

  it('falls back to edge-tts and vi-VN-HoaiMyNeural when providerId and voiceId are omitted', async () => {
    const result = await ttsService.previewVoice({
      text: 'tê ét hai bốn'
    });

    expect(synthesizeSpy).toHaveBeenCalledTimes(1);
    expect(synthesizeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'tê ét hai bốn',
        voiceId: 'vi-VN-HoaiMyNeural'
      })
    );

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
    expect(result.providerId).toBe('edge-tts');
    expect(result.voiceId).toBe('vi-VN-HoaiMyNeural');
    expect(result.outputPath).not.toBeNull();
    expect(fs.existsSync(result.outputPath!)).toBe(true);
  });

  it('falls back to default voice when providerId or voiceId are empty strings', async () => {
    const result = await ttsService.previewVoice({
      text: 'Từ điển phát âm kiểm tra',
      providerId: '' as unknown as ProviderId,
      voiceId: '   '
    });

    expect(synthesizeSpy).toHaveBeenCalledTimes(1);
    expect(synthesizeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Từ điển phát âm kiểm tra',
        voiceId: 'vi-VN-HoaiMyNeural'
      })
    );

    expect(result.providerId).toBe('edge-tts');
    expect(result.voiceId).toBe('vi-VN-HoaiMyNeural');
  });

  it('reuses cached voice preview when the same pronunciation phrase is requested multiple times', async () => {
    const preview1 = await ttsService.previewVoice({
      text: 'khái niệm mới'
    });

    expect(synthesizeSpy).toHaveBeenCalledTimes(1);
    expect(preview1.status).toBe('completed');
    expect(preview1.outputPath).not.toBeNull();
    expect(fs.existsSync(preview1.outputPath!)).toBe(true);

    // Second call with identical text and default voice
    const preview2 = await ttsService.previewVoice({
      text: 'khái niệm mới'
    });

    // Synthesize should NOT be called again
    expect(synthesizeSpy).toHaveBeenCalledTimes(1);
    expect(preview2.id).toBe(preview1.id);
    expect(preview2.inputHash).toBe(preview1.inputHash);
    expect(preview2.outputPath).toBe(preview1.outputPath);

    // Call with different text should trigger synthesis
    const preview3 = await ttsService.previewVoice({
      text: 'cụm từ khác biệt'
    });

    expect(synthesizeSpy).toHaveBeenCalledTimes(2);
    expect(preview3.id).not.toBe(preview1.id);
  });
});
