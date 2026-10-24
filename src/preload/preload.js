const { contextBridge, ipcRenderer } = require('electron');

// Securely expose a strictly restricted API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: async () => {
    const res = await ipcRenderer.invoke('app:get-info');
    return res && res.data ? res.data : res;
  },
  ping: (timestamp) => ipcRenderer.invoke('app:ping', timestamp),
  loadTasks: () => ipcRenderer.invoke('tasks:load'),
  saveTasks: (tasks) => ipcRenderer.invoke('tasks:save', tasks),
  getStoragePath: () => ipcRenderer.invoke('tasks:get-path'),
  securityStatus: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
});
