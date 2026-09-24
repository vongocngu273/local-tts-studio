import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { TTSGenerationService } from '../src/main/services/tts/ttsGeneration.service';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { appMetadataRepository } from '../src/main/database/repositories/appMetadata.repository';
import { generationRepository } from '../src/main/database/repositories/generation.repository';
import { providerRegistry } from '../src/main/providers/provider.registry';
import { TTSProviderError } from '../src/main/providers/provider.errors';
import type { ITTSProvider, ProviderSynthesisResult } from '../src/main/providers/provider.types';
import type { ProviderId, VoiceDefinition } from '../src/shared/types/provider.types';
import type { Project, ProjectSettings } from '../src/shared/types/project.types';

// Mock Provider for deterministic offline testing
class MockTTSProvider implements ITTSProvider {
  public readonly id: ProviderId = 'mock-test' as ProviderId;
  public readonly name = 'Mock TTS Engine';
  public readonly capabilities = {
    supportsPitch: true,
    supportsRate: true,
    supportsVolume: true,
    supportsTimings: true,
    supportsSrt: true,
    supportsCustomModels: false,
    minRate: 0.5,
    maxRate: 2.0,
    minPitch: -50,
    maxPitch: 50,
    requiresApiKey: false,
    maxTextLength: 10000
  };

  public isConfigured(): boolean {
    return true;
  }

  public async getVoices(): Promise<VoiceDefinition[]> {
    return [
      {
        id: 'mock-vi-1',
        providerId: this.id,
        name: 'Mock Vietnamese Voice',
        locale: 'vi-VN',
        language: 'VI',
        gender: 'female',
        sampleRate: 24000
      }
    ];
  }

  public async synthesize(): Promise<ProviderSynthesisResult> {
    return {
      audioBuffer: Buffer.from('MOCK_AUDIO_DATA_FOR_TESTING'),
      format: 'mp3',
      mimeType: 'audio/mpeg',
      timings: [{ text: 'Test', offset: 0, duration: 100 }],
      subtitles: '1\n00:00:00,000 --> 00:00:00,100\nTest'
    };
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Connected' };
  }
}

