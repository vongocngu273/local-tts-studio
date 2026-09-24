import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import type { SubtitleExportFormat, SubtitleSettings } from '@shared/types/subtitle.types';
import { subtitleService } from '../services/subtitles/subtitle.service';
import { logger } from '../services/logger/logger';

export function registerSubtitleHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SUBTITLE_BUILD_CUES,
    async (
      _event,
      projectId: string,
      sentencePauseMs?: number,
      paragraphPauseMs?: number,
      settings?: Partial<SubtitleSettings>
    ) => {
      try {
        return await subtitleService.buildCues(
          projectId,
          sentencePauseMs,
          paragraphPauseMs,
          settings
        );
      } catch (err) {
        logger.error('ipc:subtitle', `Error building cues for project ${projectId}`, err);
        throw err;
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SUBTITLE_EXPORT,
    async (
      _event,
      projectId: string,
      format: SubtitleExportFormat,
      sentencePauseMs?: number,
      paragraphPauseMs?: number,
      settings?: Partial<SubtitleSettings>
    ) => {
      try {
        return await subtitleService.exportSubtitles(
          projectId,
          format,
          sentencePauseMs,
          paragraphPauseMs,
          settings
        );
      } catch (err) {
        logger.error('ipc:subtitle', `Error exporting subtitles for project ${projectId}`, err);
        throw err;
      }
    }
  );
}
