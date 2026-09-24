import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { jobQueueService } from '../services/job-queue/jobQueue.service';
import { logger } from '../services/logger/logger';

export function registerQueueHandlers(): void {
  // Broadcast queue events to all windows
  jobQueueService.subscribe((event) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.QUEUE_EVENT, event);
      }
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.QUEUE_START,
    async (_event, projectId: string, segmentIds?: string[]) => {
      try {
        return await jobQueueService.enqueueSegments(projectId, segmentIds);
      } catch (err) {
        logger.error('ipc:queue', `Error starting queue for project ${projectId}`, err);
        throw err;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.QUEUE_PAUSE, async () => {
    jobQueueService.pauseQueue();
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_RESUME, async () => {
    jobQueueService.resumeQueue();
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_CANCEL, async (_event, projectId: string) => {
    return jobQueueService.cancelPendingJobs(projectId);
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_GET_STATUS, async (_event, projectId?: string) => {
    return jobQueueService.getQueueStatus(projectId);
  });

  ipcMain.handle(
    IPC_CHANNELS.QUEUE_REGENERATE_SEGMENT,
    async (_event, projectId: string, segmentId: string) => {
      try {
        return await jobQueueService.enqueueSingleSegment(projectId, segmentId);
      } catch (err) {
        logger.error('ipc:queue', `Error regenerating segment ${segmentId}`, err);
        throw err;
      }
    }
  );
}
