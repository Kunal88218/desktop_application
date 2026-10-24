const { contextBridge, ipcRenderer } = require('electron');

// Securely expose an isolated API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  loadTasks: () => ipcRenderer.invoke('tasks:load'),
  saveTasks: (tasks) => ipcRenderer.invoke('tasks:save', tasks),
  getStoragePath: () => ipcRenderer.invoke('tasks:get-path'),
  securityStatus: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
});
