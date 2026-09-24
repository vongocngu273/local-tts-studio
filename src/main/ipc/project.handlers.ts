import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import {
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
  RenameProjectInputSchema,
  SaveProjectTextSchema,
  SaveProjectDraftSchema,
  ProjectListOptionsSchema
} from '@shared/schemas/project.schema';
import { projectService } from '../services/project/project.service';
import { logger } from '../services/logger/logger';

const UuidSchema = z.string().uuid();

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, rawInput?: unknown) => {
    try {
      const input = rawInput ? CreateProjectInputSchema.parse(rawInput) : undefined;
      return projectService.createProject(input);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_CREATE', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.getProject(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_GET', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async (_event, rawOptions?: unknown) => {
    try {
      const options = rawOptions ? ProjectListOptionsSchema.parse(rawOptions) : undefined;
      return projectService.listProjects(options);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_LIST', error);
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE,
    async (_event, { id: rawId, changes: rawChanges }: { id: unknown; changes: unknown }) => {
      try {
        const id = UuidSchema.parse(rawId);
        const changes = UpdateProjectInputSchema.parse(rawChanges);
        return projectService.updateProject(id, changes);
      } catch (error) {
        logger.error('ipc:project', 'Error in PROJECT_UPDATE', error);
        throw error;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.PROJECT_RENAME, async (_event, rawInput: unknown) => {
    try {
      const input = RenameProjectInputSchema.parse(rawInput);
      return projectService.renameProject(input.projectId, input.name);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_RENAME', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DUPLICATE, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.duplicateProject(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_DUPLICATE', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.deleteProject(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_DELETE', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_RESTORE, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.restoreProject(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_RESTORE', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_SAVE_TEXT, async (_event, rawInput: unknown) => {
    try {
      const input = SaveProjectTextSchema.parse(rawInput);
      return projectService.saveProjectText(input);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_SAVE_TEXT', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_SAVE_DRAFT, async (_event, rawInput: unknown) => {
    try {
      const input = SaveProjectDraftSchema.parse(rawInput);
      return projectService.saveDraft(input);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_SAVE_DRAFT', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN_FOLDER, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return await projectService.openProjectFolder(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_OPEN_FOLDER', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_CHECK_RECOVERY, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.checkRecovery(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_CHECK_RECOVERY', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_RECOVER_DRAFT, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.recoverDraft(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_RECOVER_DRAFT', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DISCARD_DRAFT, async (_event, rawId: unknown) => {
    try {
      const id = UuidSchema.parse(rawId);
      return projectService.discardDraft(id);
    } catch (error) {
      logger.error('ipc:project', 'Error in PROJECT_DISCARD_DRAFT', error);
      throw error;
    }
  });
}
