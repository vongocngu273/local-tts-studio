import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AudioComposition, AudioCompositionSettings } from '@shared/types/composition.types';
import { DEFAULT_COMPOSITION_SETTINGS } from '@shared/types/composition.types';
import { segmentRepository } from '../../database/repositories/segment.repository';
import { compositionRepository } from '../../database/repositories/composition.repository';
import { audioStorageService } from '../audio/audioStorage.service';
import { ffmpegService, SegmentAudioOffset } from '../ffmpeg/ffmpeg.service';
import { logger } from '../logger/logger';

export interface ComposeProjectAudioResult {
  composition: AudioComposition;
  segmentOffsets: SegmentAudioOffset[];
  isCacheHit: boolean;
}

export class AudioCompositionService {
  /**
   * Composes a complete audio file from all completed segments of a project.
   * Leverages deterministic SHA-256 fingerprinting to avoid re-rendering identical audio.
   */
  public async composeProjectAudio(
    projectId: string,
    settings?: Partial<AudioCompositionSettings>,
    onProgress?: (percent: number) => void
  ): Promise<ComposeProjectAudioResult> {
    const mergedSettings: AudioCompositionSettings = {
      ...DEFAULT_COMPOSITION_SETTINGS,
      ...settings
    };

    const allSegments = segmentRepository.listByProject(projectId);
    if (allSegments.length === 0) {
      throw new Error('Project has no segments to compose.');
    }

    const uncompleted = allSegments.filter((s) => s.status !== 'completed' || !s.audioPath);
    if (uncompleted.length > 0) {
      throw new Error(
        `Cannot compose audio: ${uncompleted.length} of ${allSegments.length} segment(s) are not ready.`
      );
    }

    // Deterministic fingerprint of all segment audios + composition settings
    const fingerprint = this.computeFingerprint(allSegments, mergedSettings);

    // Check for existing valid composition cache
    const existing = compositionRepository.getByFingerprint(projectId, fingerprint);
    if (
      existing &&
      existing.outputMp3Path &&
      fs.existsSync(existing.outputMp3Path)
    ) {
      logger.info(
        'composition:service',
        `Reusing existing audio composition ${existing.id} (fingerprint: ${fingerprint.slice(0, 10)})`
      );

      // Recompute offsets mathematically
      const offsets = this.computeSegmentOffsets(allSegments, mergedSettings);

      if (onProgress) onProgress(100);

      return {
        composition: existing,
        segmentOffsets: offsets,
        isCacheHit: true
      };
    }

    const compositionId = crypto.randomUUID();
    const compDir = audioStorageService.getCompositionsDir(projectId);
    const outputMp3Path = path.join(compDir, `${compositionId}.mp3`);

    const mergeInputs = allSegments.map((s) => ({
      id: s.id,
      audioPath: s.audioPath!,
      durationMs: s.durationMs || 1000,
      paragraphIndex: s.paragraphIndex
    }));

    const mergeResult = await ffmpegService.mergeSegmentsAudio({
      segments: mergeInputs,
      sentencePauseMs: mergedSettings.sentencePauseMs,
      paragraphPauseMs: mergedSettings.paragraphPauseMs,
      outputFilePath: outputMp3Path,
      format: 'mp3',
      sampleRate: 44100,
      bitrate: `${mergedSettings.targetBitrateKbps || 128}k`,
      channels: 2,
      onProgress
    });

    const now = new Date().toISOString();
    const composition: AudioComposition = {
      id: compositionId,
      projectId,
      sourceFingerprint: fingerprint,
      segmentCount: allSegments.length,
      outputMp3Path: mergeResult.filePath,
      outputWavPath: null,
      durationMs: mergeResult.durationMs,
      sizeBytes: mergeResult.sizeBytes,
      settings: mergedSettings,
      status: 'completed',
      createdAt: now,
      completedAt: now
    };

    compositionRepository.insert(composition);

    logger.info(
      'composition:service',
      `Audio composition created: ${composition.id} (${mergeResult.durationMs}ms, ${mergeResult.sizeBytes} bytes)`
    );

    return {
      composition,
      segmentOffsets: mergeResult.segmentOffsets,
      isCacheHit: false
    };
  }

  public getLatestComposition(projectId: string): AudioComposition | null {
    return compositionRepository.getLatestByProject(projectId);
  }

  private computeFingerprint(
    segments: { id: string; textHash: string; durationMs: number | null }[],
    settings: AudioCompositionSettings
  ): string {
    const raw = [
      segments.map((s) => `${s.id}:${s.textHash}:${s.durationMs ?? 0}`).join('|'),
      settings.sentencePauseMs,
      settings.paragraphPauseMs,
      settings.targetBitrateKbps,
      settings.normalizationEnabled
    ].join(':');

    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private computeSegmentOffsets(
    segments: { id: string; durationMs: number | null; paragraphIndex: number }[],
    settings: AudioCompositionSettings
  ): SegmentAudioOffset[] {
    const offsets: SegmentAudioOffset[] = [];
    let currentMs = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const dur = seg.durationMs || 1000;
      const startMs = currentMs;
      const endMs = startMs + dur;

      let pauseAfterMs = 0;
      if (i < segments.length - 1) {
        const nextSeg = segments[i + 1];
        pauseAfterMs =
          nextSeg.paragraphIndex > seg.paragraphIndex
            ? settings.paragraphPauseMs
            : settings.sentencePauseMs;
      }

      offsets.push({
        segmentId: seg.id,
        startMs,
        endMs,
        durationMs: dur,
        pauseAfterMs
      });

      currentMs = endMs + pauseAfterMs;
    }

    return offsets;
  }
}

export const audioCompositionService = new AudioCompositionService();
