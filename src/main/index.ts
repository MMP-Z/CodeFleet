import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import {
  APP_NAME,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from '@shared/constants';
import { DatabaseService } from './db/database';
import { registerPhase1IpcHandlers } from './ipc/handlers';
import { createLogger } from './logger/logger';
import {
  buildContentSecurityPolicy,
  buildSecureWebPreferences,
  isNavigationAllowed,
} from './security/window-security';

let dbService: DatabaseService | null = null;

function createMainWindow(): BrowserWindow {
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL']);
  const preloadPath = join(__dirname, '../preload/index.cjs');

  const mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: APP_NAME,
    backgroundColor: '#F4F5F2',
    show: false,
    autoHideMenuBar: true,
    webPreferences: buildSecureWebPreferences(preloadPath),
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Luật B1: chặn mở cửa sổ mới từ renderer
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Luật B1: chặn điều hướng ra ngoài origin hợp lệ
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isNavigationAllowed(targetUrl, process.env['ELECTRON_RENDERER_URL'])) {
      event.preventDefault();
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  app.setName(APP_NAME);
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL']);
  const userDataDir = app.getPath('userData');

  const logger = createLogger({
    logDir: join(userDataDir, 'logs'),
    scope: 'main',
    mirrorToConsole: isDev,
  });

  dbService = new DatabaseService({
    userDataDir,
    logger: logger.child('db'),
  });
  dbService.openAndMigrate();

  registerPhase1IpcHandlers(ipcMain, {
    userDataDir,
    dbService,
    logger,
    openFolderInOs: (folderPath) => shell.openPath(folderPath),
  });

  const cspHeader = buildContentSecurityPolicy(isDev);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader],
      },
    });
  });

  logger.info('CodeFleet main process initialized', { userDataDir });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  dbService?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
