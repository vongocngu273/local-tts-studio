import { app, session, shell, WebContents } from 'electron';
import { logger } from '../services/logger/logger';

export function setupSecurityPolicies(): void {
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL) || !app.isPackaged;

  // Set Content Security Policy for all sessions
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' 'unsafe-inline' http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; style-src 'self' 'unsafe-inline' http://localhost:*; font-src 'self' data: http://localhost:*; img-src 'self' data: http://localhost:*; media-src 'self' localtts-audio: data: blob:; connect-src 'self' http://localhost:* ws://localhost:*;"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; media-src 'self' localtts-audio: data: blob:; connect-src 'self'";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  // Deny permission requests by default
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    logger.warn('security', `Blocked permission request: ${permission}`);
    callback(false);
  });
}

export function attachWebContentsSecurity(webContents: WebContents): void {
  // Block window.open / new window creation and open external links in default OS browser
  webContents.setWindowOpenHandler(({ url }) => {
    logger.info('security', `External link open requested: ${url}`);
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent navigation away from local bundle
  webContents.on('will-navigate', (event, navigationUrl) => {
    const isDevServer = process.env.ELECTRON_RENDERER_URL && navigationUrl.startsWith(process.env.ELECTRON_RENDERER_URL);
    const isFileUrl = navigationUrl.startsWith('file:');

    if (!isDevServer && !isFileUrl) {
      event.preventDefault();
      logger.warn('security', `Blocked unexpected navigation to: ${navigationUrl}`);
    }
  });
}
