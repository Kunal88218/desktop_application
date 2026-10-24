const { Menu, app, dialog } = require('electron');

/**
 * Builds and sets the native desktop application menu.
 */
function setupApplicationMenu({ onQuickAdd, onExport, onImport }) {
  const isMac = process.platform === 'darwin';

  const template = [
    // macOS Application Menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),

    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Quick Add Task...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (typeof onQuickAdd === 'function') onQuickAdd();
          }
        },
        { type: 'separator' },
        {
          label: 'Export Tasks...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (typeof onExport === 'function') onExport();
          }
        },
        {
          label: 'Import Tasks...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            if (typeof onImport === 'function') onImport();
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Window Menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [{ role: 'close' }])
      ]
    },

    // Help Menu
    {
      role: 'help',
      submenu: [
        {
          label: 'About Productivity Manager',
          click: async () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Desktop Productivity Manager',
              message: 'Desktop Productivity Manager',
              detail: `Version: 1.0.0\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChromium: ${process.versions.chrome}\nPlatform: ${process.platform} (${process.arch})\n\nBuilt with secure multi-process architecture and local persistence.`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = {
  setupApplicationMenu
};
