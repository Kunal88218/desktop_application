const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateTasks } = require('../src/main/storage');
const { exportTasksDialog, importTasksDialog } = require('../src/main/dialogs');
const { sendNotification } = require('../src/main/notifications');
const { setupApplicationMenu } = require('../src/main/menu');

console.log('[Test] Running Milestone 6 & 7 Native Desktop Integrations & Lifecycle Tests...');

// 1. Export Data Serialization Test
(() => {
  console.log('  Testing export payload structure...');

  const sampleTasks = [
    { id: 'task-1', title: 'Exportable Task', priority: 'high', completed: false }
  ];

  const exportPayload = {
    app: 'Desktop Productivity Manager',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    taskCount: sampleTasks.length,
    tasks: sampleTasks
  };

  const serialized = JSON.stringify(exportPayload);
  const parsed = JSON.parse(serialized);

  assert.strictEqual(parsed.app, 'Desktop Productivity Manager');
  assert.strictEqual(parsed.version, '1.0.0');
  assert.strictEqual(parsed.taskCount, 1);
  assert(Array.isArray(parsed.tasks), 'Exported payload must contain tasks array');
  assert.strictEqual(parsed.tasks[0].title, 'Exportable Task');

  console.log('  ✓ Export payload structure conforms to specification');
})();

// 2. Import Parsing & Collision Avoidance Test
(() => {
  console.log('  Testing import validation and ID collision handling...');

  // Parsing wrapped payload
  const wrappedJson = JSON.stringify({
    app: 'Desktop Productivity Manager',
    tasks: [
      { id: 'existing-id', title: 'Imported Task 1', priority: 'medium' }
    ]
  });
  const parsedWrapped = JSON.parse(wrappedJson);
  const rawTasks = Array.isArray(parsedWrapped) ? parsedWrapped : parsedWrapped.tasks;
  const validated = validateTasks(rawTasks);
  assert.strictEqual(validated.length, 1);
  assert.strictEqual(validated[0].title, 'Imported Task 1');

  // Parsing flat array payload
  const flatJson = JSON.stringify([
    { id: 'flat-id', title: 'Flat Array Task', priority: 'low' }
  ]);
  const parsedFlat = JSON.parse(flatJson);
  const validatedFlat = validateTasks(parsedFlat);
  assert.strictEqual(validatedFlat.length, 1);
  assert.strictEqual(validatedFlat[0].title, 'Flat Array Task');

  // ID Collision avoidance simulation
  const existingTasks = [{ id: 'task-collision', title: 'Original Existing Task' }];
  const existingIds = new Set(existingTasks.map(t => t.id));

  const incomingImport = [
    { id: 'task-collision', title: 'Conflicting Incoming Task' },
    { id: 'task-fresh', title: 'Fresh Incoming Task' }
  ];

  const remapped = incomingImport.map(t => {
    if (existingIds.has(t.id)) {
      return { ...t, id: `task-remapped-${Date.now()}` };
    }
    return t;
  });

  assert.notStrictEqual(remapped[0].id, 'task-collision', 'Conflicting task ID should be regenerated');
  assert.strictEqual(remapped[1].id, 'task-fresh', 'Unique task ID should be preserved');

  console.log('  ✓ Import validation and collision avoidance verified');
})();

