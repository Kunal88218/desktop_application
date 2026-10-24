const { ipcMain, app, BrowserWindow } = require('electron');
const storage = require('./storage');
const { exportTasksDialog, importTasksDialog } = require('./dialogs');
const { sendNotification } = require('./notifications');

/**
 * Validates that an incoming IPC call originated from our own local application window.
 * Rejects requests from unauthorized or remote origins.
 */
function isValidSender(event) {
  if (!event || !event.senderFrame) return true;
  const url = event.senderFrame.url;
  if (!url || (!url.startsWith('file://') && !url.startsWith('devtools://'))) {
    console.warn(`[Security Warning] Blocked IPC invocation from unauthorized origin: ${url}`);
    return false;
  }
  return true;
}

/**
 * Broadcasts a task synchronization event to all active application windows.
 */
function broadcastTasksSync(tasks) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('tasks:sync', tasks);
    }
  });
}

/**
 * Registers all application IPC handlers with sender validation and structured responses.
 */
function registerIpcHandlers({ getMainWindow, openQuickAddWindow, closeQuickAddWindow }) {
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
    const result = await storage.saveTasks(tasks);
    if (result.success) {
      // Broadcast to other windows if needed
      broadcastTasksSync(tasks);
    }
    return result;
  });

  // 5. Persistent Storage: Get Path
  ipcMain.handle('tasks:get-path', (event) => {
    if (!isValidSender(event)) {
      return null;
    }

    return storage.getStorageFilePath();
  });

  // 6. Native Dialogs: Export Tasks
  ipcMain.handle('tasks:export-dialog', async (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    const callingWindow = BrowserWindow.fromWebContents(event.sender);
    return await exportTasksDialog(callingWindow);
  });

  // 7. Native Dialogs: Import Tasks
  ipcMain.handle('tasks:import-dialog', async (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    const callingWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await importTasksDialog(callingWindow);
    if (result && result.success && Array.isArray(result.tasks)) {
      broadcastTasksSync(result.tasks);
    }
    return result;
  });

  // 8. Secondary Window: Open Quick Add Window
  ipcMain.handle('window:open-quick-add', (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    if (typeof openQuickAddWindow === 'function') {
      openQuickAddWindow();
      return { success: true };
    }
    return { success: false, error: 'Window opener not configured' };
  });

  // 9. Secondary Window: Submit Quick Add Task
  ipcMain.handle('tasks:quick-add', async (event, taskData) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    if (!taskData || typeof taskData.title !== 'string' || !taskData.title.trim()) {
      return { success: false, error: 'Task title is required' };
    }

    try {
      const current = await storage.loadTasks();
      const existing = current.tasks || [];

      const newTask = {
        id: `task-${Date.now()}`,
        title: taskData.title.trim(),
        description: typeof taskData.description === 'string' ? taskData.description.trim() : '',
        priority: ['low', 'medium', 'high'].includes(taskData.priority) ? taskData.priority : 'medium',
        dueDate: typeof taskData.dueDate === 'string' ? taskData.dueDate.trim() : '',
        completed: false,
        createdAt: Date.now()
      };

      const updated = [newTask, ...existing];
      const saveRes = await storage.saveTasks(updated);

      if (!saveRes.success) {
        return { success: false, error: saveRes.error };
      }

      // Send desktop notification
      sendNotification({
        title: 'Task Created',
        body: `"${newTask.title}" added to your productivity list.`
      });

      // Broadcast new tasks to main window
      broadcastTasksSync(updated);

      // Close the quick-add window
      if (typeof closeQuickAddWindow === 'function') {
        closeQuickAddWindow();
      }

      return { success: true, task: newTask };
    } catch (err) {
      console.error('[IPC Error] quick-add failed:', err);
      return { success: false, error: err.message };
    }
  });

  // 10. Close Calling Window
  ipcMain.handle('window:close-current', (event) => {
    if (!isValidSender(event)) return;
    const callingWindow = BrowserWindow.fromWebContents(event.sender);
    if (callingWindow && !callingWindow.isDestroyed()) {
      callingWindow.close();
    }
  });

  // 11. System Notifications
  ipcMain.handle('notifications:send', (event, { title, body }) => {
    if (!isValidSender(event)) {
      return false;
    }

    return sendNotification({ title, body });
  });
}

module.exports = {
  registerIpcHandlers,
  isValidSender,
  broadcastTasksSync
};
