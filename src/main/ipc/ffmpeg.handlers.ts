import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { ffmpegBinaryService } from '../services/ffmpeg/ffmpegBinary.service';
import { logger } from '../services/logger/logger';

export function registerFFmpegHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FFMPEG_GET_STATUS, async () => {
    try {
      return await ffmpegBinaryService.testFFmpeg();
    } catch (err) {
      logger.error('ipc:ffmpeg', 'Error checking FFmpeg status', err);
      return {
        available: false,
        error: String(err)
      };
    }
  });
}
