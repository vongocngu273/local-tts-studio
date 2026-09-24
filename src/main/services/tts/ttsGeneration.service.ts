import fs from 'fs';
import crypto from 'crypto';
import type {
  TTSGeneration,
  VoicePreviewRequest,
  ProjectAudioGenerateRequest,
  ProviderId,
  VoiceSettings
} from '@shared/types/provider.types';
import { projectRepository } from '../../database/repositories/project.repository';
import { appMetadataRepository } from '../../database/repositories/appMetadata.repository';
import { generationRepository } from '../../database/repositories/generation.repository';
import { providerSettingsRepository } from '../../database/repositories/providerSettings.repository';
import { audioStorageService } from '../audio/audioStorage.service';
import { providerRegistry } from '../../providers/provider.registry';
import { TTSProviderError } from '../../providers/provider.errors';
import { logger } from '../logger/logger';

export class TTSGenerationService {
  /**
   * Generates project audio track.
   * Strict Safety Rules:
   * 1. ONLY uses processed_text (NEVER original_text).
   * 2. processed_text MUST NOT be STALE.
   */
  public async generateProjectAudio(request: ProjectAudioGenerateRequest): Promise<TTSGeneration> {
    const { projectId } = request;
    const project = projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // 1. Verify processed text exists
    const textToSynthesize = project.processedText?.trim();
    if (!textToSynthesize) {
      throw new TTSProviderError(
        'edge-tts',
        'NO_PROCESSED_TEXT',
        'Project has no processed script. Please run text processing before generating audio.'
      );
    }

    // 2. Strict Stale Check
    const currentDictRev = appMetadataRepository.getDictionaryRevision();
    const procMeta = project.settings?.textProcessing;

    const isStale =
      !procMeta ||
      procMeta.processedFromRevision === undefined ||
      project.revision > procMeta.processedFromRevision ||
      (procMeta.processedWithDictionaryRevision !== undefined &&
        currentDictRev > procMeta.processedWithDictionaryRevision);

    if (isStale) {
      throw new TTSProviderError(
        'edge-tts',
        'SCRIPT_STALE',
        'The processed script is stale because the original text or pronunciation dictionary has changed. Please reprocess the script before generating audio.'
      );
    }

    // 3. Resolve Provider and Voice
    const providerId: ProviderId =
      request.providerId || (project.providerId as ProviderId) || 'edge-tts';

    const provider = providerRegistry.getProvider(providerId);

    const providerSettings = providerSettingsRepository.get(providerId);
    const voiceId =
      request.voiceId ||
      project.voiceId ||
      providerSettings?.default_voice_id ||
      'vi-VN-HoaiMyNeural';

    const modelId = request.settings?.modelId || providerSettings?.default_model_id || null;

    const settings: VoiceSettings = {
      speed: request.settings?.speed ?? 1.0,
      pitch: request.settings?.pitch ?? 0,
      volume: request.settings?.volume ?? 100,
      modelId: modelId ?? undefined,
      stability: request.settings?.stability,
      similarityBoost: request.settings?.similarityBoost,
      style: request.settings?.style,
      useSpeakerBoost: request.settings?.useSpeakerBoost
    };

    // 4. Compute deterministic input hash
    const hashPayload = [
      'project',
      projectId,
      providerId,
      voiceId,
      modelId || '',
      textToSynthesize,
      JSON.stringify(settings),
      project.revision,
      currentDictRev
    ].join(':');

    const inputHash = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const generationId = crypto.randomUUID();

    logger.info(
      'tts:generation',
      `Starting audio synthesis for project ${projectId} [${providerId}:${voiceId}] (${textToSynthesize.length} chars)`
    );

    // 5. Create initial record in SQLite (status: processing)
    generationRepository.create({
      id: generationId,
      projectId,
      purpose: 'project',
      providerId,
      voiceId,
      modelId,
      inputHash,
      dictionaryRevision: currentDictRev,
      processorVersion: procMeta.processorVersion || 1,
      characterCount: textToSynthesize.length,
      status: 'processing',
      settings
    });

    try {
      // 6. Invoke provider synthesis
      const result = await provider.synthesize({
        text: textToSynthesize,
        voiceId,
        modelId,
        speed: settings.speed,
        pitch: settings.pitch,
        volume: settings.volume,
        settings
      });

      // 7. Atomically save audio file to project workspace
      const { filePath, sizeBytes } = await audioStorageService.saveProjectAudio(
        projectId,
        generationId,
        result.audioBuffer,
        result.format
      );

      // 8. Save companion timings / subtitles if present
      let timingPath: string | null = null;
      if (result.timings) {
        timingPath = await audioStorageService.saveTimingFile(filePath, result.timings);
      }

      let srtPath: string | null = null;
      if (result.subtitles) {
        srtPath = await audioStorageService.saveSubtitleFile(filePath, result.subtitles);
      }

      // 9. Update generation record in SQLite
      const updated = generationRepository.update(generationId, {
        status: 'completed',
        outputPath: filePath,
        sizeBytes,
        timingPath,
        providerSubtitlePath: srtPath,
        providerRequestId: result.requestId ?? null,
        providerJobId: result.jobId ?? null,
        completedAt: new Date().toISOString()
      });

      // 10. Update project's last used provider & voice in SQLite
      projectRepository.update(projectId, {
        providerId,
        voiceId
      });

      logger.info(
        'tts:generation',
        `Successfully generated audio for project ${projectId} -> ${filePath} (${sizeBytes} bytes)`
      );

      return updated!;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = err instanceof TTSProviderError ? err.code : 'SYNTHESIS_ERROR';

      logger.error('tts:generation', `Failed generating audio for project ${projectId}`, err);

      generationRepository.update(generationId, {
        status: 'failed',
        errorCode,
        errorMessage,
        completedAt: new Date().toISOString()
      });

      throw err;
    }
  }

