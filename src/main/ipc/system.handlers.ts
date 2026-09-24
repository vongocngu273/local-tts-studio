import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { SystemInfoSchema, FFmpegStatusSchema } from '@shared/schemas/system.schema';
import { systemInfoService } from '../services/system/systemInfo.service';
import { logger } from '../services/logger/logger';

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, async () => {
    try {
      const rawInfo = systemInfoService.getSystemInfo();
      return SystemInfoSchema.parse(rawInfo);
    } catch (error) {
      logger.error('ipc:system', 'Failed to retrieve system diagnostic info', error);
      throw error;
    }
  });

  // Handler for FFmpeg status query
  ipcMain.handle('system:get-ffmpeg-status', async () => {
    try {
      const status = systemInfoService.getFFmpegStatus();
      return FFmpegStatusSchema.parse(status);
    } catch (error) {
      logger.error('ipc:system', 'Failed to retrieve FFmpeg status', error);
      throw error;
    }
  });
}
