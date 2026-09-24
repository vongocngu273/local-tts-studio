import { ipcMain, shell } from 'electron';
import fs from 'fs';
import { IPC_CHANNELS } from '@shared/constants/ipc.constants';
import { ttsGenerationService } from '../services/tts/ttsGeneration.service';
import {
  VoicePreviewRequestSchema,
  ProjectAudioGenerateRequestSchema
} from '@shared/schemas/provider.schema';
import { z } from 'zod';
import { logger } from '../services/logger/logger';

export function registerGenerationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TTS_PREVIEW_VOICE, async (_event, rawInput) => {
    try {
      const input = VoicePreviewRequestSchema.parse(rawInput);
      return await ttsGenerationService.previewVoice(input);
    } catch (err) {
      logger.error('ipc:generation', 'Error generating voice preview', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.TTS_GENERATE_PROJECT_AUDIO, async (_event, rawInput) => {
    try {
      const input = ProjectAudioGenerateRequestSchema.parse(rawInput);
      return await ttsGenerationService.generateProjectAudio(input);
    } catch (err) {
      logger.error('ipc:generation', 'Error generating project audio', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.TTS_GET_GENERATION, async (_event, rawId) => {
    try {
      const id = z.string().uuid().parse(rawId);
      return ttsGenerationService.getGeneration(id);
    } catch (err) {
      logger.error('ipc:generation', 'Error getting generation record', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.TTS_LIST_GENERATIONS, async (_event, rawProjectId) => {
    try {
      const projectId = rawProjectId ? z.string().uuid().parse(rawProjectId) : undefined;
      return ttsGenerationService.listGenerations(projectId);
    } catch (err) {
      logger.error('ipc:generation', 'Error listing generations', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.TTS_DELETE_GENERATION, async (_event, rawId) => {
    try {
      const id = z.string().uuid().parse(rawId);
      const generation = ttsGenerationService.getGeneration(id);
      if (generation?.outputPath && fs.existsSync(generation.outputPath)) {
        try {
          fs.unlinkSync(generation.outputPath);
          if (generation.timingPath && fs.existsSync(generation.timingPath)) {
            fs.unlinkSync(generation.timingPath);
          }
          if (generation.providerSubtitlePath && fs.existsSync(generation.providerSubtitlePath)) {
            fs.unlinkSync(generation.providerSubtitlePath);
          }
        } catch {
          // ignore unlink error
        }
      }
      return ttsGenerationService.deleteGeneration(id);
    } catch (err) {
      logger.error('ipc:generation', 'Error deleting generation', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.TTS_OPEN_AUDIO_FOLDER, async (_event, rawId) => {
    try {
      const id = z.string().uuid().parse(rawId);
      const gen = ttsGenerationService.getGeneration(id);
      if (gen?.outputPath && fs.existsSync(gen.outputPath)) {
        shell.showItemInFolder(gen.outputPath);
        return true;
      }
      return false;
    } catch (err) {
      logger.error('ipc:generation', 'Error opening audio folder', err);
      return false;
    }
  });
}
