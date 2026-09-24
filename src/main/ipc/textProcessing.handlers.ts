import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { textProcessingService } from '../services/text-processing/textProcessing.service';
import { TextProcessingRequestSchema, TextProcessingSettingsSchema } from '@shared/schemas/textProcessing.schema';
import { z } from 'zod';
import { logger } from '../services/logger/logger';

export function registerTextProcessingHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TEXT_PROCESS_PREVIEW, async (_event, rawInput) => {
    try {
      const input = TextProcessingRequestSchema.parse(rawInput);
      return textProcessingService.process(input);
    } catch (error) {
      logger.error('ipc:text-processing', 'Error previewing text processing', error);
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.TEXT_PROCESS_PROJECT,
    async (_event, { projectId: rawId, settings: rawSettings }) => {
      try {
        const projectId = z.string().uuid().parse(rawId);
        const settings = rawSettings ? TextProcessingSettingsSchema.partial().parse(rawSettings) : undefined;
        return await textProcessingService.processProject(projectId, settings);
      } catch (error) {
        logger.error('ipc:text-processing', `Error processing project ${rawId}`, error);
        throw error;
      }
    }
  );
}
