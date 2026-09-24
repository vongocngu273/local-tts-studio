import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import type { AudioCompositionSettings } from '@shared/types/composition.types';
import { audioCompositionService } from '../services/composition/audioComposition.service';
import { logger } from '../services/logger/logger';

export function registerCompositionHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.COMPOSITION_COMPOSE,
    async (_event, projectId: string, settings?: Partial<AudioCompositionSettings>) => {
      try {
        const result = await audioCompositionService.composeProjectAudio(projectId, settings);
        return {
          composition: result.composition,
          isCacheHit: result.isCacheHit
        };
      } catch (err) {
        logger.error('ipc:composition', `Error composing audio for project ${projectId}`, err);
        throw err;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSITION_GET_LATEST, async (_event, projectId: string) => {
    return audioCompositionService.getLatestComposition(projectId);
  });
}
