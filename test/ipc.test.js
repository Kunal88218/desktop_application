const assert = require('assert');
const { isValidSender } = require('../src/main/ipc');

console.log('[Test] Running Milestone 5 Unit Tests: Secure IPC Communication...');

// 1. Sender Validation Tests
(() => {
  console.log('  Testing isValidSender() origin protection...');

  // Valid local application origins
  const validLocalEvent = {
    senderFrame: {
      url: 'file:///Users/kunalsingh/Desktop/Desktop_app/src/renderer/index.html'
    }
  };
  assert.strictEqual(isValidSender(validLocalEvent), true, 'Local file:// URLs must be authorized');

  // Valid DevTools origin
  const validDevToolsEvent = {
    senderFrame: {
      url: 'devtools://devtools/bundled/devtools_app.html'
    }
  };
  assert.strictEqual(isValidSender(validDevToolsEvent), true, 'DevTools URLs must be authorized');

  // Blocked remote / untrusted origins
  const maliciousRemoteEvent = {
    senderFrame: {
      url: 'https://malicious-phishing-site.com/exploit.html'
    }
  };
  assert.strictEqual(isValidSender(maliciousRemoteEvent), false, 'Remote https:// origins must be strictly rejected');

  const httpRemoteEvent = {
    senderFrame: {
      url: 'http://insecure-domain.org'
    }
  };
  assert.strictEqual(isValidSender(httpRemoteEvent), false, 'Remote http:// origins must be rejected');

  // Empty or invalid url
  const emptyUrlEvent = {
    senderFrame: {
      url: ''
    }
  };
  assert.strictEqual(isValidSender(emptyUrlEvent), false, 'Empty sender frame url must be rejected');

  console.log('  ✓ isValidSender() correctly validates sender frame origins');
})();

console.log('\n[Test Passed] All Milestone 5 IPC unit tests passed cleanly.\n');
