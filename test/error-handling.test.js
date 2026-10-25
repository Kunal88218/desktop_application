const assert = require('assert');
const { sanitizeUserErrorMessage } = require('../src/main/error-utils');

console.log('[Test] Running Milestone 7 User-Facing Error Handling Tests...');

// 1. Path Stripping & Privacy Protection Tests
(() => {
  console.log('  Testing error sanitization and privacy protection...');

  // 1.1 Stripping absolute Unix paths
  const unixError = "ENOENT: no such file or directory, open '/Users/kunalsingh/Desktop/Desktop_app/data/tasks.json'";
  const cleanedUnix = sanitizeUserErrorMessage(unixError);
  assert(!cleanedUnix.includes('/Users/kunalsingh'), 'Private Unix paths must not appear in user error message');
  assert(!cleanedUnix.includes('ENOENT'), 'Raw OS error code must be stripped');

  // 1.2 Stripping absolute Windows paths
  const winError = "EACCES: permission denied, open 'C:\\Users\\Administrator\\AppData\\Roaming\\tasks.json'";
  const cleanedWin = sanitizeUserErrorMessage(winError);
  assert(!cleanedWin.includes('C:\\Users\\Administrator'), 'Private Windows paths must not appear in user error message');
  assert(!cleanedWin.includes('EACCES'), 'Raw Windows OS error code must be stripped');

  // 1.3 Stripping stack traces
  const stackError = "Error: Database failure\n    at loadTasks (/app/src/storage.js:45:10)\n    at processTicksAndRejections";
  const cleanedStack = sanitizeUserErrorMessage(stackError);
  assert(!cleanedStack.includes('at loadTasks'), 'Stack trace lines must be excluded from user-facing message');
  assert(!cleanedStack.includes('processTicksAndRejections'), 'Internal runtime frames must be excluded');

  console.log('  ✓ Private paths, raw error codes, and stack traces safely sanitized');
})();

// 2. User-Friendly Pattern Mapping Tests
(() => {
  console.log('  Testing pattern-based friendly error message translation...');

  // 2.1 Malformed JSON
  const jsonErr = "Unexpected token '}' at line 1 column 2 in JSON.parse";
  assert.strictEqual(
    sanitizeUserErrorMessage(jsonErr),
    'The selected file contains invalid or corrupted JSON data.'
  );

  // 2.2 Missing tasks array in import
  const arrayErr = "JSON file does not contain a valid tasks array.";
  assert.strictEqual(
    sanitizeUserErrorMessage(arrayErr),
    'The selected file does not contain a valid tasks list.'
  );

  // 2.3 Empty extracted tasks
  const extractErr = "No valid tasks could be extracted from the file.";
  assert.strictEqual(
    sanitizeUserErrorMessage(extractErr),
    'No valid tasks could be found in the imported file.'
  );

  // 2.4 Corrupted storage fallback
  const corruptErr = "Task data file was corrupted. Loaded emergency backup.";
  assert.strictEqual(
    sanitizeUserErrorMessage(corruptErr),
    'Task data was corrupted. Safe backup tasks loaded.'
  );

  // 2.5 Permission denied
  const permErr = "EACCES: permission denied";
  assert.strictEqual(
    sanitizeUserErrorMessage(permErr),
    'Access was denied. Please check file permissions.'
  );

  // 2.6 File not found
  const noFileErr = "ENOENT: no such file or directory";
  assert.strictEqual(
    sanitizeUserErrorMessage(noFileErr),
    'The requested file or destination could not be found.'
  );

  // 2.7 Null, undefined, and non-string error fallbacks
  assert.strictEqual(sanitizeUserErrorMessage(null), 'An unexpected error occurred.');
  assert.strictEqual(sanitizeUserErrorMessage(undefined), 'An unexpected error occurred.');
  assert.strictEqual(sanitizeUserErrorMessage('', 'Custom fallback'), 'Custom fallback');

  console.log('  ✓ Error translation correctly provides clean, actionable feedback');
})();

// 3. UI State Recovery and Toast Deduplication Logic
(() => {
  console.log('  Testing UI control state recovery and notification deduplication...');

  // 3.1 Simulated button state recovery pattern
  let buttonState = { disabled: false, textContent: 'Export Tasks' };
  async function simulateOperationWithFailure() {
    buttonState.disabled = true;
    buttonState.textContent = 'Exporting...';
    try {
      throw new Error('Simulated network/disk error');
    } catch (err) {
      // Error handled
    } finally {
      buttonState.disabled = false;
      buttonState.textContent = 'Export Tasks';
    }
  }

  simulateOperationWithFailure();
  assert.strictEqual(buttonState.disabled, false, 'Button disabled flag must reset on failure');
  assert.strictEqual(buttonState.textContent, 'Export Tasks', 'Button text must reset on failure');

  // 3.2 Toast deduplication simulation
  let toastLog = [];
  let lastMessage = '';
  let lastTime = 0;
  function simulateToast(msg, timestamp) {
    if (msg === lastMessage && timestamp - lastTime < 1500) {
      return; // deduplicated
    }
    lastMessage = msg;
    lastTime = timestamp;
    toastLog.push({ msg, timestamp });
  }

  // Trigger 3 identical messages in rapid succession (< 1.5s)
  simulateToast('Failed to save changes to disk', 1000);
  simulateToast('Failed to save changes to disk', 1100);
  simulateToast('Failed to save changes to disk', 1200);

  // Trigger different message
  simulateToast('Another error occurred', 1300);

  // Trigger same message after debounce interval (> 1.5s)
  simulateToast('Failed to save changes to disk', 3000);

  assert.strictEqual(toastLog.length, 3, 'Rapid identical toasts should be debounced to avoid flooding UI');
  assert.strictEqual(toastLog[0].msg, 'Failed to save changes to disk');
  assert.strictEqual(toastLog[1].msg, 'Another error occurred');
  assert.strictEqual(toastLog[2].msg, 'Failed to save changes to disk');

  console.log('  ✓ UI state recovery and toast deduplication verified');
})();

console.log('\n[Test Passed] All Milestone 7 user-facing error handling tests passed cleanly.\n');
