const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isValidSender } = require('../src/main/ipc');
const { validateTasks, DEFAULT_TASKS } = require('../src/main/storage');

console.log('[Test] Running Milestone 7 Security Hardening & Regression Suite...');

// 1. Content Security Policy (CSP) Verification
(() => {
  console.log('  Verifying Content Security Policy in renderer HTML templates...');

  const htmlFiles = [
    path.join(__dirname, '../src/renderer/index.html'),
    path.join(__dirname, '../src/renderer/quick-add.html')
  ];

  for (const file of htmlFiles) {
    assert(fs.existsSync(file), `HTML file must exist: ${file}`);
    const content = fs.readFileSync(file, 'utf8');

    // CSP tag existence
    assert(
      content.includes('http-equiv="Content-Security-Policy"'),
      `File ${path.basename(file)} must define a Content-Security-Policy meta tag`
    );

    // script-src restrictions
    assert(
      content.includes("script-src 'self'"),
      `File ${path.basename(file)} must restrict script-src to 'self'`
    );

    // Ensure unsafe-eval is not allowed
    assert(
      !content.includes("'unsafe-eval'"),
      `File ${path.basename(file)} must not enable 'unsafe-eval'`
    );

    // default-src restrictions
    assert(
      content.includes("default-src 'self'"),
      `File ${path.basename(file)} must restrict default-src to 'self'`
    );
  }

  console.log('  ✓ Content Security Policy is strictly configured on all application windows');
})();

// 2. Preload Script Exposure & Sandbox Verification
(() => {
  console.log('  Auditing Preload API isolation and exposure...');

  const preloadPath = path.join(__dirname, '../src/preload/preload.js');
  assert(fs.existsSync(preloadPath), 'Preload script must exist');
  const preloadSource = fs.readFileSync(preloadPath, 'utf8');

  // Must use contextBridge.exposeInMainWorld
  assert(
    preloadSource.includes('contextBridge.exposeInMainWorld'),
    'Preload must use contextBridge.exposeInMainWorld for isolation'
  );

  // Must not directly expose raw ipcRenderer
  assert(
    !preloadSource.includes('contextBridge.exposeInMainWorld(\'ipcRenderer\''),
    'Must not expose raw ipcRenderer directly'
  );
  assert(
    !preloadSource.includes('rawIpc: ipcRenderer'),
    'Must not expose raw ipcRenderer object under an alias'
  );

  // Must not expose Node require, process, or child_process
  assert(
    !preloadSource.includes('require: require'),
    'Must not expose Node require to renderer'
  );
  assert(
    !preloadSource.includes('child_process'),
    'Must not expose child_process in preload'
  );

  console.log('  ✓ Preload bridge adheres to least-privilege API exposure principles');
})();

// 3. Electron Main Process Security Settings Audit
(() => {
  console.log('  Auditing BrowserWindow webPreferences and navigation policies...');

  const mainSource = fs.readFileSync(path.join(__dirname, '../src/main/main.js'), 'utf8');

  // Verify secure window defaults in BrowserWindow configurations
  const contextIsolationMatches = mainSource.match(/contextIsolation:\s*true/g) || [];
  assert.strictEqual(
    contextIsolationMatches.length,
    2,
    'Both primary and secondary windows must enable contextIsolation: true'
  );

  const nodeIntegrationMatches = mainSource.match(/nodeIntegration:\s*false/g) || [];
  assert.strictEqual(
    nodeIntegrationMatches.length,
    2,
    'Both primary and secondary windows must set nodeIntegration: false'
  );

  const sandboxMatches = mainSource.match(/sandbox:\s*true/g) || [];
  assert.strictEqual(
    sandboxMatches.length,
    2,
    'Both primary and secondary windows must enable sandbox: true'
  );

  // Verify external window opening is denied
  const windowOpenHandlerMatches = mainSource.match(/setWindowOpenHandler/g) || [];
  assert(
    windowOpenHandlerMatches.length >= 2,
    'Both windows must attach setWindowOpenHandler to prevent unauthorized popup windows'
  );

  // Verify will-navigate blocks non-file navigation
  const willNavigateMatches = mainSource.match(/will-navigate/g) || [];
  assert(
    willNavigateMatches.length >= 2,
    'Both windows must prevent external navigation using will-navigate handlers'
  );

  console.log('  ✓ Window configurations enforce isolation, sandboxing, and navigation locks');
})();

// 4. Task Management Regression Pass
(() => {
  console.log('  Testing core task management schema regression...');

  // Ensure default seed tasks conform to schema
  const validatedSeed = validateTasks(DEFAULT_TASKS);
  assert.strictEqual(
    validatedSeed.length,
    DEFAULT_TASKS.length,
    'All default seed tasks must pass validation'
  );

  for (const t of validatedSeed) {
    assert(typeof t.id === 'string' && t.id.length > 0);
    assert(typeof t.title === 'string' && t.title.length > 0);
    assert(['low', 'medium', 'high'].includes(t.priority));
    assert(typeof t.completed === 'boolean');
    assert(typeof t.createdAt === 'number' && Number.isFinite(t.createdAt));
  }

  // Ensure malformed tasks are stripped while preserving valid ones
  const mixed = [
    { title: 'Legit Task', priority: 'high' },
    null,
    { title: '   ' },
    { title: 'Second Legit Task', completed: true }
  ];
  const validatedMixed = validateTasks(mixed);
  assert.strictEqual(validatedMixed.length, 2);
  assert.strictEqual(validatedMixed[0].title, 'Legit Task');
  assert.strictEqual(validatedMixed[1].title, 'Second Legit Task');

  console.log('  ✓ Core task validation regression passed');
})();

console.log('\n[Test Passed] All Milestone 7 security hardening and regression checks passed cleanly.\n');
