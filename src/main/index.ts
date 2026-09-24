import path from 'path';
import { app, BrowserWindow, dialog } from 'electron';
import { appPathsService } from './services/app-paths/appPaths.service';
import { logger } from './services/logger/logger';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { createMainWindow } from './window/createMainWindow';
import { setupSecurityPolicies } from './security/security';
import { databaseService } from './database/database.service';
import { appMetadataRepository } from './database/repositories/appMetadata.repository';
import { APP_ID } from '@shared/constants/app.constants';
import { registerAudioProtocolScheme, setupAudioProtocolHandler } from './services/audio/audioProtocol';
import { audioStorageService } from './services/audio/audioStorage.service';

// Register custom audio protocol scheme before app is ready
registerAudioProtocolScheme();

// Allow audio autoplay without explicit user gesture for async preview playback
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Section 25: Error handling traps
process.on('uncaughtException', (error) => {
  logger.error('main', 'Uncaught exception in main process', {
    message: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Unhandled promise rejection in main process', {
    reason: String(reason)
  });
});

let mainWindow: BrowserWindow | null = null;

async function bootstrap(): Promise<void> {
  // Step 1: Electron app ready (invoked inside app.whenReady())
  app.name = 'LocalTTSStudio';
  const userDataPath = path.join(app.getPath('appData'), 'LocalTTSStudio');
  app.setPath('userData', userDataPath);

  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_ID);
  }

  // Step 2: Initialize application paths
  const paths = appPathsService.initialize();

  // Step 3: Initialize logger
  logger.initialize(paths.logs);
  logger.info('app', 'Application starting up');
  logger.info('app', `Initialized local workspace at: ${paths.root}`);

  // Step 4: Run basic environment check
  if (!appPathsService.isWritable()) {
    const errorMsg = 'Local workspace cannot be initialized.\n\nPlease check application folder permissions.';
    logger.error('app', errorMsg);
    dialog.showErrorBox('Initialization Error', errorMsg);
    app.quit();
    return;
  }
  logger.info('app', 'Environment check passed: workspace directories writable');

  // Step 5: Initialize SQLite Database and run migrations (Phase 2)
  try {
    databaseService.initialize();

    // Section 81: Check previous clean shutdown flag
    if (!appMetadataRepository.isCleanShutdown()) {
      logger.warn('app', 'Previous session did not shut down cleanly. Recovery drafts will be inspected.');
    }
    appMetadataRepository.setCleanShutdown(false);
  } catch (dbErr) {
    const errorMsg = 'Local database could not be opened.\n\nYour project files have not been deleted, but the application cannot start safely.';
    logger.error('database', errorMsg, dbErr);
    dialog.showErrorBox('Database Error', errorMsg);
    app.quit();
    return;
  }

  // Configure security policies
  setupSecurityPolicies();

  // Step 6: Register IPC handlers
  registerIpcHandlers();

  // Step 7: Setup custom audio protocol streaming handler
  setupAudioProtocolHandler();

  // Background maintenance: clean expired voice previews
  audioStorageService.cleanPreviewCache().catch((err) => {
    logger.warn('audio:storage', 'Background preview cache cleanup failed', err);
  });

  // Step 8 & 9: Create main window and load React UI
  mainWindow = createMainWindow();

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('window', 'Main window closed');
  });
}

app.whenReady().then(bootstrap).catch((error) => {
  logger.error('app', 'Failed during bootstrap sequence', error);
});

app.on('window-all-closed', () => {
  logger.info('app', 'All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    logger.info('app', 'Activating application: creating new window');
    mainWindow = createMainWindow();
  }
});

app.on('before-quit', () => {
  logger.info('app', 'Application shutting down');
  try {
    appMetadataRepository.setCleanShutdown(true);
    databaseService.close();
  } catch (err) {
    logger.error('app', 'Error during clean database shutdown', err);
  }
});
