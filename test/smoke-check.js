const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

console.log('[Test] Starting Electron smoke test...');

const child = spawn(electronPath, [path.join(__dirname, '..')], {
  env: { ...process.env, TEST_SMOKE: 'true' },
  stdio: 'inherit'
});

const timeout = setTimeout(() => {
  console.error('[Test Failed] Electron did not complete smoke test within 10s');
  child.kill('SIGTERM');
  process.exit(1);
}, 10000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    console.log('[Test Passed] Electron booted, window loaded, and app exited cleanly.');
    process.exit(0);
  } else {
    console.error(`[Test Failed] Electron exited with non-zero exit code: ${code}`);
    process.exit(code || 1);
  }
});
