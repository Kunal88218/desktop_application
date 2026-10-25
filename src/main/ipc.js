const { ipcMain, app, BrowserWindow } = require('electron');
const storage = require('./storage');
const { exportTasksDialog, importTasksDialog } = require('./dialogs');
const { sendNotification } = require('./notifications');

/**
 * Validates that an incoming IPC call originated from our own local application window.
 * Rejects requests from unauthorized or remote origins, or missing sender frames.
 */
function isValidSender(event) {
  if (!event || !event.senderFrame || typeof event.senderFrame.url !== 'string') {
    console.warn('[Security Warning] Blocked IPC invocation: missing senderFrame or frame URL');
    return false;
  }
  const url = event.senderFrame.url.trim();
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
function registerIpcHandlers({ getMainWindow, openQuickAddWindow, closeQuickAddWindow }, customIpcMain = ipcMain) {
  const targetIpc = customIpcMain || ipcMain;
  console.log('[IPC] Registering secure inter-process communication handlers...');

  // 1. System & App Metadata Handler
  targetIpc.handle('app:get-info', (event) => {
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
  targetIpc.handle('app:ping', (event, clientTimestamp) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    const serverTimestamp = Date.now();
    return {
      success: true,
      data: {
        serverTimestamp,
        clientTimestamp: typeof clientTimestamp === 'number' && Number.isFinite(clientTimestamp) ? clientTimestamp : null,
        status: 'online'
      }
    };
  });

  // 3. Persistent Storage: Load Tasks
  targetIpc.handle('tasks:load', async (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin', tasks: [] };
    }

    console.log('[IPC Request] tasks:load');
    return await storage.loadTasks();
  });

  // 4. Persistent Storage: Save Tasks (with payload validation)
  targetIpc.handle('tasks:save', async (event, tasks) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    if (!Array.isArray(tasks)) {
      console.warn('[IPC Validation Error] tasks:save payload must be an array');
      return { success: false, error: 'Invalid payload: tasks must be an array' };
    }

    console.log(`[IPC Request] tasks:save (${tasks.length} items)`);
    const result = await storage.saveTasks(tasks);
    if (result && result.success) {
      // Broadcast to other windows if needed
      broadcastTasksSync(tasks);
    }
    return result;
  });

  // 5. Persistent Storage: Get Path
  targetIpc.handle('tasks:get-path', (event) => {
    if (!isValidSender(event)) {
      return null;
    }

    return storage.getStorageFilePath();
  });

  // 6. Native Dialogs: Export Tasks
  targetIpc.handle('tasks:export-dialog', async (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    const callingWindow = BrowserWindow.fromWebContents ? BrowserWindow.fromWebContents(event.sender) : null;
    return await exportTasksDialog(callingWindow);
  });

  // 7. Native Dialogs: Import Tasks
  targetIpc.handle('tasks:import-dialog', async (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    const callingWindow = BrowserWindow.fromWebContents ? BrowserWindow.fromWebContents(event.sender) : null;
    const result = await importTasksDialog(callingWindow);
    if (result && result.success && Array.isArray(result.tasks)) {
      broadcastTasksSync(result.tasks);
    }
    return result;
  });

  // 8. Secondary Window: Open Quick Add Window
  targetIpc.handle('window:open-quick-add', (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    if (typeof openQuickAddWindow === 'function') {
      try {
        openQuickAddWindow();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Window opener not configured' };
  });

  // 9. Secondary Window: Submit Quick Add Task
  targetIpc.handle('tasks:quick-add', async (event, taskData) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }

    if (!taskData || typeof taskData !== 'object' || Array.isArray(taskData)) {
      return { success: false, error: 'Task payload must be an object' };
    }

    if (typeof taskData.title !== 'string' || !taskData.title.trim()) {
      return { success: false, error: 'Task title is required' };
    }

    try {
      const current = await storage.loadTasks();
      const existing = current.tasks || [];

      const validPriorities = ['low', 'medium', 'high'];
      const rawPriority = typeof taskData.priority === 'string' ? taskData.priority.toLowerCase().trim() : 'medium';
      const priority = validPriorities.includes(rawPriority) ? rawPriority : 'medium';

      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: taskData.title.trim().substring(0, 300),
        description: typeof taskData.description === 'string' ? taskData.description.trim().substring(0, 2000) : '',
        priority,
        dueDate: typeof taskData.dueDate === 'string' ? taskData.dueDate.trim().substring(0, 50) : '',
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
  targetIpc.handle('window:close-current', (event) => {
    if (!isValidSender(event)) {
      return { success: false, error: 'Unauthorized IPC origin' };
    }
    const callingWindow = BrowserWindow.fromWebContents ? BrowserWindow.fromWebContents(event.sender) : null;
    if (callingWindow && !callingWindow.isDestroyed()) {
      callingWindow.close();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // 11. System Notifications
  targetIpc.handle('notifications:send', (event, payload) => {
    if (!isValidSender(event)) {
      return false;
    }

    const title = payload && typeof payload.title === 'string' ? payload.title.trim().substring(0, 100) : 'Productivity Manager';
    const body = payload && typeof payload.body === 'string' ? payload.body.trim().substring(0, 500) : '';

    return sendNotification({ title, body });
  });
}

module.exports = {
  registerIpcHandlers,
  isValidSender,
  broadcastTasksSync
};
