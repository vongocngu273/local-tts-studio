import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { pronunciationDictionaryService } from '../services/dictionary/pronunciationDictionary.service';
import {
  CreatePronunciationRuleSchema,
  UpdatePronunciationRuleSchema,
  DictionaryListOptionsSchema,
  DictionaryImportSchema,
  DictionaryExportSchema
} from '@shared/schemas/dictionary.schema';
import { z } from 'zod';
import { logger } from '../services/logger/logger';

export function registerDictionaryHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DICTIONARY_CREATE, async (_event, rawInput) => {
    try {
      const input = CreatePronunciationRuleSchema.parse(rawInput);
      return pronunciationDictionaryService.createRule(input);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error creating pronunciation rule', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_GET, async (_event, rawId) => {
    try {
      const id = z.string().uuid().parse(rawId);
      return pronunciationDictionaryService.getRule(id);
    } catch (error) {
      logger.error('ipc:dictionary', `Error getting rule ${rawId}`, error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_LIST, async (_event, rawOptions) => {
    try {
      const options = rawOptions ? DictionaryListOptionsSchema.parse(rawOptions) : undefined;
      return pronunciationDictionaryService.listRules(options);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error listing pronunciation rules', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_UPDATE, async (_event, { id: rawId, changes: rawChanges }) => {
    try {
      const id = z.string().uuid().parse(rawId);
      const changes = UpdatePronunciationRuleSchema.parse(rawChanges);
      return pronunciationDictionaryService.updateRule(id, changes);
    } catch (error) {
      logger.error('ipc:dictionary', `Error updating rule ${rawId}`, error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_DELETE, async (_event, rawId) => {
    try {
      const id = z.string().uuid().parse(rawId);
      return pronunciationDictionaryService.deleteRule(id);
    } catch (error) {
      logger.error('ipc:dictionary', `Error deleting rule ${rawId}`, error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_DELETE_MANY, async (_event, rawIds) => {
    try {
      const ids = z.array(z.string().uuid()).parse(rawIds);
      return pronunciationDictionaryService.deleteManyRules(ids);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error deleting multiple rules', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_SET_ENABLED, async (_event, { id: rawId, enabled: rawEnabled }) => {
    try {
      const id = z.string().uuid().parse(rawId);
      const enabled = z.boolean().parse(rawEnabled);
      return pronunciationDictionaryService.setEnabled(id, enabled);
    } catch (error) {
      logger.error('ipc:dictionary', `Error toggling enabled for rule ${rawId}`, error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_SET_ENABLED_MANY, async (_event, { ids: rawIds, enabled: rawEnabled }) => {
    try {
      const ids = z.array(z.string().uuid()).parse(rawIds);
      const enabled = z.boolean().parse(rawEnabled);
      return pronunciationDictionaryService.setEnabledMany(ids, enabled);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error toggling enabled for multiple rules', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_GET_CATEGORIES, async () => {
    try {
      return pronunciationDictionaryService.getCategories();
    } catch (error) {
      logger.error('ipc:dictionary', 'Error getting categories', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_GET_REVISION, async () => {
    try {
      return pronunciationDictionaryService.getRevision();
    } catch (error) {
      logger.error('ipc:dictionary', 'Error getting dictionary revision', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_TEST_RULE, async (_event, rawInput) => {
    try {
      const TestSchema = z.object({
        rule: CreatePronunciationRuleSchema,
        sampleText: z.string()
      });
      const { rule, sampleText } = TestSchema.parse(rawInput);
      return pronunciationDictionaryService.testRule({ rule, sampleText });
    } catch (error) {
      logger.error('ipc:dictionary', 'Error testing pronunciation rule', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_SELECT_IMPORT_FILE, async () => {
    try {
      return await pronunciationDictionaryService.selectImportFile();
    } catch (error) {
      logger.error('ipc:dictionary', 'Error opening import file picker', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_IMPORT_PREVIEW, async (_event, rawInput) => {
    try {
      const input = DictionaryImportSchema.parse(rawInput);
      return pronunciationDictionaryService.previewImport(input);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error previewing dictionary import', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_IMPORT_EXECUTE, async (_event, rawInput) => {
    try {
      const input = DictionaryImportSchema.parse(rawInput);
      return pronunciationDictionaryService.executeImport(input);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error executing dictionary import', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DICTIONARY_EXPORT_FILE, async (_event, rawInput) => {
    try {
      const input = DictionaryExportSchema.parse(rawInput);
      return await pronunciationDictionaryService.exportToFile(input);
    } catch (error) {
      logger.error('ipc:dictionary', 'Error exporting dictionary file', error);
      throw error;
    }
  });
}
