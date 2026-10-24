// Renderer process script
// Uses strictly window.electronAPI exposed safely via preload contextBridge

document.addEventListener('DOMContentLoaded', async () => {
  const appNameEl = document.getElementById('app-name');
  const appVersionEl = document.getElementById('app-version');
  const platformNameEl = document.getElementById('platform-name');
  const electronVersionEl = document.getElementById('electron-version');
  const nodeVersionEl = document.getElementById('node-version');
  const statusEl = document.getElementById('connection-status');

  try {
    if (window.electronAPI && typeof window.electronAPI.getAppInfo === 'function') {
      const info = await window.electronAPI.getAppInfo();
      appNameEl.textContent = info.name;
      appVersionEl.textContent = `v${info.version}`;
      platformNameEl.textContent = info.platform;
      electronVersionEl.textContent = `v${info.electronVersion}`;
      nodeVersionEl.textContent = `v${info.nodeVersion}`;
      statusEl.textContent = 'Process Bridge Connected';
    } else {
      statusEl.textContent = 'Standalone Mode (API unavailable)';
    }
  } catch (err) {
    console.error('Failed to load application info from preload bridge:', err);
    statusEl.textContent = 'Bridge Error';
  }
});
