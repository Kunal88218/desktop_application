// Renderer process script
// Securely communicates via window.electronAPI exposed through preload contextBridge

document.addEventListener('DOMContentLoaded', async () => {
  const appNameEl = document.getElementById('app-name');
  const appVersionEl = document.getElementById('app-version');
  const platformNameEl = document.getElementById('platform-name');
  const electronVersionEl = document.getElementById('electron-version');
  const nodeVersionEl = document.getElementById('node-version');
  const statusEl = document.getElementById('connection-status');
  const badgeIsolation = document.getElementById('badge-isolation');
  const badgeNode = document.getElementById('badge-node');
  const badgeSandbox = document.getElementById('badge-sandbox');

  try {
    if (window.electronAPI && typeof window.electronAPI.getAppInfo === 'function') {
      const info = await window.electronAPI.getAppInfo();
      appNameEl.textContent = info.name;
      appVersionEl.textContent = `v${info.version}`;
      platformNameEl.textContent = `${info.platform} (${info.arch || 'unknown'})`;
      electronVersionEl.textContent = `v${info.electronVersion}`;
      nodeVersionEl.textContent = `v${info.nodeVersion}`;
      statusEl.textContent = 'Process Bridge Connected';

      if (window.electronAPI.securityStatus) {
        badgeIsolation.textContent = window.electronAPI.securityStatus.contextIsolation ? 'Enabled' : 'Disabled';
        badgeNode.textContent = window.electronAPI.securityStatus.nodeIntegration ? 'Enabled' : 'Disabled';
        badgeSandbox.textContent = window.electronAPI.securityStatus.sandbox ? 'Enabled' : 'Disabled';
      }
    } else {
      statusEl.textContent = 'Standalone Mode (API unavailable)';
    }
  } catch (err) {
    console.error('Failed to load application info from preload bridge:', err);
    statusEl.textContent = 'Bridge Error';
  }
});
