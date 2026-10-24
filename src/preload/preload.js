const { contextBridge, ipcRenderer } = require('electron');

// Securely expose an explicit, strictly scoped API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: async () => {
    const res = await ipcRenderer.invoke('app:get-info');
    return res && res.data ? res.data : res;
  },
  ping: (timestamp) => ipcRenderer.invoke('app:ping', timestamp),
  loadTasks: () => ipcRenderer.invoke('tasks:load'),
  saveTasks: (tasks) => ipcRenderer.invoke('tasks:save', tasks),
  getStoragePath: () => ipcRenderer.invoke('tasks:get-path'),

  // Native Dialogs: Export & Import
  exportTasks: () => ipcRenderer.invoke('tasks:export-dialog'),
  importTasks: () => ipcRenderer.invoke('tasks:import-dialog'),

  // Multi-window: Quick Add Window
  openQuickAdd: () => ipcRenderer.invoke('window:open-quick-add'),
  quickAddTask: (taskData) => ipcRenderer.invoke('tasks:quick-add', taskData),
  closeCurrentWindow: () => ipcRenderer.invoke('window:close-current'),

  // System Notifications
  sendNotification: (title, body) => ipcRenderer.invoke('notifications:send', { title, body }),

  // Multi-window State Synchronization Event
  onTasksSync: (callback) => {
    if (typeof callback === 'function') {
      const subscription = (event, tasks) => callback(tasks);
      ipcRenderer.on('tasks:sync', subscription);
      return () => ipcRenderer.removeListener('tasks:sync', subscription);
    }
  },

  securityStatus: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
});
