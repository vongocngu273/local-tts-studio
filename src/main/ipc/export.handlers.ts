import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import type { ProjectExportOptions } from '@shared/types/export.types';
import { exportService } from '../services/export/export.service';
import { logger } from '../services/logger/logger';

export function registerExportHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_EXPORT_BUNDLE,
    async (
      _event,
      projectId: string,
      targetDirectory: string,
      options?: Partial<ProjectExportOptions>
    ) => {
      try {
        return await exportService.exportProjectBundle(projectId, targetDirectory, options);
      } catch (err) {
        logger.error('ipc:export', `Error exporting project bundle for ${projectId}`, err);
        throw err;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_EXPORT_DIR, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Destination Folder for Export',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}
