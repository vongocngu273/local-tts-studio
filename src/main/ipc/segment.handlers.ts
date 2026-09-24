import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import type { SegmentationProfile } from '@shared/types/segment.types';
import type { ProviderId, VoiceSettings } from '@shared/types/provider.types';
import { segmentEngine } from '../services/segmentation/segmentEngine';
import { segmentRepository } from '../database/repositories/segment.repository';
import { logger } from '../services/logger/logger';

export function registerSegmentHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SEGMENT_BUILD,
    async (_event, projectId: string, profile?: Partial<SegmentationProfile>) => {
      try {
        return await segmentEngine.buildSegments({ projectId, profile });
      } catch (err) {
        logger.error('ipc:segment', `Error building segments for project ${projectId}`, err);
        throw err;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SEGMENT_LIST, async (_event, projectId: string) => {
    return segmentRepository.listByProject(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.SEGMENT_GET, async (_event, id: string) => {
    return segmentRepository.getById(id);
  });

  ipcMain.handle(
    IPC_CHANNELS.SEGMENT_UPDATE_OVERRIDE,
    async (_event, id: string, overrideText: string) => {
      try {
        const updated = segmentRepository.updateOverrideText(id, overrideText);
        if (!updated) {
          throw new Error(`Segment ${id} not found.`);
        }
        return updated;
      } catch (err) {
        logger.error('ipc:segment', `Error updating override for segment ${id}`, err);
        throw err;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SEGMENT_RESET_OVERRIDE, async (_event, id: string) => {
    try {
      const reset = segmentRepository.resetOverride(id);
      if (!reset) {
        throw new Error(`Segment ${id} not found.`);
      }
      return reset;
    } catch (err) {
      logger.error('ipc:segment', `Error resetting override for segment ${id}`, err);
      throw err;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SEGMENT_UPDATE_VOICE,
    async (
      _event,
      id: string,
      providerId: ProviderId,
      voiceId: string,
      settings?: VoiceSettings
    ) => {
      try {
        const updated = segmentRepository.update(id, {
          providerId,
          voiceId,
          settings: settings || {}
        });
        if (!updated) {
          throw new Error(`Segment ${id} not found.`);
        }
        return updated;
      } catch (err) {
        logger.error('ipc:segment', `Error updating voice for segment ${id}`, err);
        throw err;
      }
    }
  );
}
