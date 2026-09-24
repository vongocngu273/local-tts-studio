import { registerAppHandlers } from './app.handlers';
import { registerSystemHandlers } from './system.handlers';
import { registerProjectHandlers } from './project.handlers';
import { registerDictionaryHandlers } from './dictionary.handlers';
import { registerTextProcessingHandlers } from './textProcessing.handlers';
import { registerProviderHandlers } from './provider.handlers';
import { registerGenerationHandlers } from './generation.handlers';
import { registerSegmentHandlers } from './segment.handlers';
import { registerQueueHandlers } from './queue.handlers';
import { registerCompositionHandlers } from './composition.handlers';
import { registerSubtitleHandlers } from './subtitle.handlers';
import { registerExportHandlers } from './export.handlers';
import { registerFFmpegHandlers } from './ffmpeg.handlers';
import { logger } from '../services/logger/logger';

export function registerIpcHandlers(): void {
  logger.info('ipc', 'Registering IPC handlers');
  registerAppHandlers();
  registerSystemHandlers();
  registerProjectHandlers();
  registerDictionaryHandlers();
  registerTextProcessingHandlers();
  registerProviderHandlers();
  registerGenerationHandlers();
  registerSegmentHandlers();
  registerQueueHandlers();
  registerCompositionHandlers();
  registerSubtitleHandlers();
  registerExportHandlers();
  registerFFmpegHandlers();
  logger.info('ipc', 'IPC handlers registered successfully');
}
