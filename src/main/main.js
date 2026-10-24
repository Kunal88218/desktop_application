const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 560,
    title: 'Productivity Manager',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.env.TEST_SMOKE === 'true') {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Smoke Test] Main window loaded successfully');
      setTimeout(() => {
        app.quit();
      }, 500);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// App lifecycle
app.whenReady().then(() => {
  // IPC Handler for smoke test / system info
  ipcMain.handle('app:get-info', () => {
    return {
      name: 'Desktop Productivity Manager',
      version: '1.0.0',
      platform: process.platform,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron
    };
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