describe('TTSGenerationService & Synthesis Engine', () => {
  let tempBaseDir: string;
  let ttsService: TTSGenerationService;
  const mockProvider = new MockTTSProvider();

  const createTestProject = (id: string, name: string): Project => {
    const now = new Date().toISOString();
    return {
      id,
      name,
      description: '',
      status: 'draft',
      originalText: 'Original test text',
      processedText: '',
      providerId: null,
      voiceId: null,
      settings: {
        version: 1,
        text: { normalizationEnabled: true },
        voice: { speed: 1.0, pitch: 0, volume: 100 }
      },
      projectPath: path.join(tempBaseDir, 'projects', id),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      deletedAt: null
    };
  };

  const createProcessingSettings = (
    processedFromRevision: number,
    processedWithDictionaryRevision: number
  ): ProjectSettings => ({
    version: 1,
    textProcessing: {
      dictionaryEnabled: true,
      whitespaceNormalization: true,
      dateNormalization: true,
      numberNormalization: true,
      currencyNormalization: true,
      abbreviationNormalization: true,
      providerContext: 'ALL',
      processorVersion: 1,
      processedFromRevision,
      processedWithDictionaryRevision
    }
  });

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-tts-test-'));
    appPathsService.initialize(tempBaseDir);
    const dbFilePath = path.join(tempBaseDir, 'database', 'test-tts.db');
    const backupDir = path.join(tempBaseDir, 'backups');

    databaseService.initialize(dbFilePath, backupDir);

    providerRegistry.register(mockProvider);
    ttsService = new TTSGenerationService();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should reject synthesis if project has no processed text', async () => {
    const project = createTestProject('proj-1', 'Unprocessed Project');
    projectRepository.insert(project);

    try {
      await ttsService.generateProjectAudio({
        projectId: project.id,
        providerId: mockProvider.id,
        voiceId: 'mock-vi-1'
      });
      expect.fail('Should have thrown TTSProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(TTSProviderError);
      expect((err as TTSProviderError).code).toBe('NO_PROCESSED_TEXT');
    }
  });

  it('should reject synthesis if processed script is stale due to script revision change', async () => {
    const project = createTestProject('proj-2', 'Stale Project');
    projectRepository.insert(project);

    // Save processed text with processedFromRevision = 1
    projectRepository.saveProcessedText(
      project.id,
      'Văn bản đã qua xử lý',
      createProcessingSettings(1, 0)
    );

    // Now modify original text which bumps project.revision to 2
    projectRepository.update(project.id, {
      originalText: 'Văn bản gốc đã sửa đổi',
      revision: 2
    });

    try {
      await ttsService.generateProjectAudio({
        projectId: project.id,
        providerId: mockProvider.id,
        voiceId: 'mock-vi-1'
      });
      expect.fail('Should have thrown TTSProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(TTSProviderError);
      expect((err as TTSProviderError).code).toBe('SCRIPT_STALE');
    }
  });

  it('should reject synthesis if processed script is stale due to dictionary revision bump', async () => {
    const project = createTestProject('proj-3', 'Stale Dict Project');
    projectRepository.insert(project);

    // Set dictionary revision to 2
    appMetadataRepository.incrementDictionaryRevision();
    appMetadataRepository.incrementDictionaryRevision();

    // Processed with dictionary revision 1
    projectRepository.saveProcessedText(
      project.id,
      'Văn bản đã qua xử lý',
      createProcessingSettings(project.revision, 1)
    );

    try {
      await ttsService.generateProjectAudio({
        projectId: project.id,
        providerId: mockProvider.id,
        voiceId: 'mock-vi-1'
      });
      expect.fail('Should have thrown TTSProviderError');
    } catch (err) {
      expect(err).toBeInstanceOf(TTSProviderError);
      expect((err as TTSProviderError).code).toBe('SCRIPT_STALE');
    }
  });

  it('should successfully synthesize audio for valid and ready processed text', async () => {
    const project = createTestProject('proj-4', 'Ready Project');
    projectRepository.insert(project);

    const dictRev = appMetadataRepository.getDictionaryRevision();
    projectRepository.saveProcessedText(
      project.id,
      'Kịch bản đã chuẩn hóa hoàn toàn',
      createProcessingSettings(project.revision, dictRev)
    );

    const generation = await ttsService.generateProjectAudio({
      projectId: project.id,
      providerId: mockProvider.id,
      voiceId: 'mock-vi-1',
      settings: { speed: 1.0, pitch: 0, volume: 100 }
    });

    expect(generation).toBeDefined();
    expect(generation.status).toBe('completed');
    expect(generation.purpose).toBe('project');
    expect(generation.projectId).toBe(project.id);
    expect(generation.sizeBytes).toBeGreaterThan(0);
    expect(generation.outputPath).not.toBeNull();
    expect(fs.existsSync(generation.outputPath!)).toBe(true);

    // Verify companion timing and srt files were written
    expect(generation.timingPath).not.toBeNull();
    expect(fs.existsSync(generation.timingPath!)).toBe(true);
    expect(generation.providerSubtitlePath).not.toBeNull();
    expect(fs.existsSync(generation.providerSubtitlePath!)).toBe(true);

    // Verify SQLite record exists in repository
    const dbRecord = generationRepository.getById(generation.id);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.status).toBe('completed');

    // Verify project last used voice updated
    const updatedProj = projectRepository.findById(project.id);
    expect(updatedProj?.providerId).toBe(mockProvider.id);
    expect(updatedProj?.voiceId).toBe('mock-vi-1');
  });

  it('should generate, cache, and reuse voice preview', async () => {
    const preview1 = await ttsService.previewVoice({
      providerId: mockProvider.id,
      voiceId: 'mock-vi-1',
      text: 'Đây là câu thử giọng đọc.'
    });

    expect(preview1).toBeDefined();
    expect(preview1.status).toBe('completed');
    expect(preview1.purpose).toBe('preview');
    expect(preview1.outputPath).not.toBeNull();
    expect(fs.existsSync(preview1.outputPath!)).toBe(true);

    // Second call with same text and voice should reuse the cached preview
    const preview2 = await ttsService.previewVoice({
      providerId: mockProvider.id,
      voiceId: 'mock-vi-1',
      text: 'Đây là câu thử giọng đọc.'
    });

    expect(preview2.id).toBe(preview1.id);
    expect(preview2.inputHash).toBe(preview1.inputHash);
  });

  it('should delete generation record and associated audio files', async () => {
    const project = createTestProject('proj-5', 'To Delete Gen Project');
    projectRepository.insert(project);

    const dictRev = appMetadataRepository.getDictionaryRevision();
    projectRepository.saveProcessedText(
      project.id,
      'Kịch bản cần xóa kết quả',
      createProcessingSettings(project.revision, dictRev)
    );

    const generation = await ttsService.generateProjectAudio({
      projectId: project.id,
      providerId: mockProvider.id,
      voiceId: 'mock-vi-1'
    });

    const audioFile = generation.outputPath!;
    expect(fs.existsSync(audioFile)).toBe(true);

    const deleted = await ttsService.deleteGeneration(generation.id);
    expect(deleted).toBe(true);

    expect(fs.existsSync(audioFile)).toBe(false);
    expect(generationRepository.getById(generation.id)).toBeNull();
  });
});
