import { ipcMain, app, shell } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { APP_NAME, APP_ID } from '@shared/constants/app.constants';
import { AppInfoSchema, AppPathsSchema } from '@shared/schemas/app.schema';
import { appPathsService } from '../services/app-paths/appPaths.service';
import { logger } from '../services/logger/logger';

export function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async () => {
    try {
      const appInfo = {
        name: APP_NAME,
        version: app.getVersion(),
        appId: APP_ID
      };
      return AppInfoSchema.parse(appInfo);
    } catch (error) {
      logger.error('ipc:app', 'Failed to get app info', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_PATHS, async () => {
    try {
      const paths = appPathsService.getPaths();
      return AppPathsSchema.parse(paths);
    } catch (error) {
      logger.error('ipc:app', 'Failed to get app paths', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_WORKSPACE, async () => {
    try {
      const paths = appPathsService.getPaths();
      const result = await shell.openPath(paths.root);
      if (result) {
        logger.warn('ipc:app', `Failed to open workspace directory: ${result}`);
        return false;
      }
      logger.info('ipc:app', `Opened workspace directory: ${paths.root}`);
      return true;
    } catch (error) {
      logger.error('ipc:app', 'Error opening workspace directory', error);
      return false;
    }
  });
}
