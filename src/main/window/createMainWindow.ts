import { BrowserWindow } from 'electron';
import path from 'path';
import { WINDOW_CONFIG, WINDOW_TITLE } from '@shared/constants/app.constants';
import { attachWebContentsSecurity } from '../security/security';
import { logger } from '../services/logger/logger';

export function createMainWindow(): BrowserWindow {
  logger.info('window', 'Creating main application window');

  const mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    minWidth: WINDOW_CONFIG.MIN_WIDTH,
    minHeight: WINDOW_CONFIG.MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    title: WINDOW_TITLE,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  attachWebContentsSecurity(mainWindow.webContents);

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logger.info('renderer-console', `[L${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logger.error('renderer-load', `Failed to load ${validatedURL}: code=${errorCode}, description=${errorDescription}`);
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    logger.info('window', 'Main window displayed');
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    logger.info('window', `Loading development renderer URL: ${rendererUrl}`);
    mainWindow.loadURL(rendererUrl);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    logger.info('window', `Loading production file: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  return mainWindow;
}
