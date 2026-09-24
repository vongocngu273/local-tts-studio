export const APP_NAME = 'Local TTS Studio';
export const APP_ID = 'com.localtts.studio';
export const WINDOW_TITLE = 'Local TTS Studio';
export const APP_VERSION = '1.0.0';
export const APP_AUTHOR = 'Ngự Võ';
export const APP_YEAR = '2026';
export const APP_COPYRIGHT = 'Copyright © 2026 Ngự Võ. All rights reserved.';

export const WINDOW_CONFIG = {
  DEFAULT_WIDTH: 1440,
  DEFAULT_HEIGHT: 900,
  MIN_WIDTH: 1100,
  MIN_HEIGHT: 700
} as const;

export const LOCAL_WORKSPACE_DIR_NAMES = [
  'database',
  'projects',
  'cache',
  'logs',
  'backups',
  'temp'
] as const;

export type LocalWorkspaceDirName = (typeof LOCAL_WORKSPACE_DIR_NAMES)[number];
