const { spawn } = require('child_process');
const path = require('path');
const electronPath = require('electron');

console.log('[Test] Running Milestone 3 verification: Task Management Interface...');

const child = spawn(electronPath, [path.join(__dirname, '..')], {
  env: { ...process.env, TEST_SMOKE: 'true' },
  stdio: ['inherit', 'pipe', 'pipe']
});

let stdoutData = '';
let stderrData = '';

child.stdout.on('data', (data) => {
  const str = data.toString();
  stdoutData += str;
  process.stdout.write(str);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  stderrData += str;
  process.stderr.write(str);
});

const timeout = setTimeout(() => {
  console.error('[Test Failed] Electron did not complete window architecture verification within 10s');
  child.kill('SIGTERM');
  process.exit(1);
}, 10000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    // Assert required diagnostic markers appeared in output
    const hasPreload = stdoutData.includes('Creating primary window with preload');
    const hasAppReady = stdoutData.includes('Electron application ready');
    const hasWindowLoaded = stdoutData.includes('Main window loaded successfully');

    if (hasPreload && hasAppReady && hasWindowLoaded) {
      console.log('\n[Test Passed] All window architecture and lifecycle assertions succeeded.');
      process.exit(0);
    } else {
      console.error('\n[Test Failed] Missing required lifecycle log assertions in output.');
      process.exit(1);
    }
  } else {
    console.error(`\n[Test Failed] Electron exited with non-zero exit code: ${code}`);
    process.exit(code || 1);
  }
});
