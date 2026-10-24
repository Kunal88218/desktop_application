const { contextBridge, ipcRenderer } = require('electron');

// Securely expose an isolated API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info')
});