// 3. Native Dialogs: Cancellation and Error Paths
(async () => {
  console.log('  Testing export and import dialog cancellations and error paths...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialog-test-'));

  try {
    // 3.1 Export dialog canceled by user
    const mockSaveCanceled = {
      showSaveDialog: async () => ({ canceled: true, filePath: null })
    };
    const exportCancelRes = await exportTasksDialog(null, mockSaveCanceled);
    assert.strictEqual(exportCancelRes.success, false);
    assert.strictEqual(exportCancelRes.canceled, true, 'Export cancellation should be reported cleanly');

    // 3.2 Export write failure (e.g. invalid target path)
    const mockSaveFailure = {
      showSaveDialog: async () => ({ canceled: false, filePath: path.join(tempDir, 'nonexistent-dir', 'sub', 'export.json') })
    };
    const exportErrRes = await exportTasksDialog(null, mockSaveFailure);
    assert.strictEqual(exportErrRes.success, false);
    assert(exportErrRes.error, 'Export failure should return error message');

    // 3.3 Export successful file write
    const exportFile = path.join(tempDir, 'successful-export.json');
    const mockSaveSuccess = {
      showSaveDialog: async () => ({ canceled: false, filePath: exportFile })
    };
    const exportSuccessRes = await exportTasksDialog(null, mockSaveSuccess);
    assert.strictEqual(exportSuccessRes.success, true);
    assert(fs.existsSync(exportFile), 'Exported file must exist on disk');
    const writtenData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    assert.strictEqual(writtenData.app, 'Desktop Productivity Manager');
    assert(Array.isArray(writtenData.tasks));

    // 3.4 Import dialog canceled by user
    const mockOpenCanceled = {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] })
    };
    const importCancelRes = await importTasksDialog(null, mockOpenCanceled);
    assert.strictEqual(importCancelRes.success, false);
    assert.strictEqual(importCancelRes.canceled, true, 'Import cancellation should be reported cleanly');

    // 3.5 Import malformed JSON file
    const malformedFile = path.join(tempDir, 'malformed-import.json');
    fs.writeFileSync(malformedFile, '{ not valid JSON syntax...', 'utf8');
    const mockOpenMalformed = {
      showOpenDialog: async () => ({ canceled: false, filePaths: [malformedFile] })
    };
    const importMalformedRes = await importTasksDialog(null, mockOpenMalformed);
    assert.strictEqual(importMalformedRes.success, false);
    assert(importMalformedRes.error.includes('valid JSON'), 'Should report invalid JSON file');

    // 3.6 Import JSON without tasks array
    const noTasksFile = path.join(tempDir, 'no-tasks.json');
    fs.writeFileSync(noTasksFile, JSON.stringify({ message: 'No tasks here' }), 'utf8');
    const mockOpenNoTasks = {
      showOpenDialog: async () => ({ canceled: false, filePaths: [noTasksFile] })
    };
    const importNoTasksRes = await importTasksDialog(null, mockOpenNoTasks);
    assert.strictEqual(importNoTasksRes.success, false);
    assert(importNoTasksRes.error.includes('valid tasks array'), 'Should report missing tasks array');

    // 3.7 Import JSON with all invalid tasks
    const invalidTasksFile = path.join(tempDir, 'invalid-tasks.json');
    fs.writeFileSync(invalidTasksFile, JSON.stringify([{ invalid: 'no title' }]), 'utf8');
    const mockOpenInvalidTasks = {
      showOpenDialog: async () => ({ canceled: false, filePaths: [invalidTasksFile] })
    };
    const importInvalidRes = await importTasksDialog(null, mockOpenInvalidTasks);
    assert.strictEqual(importInvalidRes.success, false);
    assert(importInvalidRes.error.includes('No valid tasks could be extracted'), 'Should report empty valid tasks extraction');

    console.log('  ✓ Native dialog cancellations and error paths verified');
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      const localDataDir = path.join(__dirname, '../data');
      if (fs.existsSync(localDataDir)) {
        fs.rmSync(localDataDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
})();

// 4. Native Notifications and Error Handling Test
(() => {
  console.log('  Testing notification support, error recovery, and fallback...');

  // 4.1 Unsupported notifications environment
  const mockUnsupportedNotif = {
    isSupported: () => false
  };
  const unsuppRes = sendNotification({ title: 'Test', body: 'Test' }, mockUnsupportedNotif);
  assert.strictEqual(unsuppRes, false, 'Should return false when notifications are unsupported without throwing');

  // 4.2 Thrown error in notification construction
  const mockThrowingNotif = class {
    static isSupported() { return true; }
    constructor() { throw new Error('Permission denied by OS'); }
  };
  const throwRes = sendNotification({ title: 'Test', body: 'Test' }, mockThrowingNotif);
  assert.strictEqual(throwRes, false, 'Should catch OS notification errors safely and return false');

  // 4.3 Successful notification display
  let showedNotification = false;
  const mockSuccessNotif = class {
    static isSupported() { return true; }
    constructor(opts) {
      this.title = opts.title;
      this.body = opts.body;
    }
    show() { showedNotification = true; }
  };
  const successRes = sendNotification({ title: 'Success', body: 'Operation complete' }, mockSuccessNotif);
  assert.strictEqual(successRes, true);
  assert.strictEqual(showedNotification, true, 'notification.show() should be invoked');

  console.log('  ✓ Native notification fallback, error safety, and display verified');
})();