  /**
   * Generates a short voice preview with caching.
   * Safety limits: default 200 chars, hard safety cap 500 chars.
   */
  public async previewVoice(request: Partial<VoicePreviewRequest>): Promise<TTSGeneration> {
    const providerId: ProviderId =
      request.providerId && request.providerId.trim() !== ''
        ? (request.providerId as ProviderId)
        : 'edge-tts';

    let voiceId = request.voiceId?.trim();
    if (!voiceId) {
      try {
        const providerSettings = providerSettingsRepository.get(providerId);
        voiceId = providerSettings?.default_voice_id || 'vi-VN-HoaiMyNeural';
      } catch {
        voiceId = 'vi-VN-HoaiMyNeural';
      }
    }

    const { settings } = request;
    const provider = providerRegistry.getProvider(providerId);

    // Hard safety cap: 500 characters
    let sampleText = request.text?.trim() || 'Xin chào, đây là giọng đọc thử nghiệm trên hệ thống Local TTS Studio.';
    if (sampleText.length > 500) {
      sampleText = sampleText.slice(0, 500);
    }

    const previewSettings: VoiceSettings = {
      speed: settings?.speed ?? 1.0,
      pitch: settings?.pitch ?? 0,
      volume: settings?.volume ?? 100,
      modelId: settings?.modelId,
      stability: settings?.stability,
      similarityBoost: settings?.similarityBoost,
      style: settings?.style,
      useSpeakerBoost: settings?.useSpeakerBoost
    };

    // Deterministic preview cache key
    const hashPayload = [
      'preview',
      providerId,
      voiceId,
      previewSettings.modelId || '',
      sampleText,
      JSON.stringify(previewSettings)
    ].join(':');

    const cacheHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // Check disk cache
    const cachedFilePath = audioStorageService.getPreviewAudioPath(cacheHash);
    if (cachedFilePath) {
      const existing = generationRepository.getByHash(cacheHash, 'preview');
      if (existing) {
        logger.info('tts:preview', `Returning cached voice preview [${cacheHash}]`);
        return existing;
      }
    }

    const generationId = crypto.randomUUID();
    generationRepository.create({
      id: generationId,
      projectId: null,
      purpose: 'preview',
      providerId,
      voiceId,
      modelId: previewSettings.modelId ?? null,
      inputHash: cacheHash,
      characterCount: sampleText.length,
      status: 'processing',
      settings: previewSettings
    });

    try {
      logger.info('tts:preview', `Synthesizing fresh voice preview for ${providerId}:${voiceId}`);
      const result = await provider.synthesize({
        text: sampleText,
        voiceId,
        modelId: previewSettings.modelId,
        speed: previewSettings.speed,
        pitch: previewSettings.pitch,
        volume: previewSettings.volume,
        settings: previewSettings
      });

      const { filePath, sizeBytes } = await audioStorageService.savePreviewAudio(
        cacheHash,
        result.audioBuffer,
        result.format
      );

      const updated = generationRepository.update(generationId, {
        status: 'completed',
        outputPath: filePath,
        sizeBytes,
        providerRequestId: result.requestId ?? null,
        completedAt: new Date().toISOString()
      });

      return updated!;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = err instanceof TTSProviderError ? err.code : 'PREVIEW_ERROR';

      generationRepository.update(generationId, {
        status: 'failed',
        errorCode,
        errorMessage,
        completedAt: new Date().toISOString()
      });

      throw err;
    }
  }

  public getGeneration(id: string): TTSGeneration | null {
    return generationRepository.getById(id);
  }

  public listGenerations(projectId?: string): TTSGeneration[] {
    return generationRepository.list(projectId);
  }

  public deleteGeneration(id: string): boolean {
    const gen = generationRepository.getById(id);
    if (!gen) return false;

    if (gen.outputPath && fs.existsSync(gen.outputPath) && audioStorageService.isPathWithinWorkspace(gen.outputPath)) {
      try {
        fs.unlinkSync(gen.outputPath);
      } catch (err) {
        logger.warn('tts:generation', `Failed to unlink audio file: ${gen.outputPath}`, err);
      }
    }
    if (gen.timingPath && fs.existsSync(gen.timingPath) && audioStorageService.isPathWithinWorkspace(gen.timingPath)) {
      try {
        fs.unlinkSync(gen.timingPath);
      } catch {
        // ignore
      }
    }
    if (gen.providerSubtitlePath && fs.existsSync(gen.providerSubtitlePath) && audioStorageService.isPathWithinWorkspace(gen.providerSubtitlePath)) {
      try {
        fs.unlinkSync(gen.providerSubtitlePath);
      } catch {
        // ignore
      }
    }

    return generationRepository.delete(id);
  }
}

export const ttsGenerationService = new TTSGenerationService();
