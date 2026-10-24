const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Global error handlers for main process
process.on('uncaughtException', (error) => {
  console.error('[Main Process Error] Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main Process Error] Unhandled Rejection:', reason);
});

let mainWindow = null;

function createMainWindow() {
  const preloadPath = path.resolve(__dirname, '../preload/preload.js');
  console.log(`[Main Process] Creating primary window with preload: ${preloadPath}`);

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    title: 'Productivity Manager',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.resolve(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    console.log('[Main Process] Primary window ready to show');
    mainWindow.show();
  });

  // Navigation security: deny external window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[Security Warning] Denied window open request for: ${url}`);
    return { action: 'deny' };
  });

  // Navigation security: prevent navigating away from application bundle
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!navigationUrl.startsWith('file://')) {
      console.warn(`[Security Warning] Prevented external navigation to: ${navigationUrl}`);
      event.preventDefault();
    }
  });

  // Load failure and crash logging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Load Error] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('console-message', (event) => {
    if (event.level >= 3) {
      console.error(`[Renderer Error] ${event.message}`);
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error(`[Renderer Process Gone] Reason: ${details.reason}, Exit Code: ${details.exitCode}`);
  });

  if (process.env.TEST_SMOKE === 'true') {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Smoke Test] Main window loaded successfully');
      setTimeout(() => {
        app.quit();
      }, 500);
    });
  }

  mainWindow.on('closed', () => {
    console.log('[Main Process] Primary window closed');
    mainWindow = null;
  });

  return mainWindow;
}

// Electron Application Lifecycle
app.whenReady().then(() => {
  console.log('[Main Process] Electron application ready');
  console.log(`[Main Process] Platform: ${process.platform} (${process.arch}) | Node: ${process.versions.node} | Electron: ${process.versions.electron}`);

  // IPC Handler for smoke test / system info
  ipcMain.handle('app:get-info', () => {
    return {
      name: 'Desktop Productivity Manager',
      version: '1.0.0',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      isPackaged: app.isPackaged
    };
  });

  createMainWindow();

  app.on('activate', () => {
    // macOS: Recreate window when dock icon clicked and no windows exist
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Main Process] App activated with 0 open windows; recreating primary window');
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('[Main Process] All application windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