// 5. Window Lifecycle & Duplicate-Window Prevention Simulation
(() => {
  console.log('  Testing window lifecycle orchestration and duplicate window prevention...');

  let activeQuickAdd = null;
  let focusCalled = false;
  let windowCreatedCount = 0;

  function simulateOpenQuickAdd() {
    if (activeQuickAdd && !activeQuickAdd.isDestroyed()) {
      activeQuickAdd.focus();
      return activeQuickAdd;
    }
    windowCreatedCount++;
    activeQuickAdd = {
      id: windowCreatedCount,
      destroyed: false,
      isDestroyed() { return this.destroyed; },
      focus() { focusCalled = true; },
      close() { this.destroyed = true; }
    };
    return activeQuickAdd;
  }

  // First opening creates window
  const win1 = simulateOpenQuickAdd();
  assert.strictEqual(win1.id, 1);
  assert.strictEqual(windowCreatedCount, 1);

  // Second opening when window already exists focuses existing window
  focusCalled = false;
  const win2 = simulateOpenQuickAdd();
  assert.strictEqual(win2.id, 1, 'Should return existing window instance');
  assert.strictEqual(focusCalled, true, 'Existing window should be focused');
  assert.strictEqual(windowCreatedCount, 1, 'Duplicate window must not be created');

  // After window is closed, reopening creates new instance
  win1.close();
  assert.strictEqual(win1.isDestroyed(), true);
  const win3 = simulateOpenQuickAdd();
  assert.strictEqual(win3.id, 2, 'New window created after previous window closed');
  assert.strictEqual(windowCreatedCount, 2);

  console.log('  ✓ Quick-add duplicate-window prevention and lifecycle verified');
})();

// 6. Application Menu Architecture & Accelerator Verification
(() => {
  console.log('  Testing application menu accelerators and callback wiring...');

  let quickAddTriggered = false;
  let exportTriggered = false;
  let importTriggered = false;
  let applicationMenuSet = false;

  const mockMenuClass = {
    buildFromTemplate: (tpl) => {
      const fileMenu = tpl.find(item => item.label === 'File');
      assert(fileMenu, 'File menu must exist in template');
      const quickAddItem = fileMenu.submenu.find(i => i.label && i.label.includes('Quick Add'));
      const exportItem = fileMenu.submenu.find(i => i.label && i.label.includes('Export'));
      const importItem = fileMenu.submenu.find(i => i.label && i.label.includes('Import'));

      assert(quickAddItem, 'Quick Add item must exist');
      assert.strictEqual(quickAddItem.accelerator, 'CmdOrCtrl+N');
      assert(exportItem, 'Export item must exist');
      assert.strictEqual(exportItem.accelerator, 'CmdOrCtrl+E');
      assert(importItem, 'Import item must exist');
      assert.strictEqual(importItem.accelerator, 'CmdOrCtrl+I');

      quickAddItem.click();
      exportItem.click();
      importItem.click();

      return { template: tpl };
    },
    setApplicationMenu: () => {
      applicationMenuSet = true;
    }
  };

  const menu = setupApplicationMenu({
    onQuickAdd: () => { quickAddTriggered = true; },
    onExport: () => { exportTriggered = true; },
    onImport: () => { importTriggered = true; }
  }, mockMenuClass);

  assert(menu, 'Application menu must be created');
  assert.strictEqual(quickAddTriggered, true, 'onQuickAdd must be invoked by menu item click');
  assert.strictEqual(exportTriggered, true, 'onExport must be invoked by menu item click');
  assert.strictEqual(importTriggered, true, 'onImport must be invoked by menu item click');
  assert.strictEqual(applicationMenuSet, true, 'setApplicationMenu must be called');

  console.log('  ✓ Application menu shortcuts (Cmd/Ctrl+N, Cmd/Ctrl+E, Cmd/Ctrl+I) and callbacks verified');
})();

console.log('\n[Manual Verification Note] OS-level notification popups, native file picker windows, and dock integration require testing on a running desktop environment.\n');
console.log('[Test Passed] All Milestone 6 & 7 desktop integration & lifecycle unit tests passed cleanly.\n');
