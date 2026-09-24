import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  SubtitleCue,
  SubtitleExportFormat,
  SubtitleExportResult,
  SubtitleSettings
} from '@shared/types/subtitle.types';
import { DEFAULT_SUBTITLE_SETTINGS } from '@shared/types/subtitle.types';
import { segmentRepository } from '../../database/repositories/segment.repository';
import { subtitleRepository } from '../../database/repositories/subtitle.repository';
import { audioStorageService } from '../audio/audioStorage.service';
import { subtitleTimingService } from './subtitleTiming.service';
import { SrtWriter } from './srtWriter';
import { VttWriter } from './vttWriter';
import { logger } from '../logger/logger';

export class SubtitleService {
  /**
   * Generates subtitle cues for all completed segments of a project.
   */
  public async buildCues(
    projectId: string,
    sentencePauseMs = 250,
    paragraphPauseMs = 600,
    settings?: Partial<SubtitleSettings>
  ): Promise<SubtitleCue[]> {
    const mergedSettings: SubtitleSettings = {
      ...DEFAULT_SUBTITLE_SETTINGS,
      ...settings
    };

    const segments = segmentRepository
      .listByProject(projectId)
      .filter((s) => s.status === 'completed' && s.audioPath);

    if (segments.length === 0) {
      return [];
    }

    return subtitleTimingService.generateCues(
      segments,
      sentencePauseMs,
      paragraphPauseMs,
      mergedSettings
    );
  }

  /**
   * Exports project subtitles to SRT or VTT file on disk.
   */
  public async exportSubtitles(
    projectId: string,
    format: SubtitleExportFormat = 'srt',
    sentencePauseMs = 250,
    paragraphPauseMs = 600,
    settings?: Partial<SubtitleSettings>
  ): Promise<SubtitleExportResult> {
    const mergedSettings: SubtitleSettings = {
      ...DEFAULT_SUBTITLE_SETTINGS,
      ...settings
    };

    const cues = await this.buildCues(projectId, sentencePauseMs, paragraphPauseMs, mergedSettings);
    if (cues.length === 0) {
      throw new Error('No completed audio segments available to generate subtitles.');
    }

    const content =
      format === 'srt'
        ? SrtWriter.write(cues, mergedSettings)
        : VttWriter.write(cues, mergedSettings);

    const subtitlesDir = audioStorageService.getSubtitlesDir(projectId);
    const exportId = crypto.randomUUID();
    const fileName = `${exportId}.${format}`;
    const filePath = path.join(subtitlesDir, fileName);

    await fs.promises.writeFile(filePath, content, 'utf-8');

    // Record export in DB
    subtitleRepository.insert({
      id: exportId,
      project_id: projectId,
      composition_id: null,
      format,
      source_type: cues.some((c) => c.accuracy === 'word') ? 'word_timings' : 'estimated',
      output_path: filePath,
      cue_count: cues.length,
      settings_json: JSON.stringify(mergedSettings),
      created_at: new Date().toISOString()
    });

    logger.info(
      'subtitle:export',
      `Exported ${cues.length} subtitle cues (${format.toUpperCase()}) -> ${filePath}`
    );

    return {
      filePath,
      cueCount: cues.length,
      format
    };
  }
}

export const subtitleService = new SubtitleService();
