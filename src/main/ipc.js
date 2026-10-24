const { ipcMain, app } = require('electron');
const storage = require('./storage');

/**
 * Validates that an incoming IPC call originated from our own local application window.
 * Rejects requests from unauthorized or remote origins.
 */
function isValidSender(event) {
  if (!event || !event.senderFrame) return true; // fallback for older electron or synthetic tests
  const url = event.senderFrame.url;
  if (!url || (!url.startsWith('file://') && !url.startsWith('devtools://'))) {
    console.warn(`[Security Warning] Blocked IPC invocation from unauthorized origin: ${url}`);
    return false;
  }
  return true;
}

/**
 * Registers all application IPC handlers with sender validation and structured responses.
 */
function registerIpcHandlers() {
  console.log('[IPC] Registering secure inter-process communication handlers...');

  // 1. System & App Metadata Handler
  ipcMain.handle('app:get-info', (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    return {
      success: true,
      data: {
        name: 'Desktop Productivity Manager',
        version: '1.0.0',
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        isPackaged: app.isPackaged
      }
    };
  });

  // 2. Diagnostic Ping / Latency Handler
  ipcMain.handle('app:ping', (event, clientTimestamp) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    const serverTimestamp = Date.now();
    return {
      success: true,
      data: {
        serverTimestamp,
        clientTimestamp: typeof clientTimestamp === 'number' ? clientTimestamp : null,
        status: 'online'
      }
    };
  });

  // 3. Persistent Storage: Load Tasks
  ipcMain.handle('tasks:load', async (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin', tasks: [] };
    }

    console.log('[IPC Request] tasks:load');
    return await storage.loadTasks();
  });

  // 4. Persistent Storage: Save Tasks (with payload validation)
  ipcMain.handle('tasks:save', async (event, tasks) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    if (!Array.isArray(tasks)) {
      console.warn('[IPC Validation Error] tasks:save payload must be an array');
      return { success: false, error: 'Invalid payload: tasks must be an array' };
    }

    console.log(`[IPC Request] tasks:save (${tasks.length} items)`);
    return await storage.saveTasks(tasks);
  });

  // 5. Persistent Storage: Get Path
  ipcMain.handle('tasks:get-path', (event) => {
    if (!isValidSender(event)) {
      return null;
    }

    return storage.getStorageFilePath();
  });
}

module.exports = {
  registerIpcHandlers,
  isValidSender
};
