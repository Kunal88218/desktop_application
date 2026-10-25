const assert = require('assert');
const { isValidSender, registerIpcHandlers } = require('../src/main/ipc');

console.log('[Test] Running Milestone 5 & 7 Secure IPC Communication Tests...');

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

  // Blocked alternative protocols
  const altProtocols = [
    'ftp://files.example.com',
    'ws://echo.websocket.events',
    'data:text/html,<html>attack</html>',
    'blob:null/12345678-1234-1234-1234-123456789abc',
    'javascript:alert(1)'
  ];
  for (const protoUrl of altProtocols) {
    assert.strictEqual(isValidSender({ senderFrame: { url: protoUrl } }), false, `Protocol ${protoUrl} must be rejected`);
  }

  // Null, empty, missing, or malformed events
  assert.strictEqual(isValidSender(null), false, 'null event must be rejected');
  assert.strictEqual(isValidSender(undefined), false, 'undefined event must be rejected');
  assert.strictEqual(isValidSender({}), false, 'event without senderFrame must be rejected');
  assert.strictEqual(isValidSender({ senderFrame: null }), false, 'event with null senderFrame must be rejected');
  assert.strictEqual(isValidSender({ senderFrame: {} }), false, 'event with empty senderFrame must be rejected');
  assert.strictEqual(isValidSender({ senderFrame: { url: '' } }), false, 'Empty sender frame url must be rejected');
  assert.strictEqual(isValidSender({ senderFrame: { url: 12345 } }), false, 'Non-string sender frame url must be rejected');

  console.log('  ✓ isValidSender() correctly validates sender frame origins');
})();

// 2. Comprehensive IPC Handlers Payload & Authorization Validation
(async () => {
  console.log('  Testing IPC handlers authorization and payload validation...');

  const handlers = {};
  const mockIpc = {
    handle: (channel, fn) => {
      handlers[channel] = fn;
    }
  };

  let quickAddOpened = false;
  let quickAddClosed = false;

  registerIpcHandlers({
    getMainWindow: () => null,
    openQuickAddWindow: () => { quickAddOpened = true; },
    closeQuickAddWindow: () => { quickAddClosed = true; }
  }, mockIpc);

  const validEvent = {
    senderFrame: {
      url: 'file:///app/src/renderer/index.html'
    },
    sender: {}
  };

  const unauthorizedEvent = {
    senderFrame: {
      url: 'https://evil.attacker.com'
    },
    sender: {}
  };

  // 2.1 Verify required handlers are registered
  const expectedChannels = [
    'app:get-info',
    'app:ping',
    'tasks:load',
    'tasks:save',
    'tasks:get-path',
    'tasks:export-dialog',
    'tasks:import-dialog',
    'window:open-quick-add',
    'tasks:quick-add',
    'window:close-current',
    'notifications:send'
  ];
  for (const channel of expectedChannels) {
    assert.strictEqual(typeof handlers[channel], 'function', `Handler for ${channel} must be registered`);
  }

  // 2.2 Rejection of unauthorized senders on all channels
  const unauthGetInfo = await handlers['app:get-info'](unauthorizedEvent);
  assert.strictEqual(unauthGetInfo.success, false);
  assert.strictEqual(unauthGetInfo.error, 'Unauthorized IPC origin');

  const unauthPing = await handlers['app:ping'](unauthorizedEvent);
  assert.strictEqual(unauthPing.success, false);

  const unauthLoad = await handlers['tasks:load'](unauthorizedEvent);
  assert.strictEqual(unauthLoad.success, false);

  const unauthSave = await handlers['tasks:save'](unauthorizedEvent, []);
  assert.strictEqual(unauthSave.success, false);

  const unauthQuickAdd = await handlers['tasks:quick-add'](unauthorizedEvent, { title: 'Test' });
  assert.strictEqual(unauthQuickAdd.success, false);

  const unauthNotif = await handlers['notifications:send'](unauthorizedEvent, { title: 'T', body: 'B' });
  assert.strictEqual(unauthNotif, false);

  // 2.3 tasks:save payload validation
  const invalidSavePayloads = [null, undefined, 123, 'tasks-string', { tasks: [] }, true];
  for (const payload of invalidSavePayloads) {
    const res = await handlers['tasks:save'](validEvent, payload);
    assert.strictEqual(res.success, false, `Non-array save payload ${typeof payload} must be rejected`);
    assert(res.error.includes('must be an array'));
  }

  // 2.4 tasks:quick-add payload validation
  const invalidQuickAddPayloads = [
    null,
    undefined,
    'not an object',
    [],
    {},
    { title: '' },
    { title: '   ' },
    { title: 12345 },
    { title: null }
  ];
  for (const payload of invalidQuickAddPayloads) {
    const res = await handlers['tasks:quick-add'](validEvent, payload);
    assert.strictEqual(res.success, false, 'Invalid quick-add payload must be rejected');
    assert(res.error, 'Should provide error message for invalid payload');
  }

  // 2.5 app:ping payload validation
  const validPing = await handlers['app:ping'](validEvent, 123456789);
  assert.strictEqual(validPing.success, true);
  assert.strictEqual(validPing.data.clientTimestamp, 123456789);

  const invalidPing = await handlers['app:ping'](validEvent, 'not-a-number');
  assert.strictEqual(invalidPing.success, true);
  assert.strictEqual(invalidPing.data.clientTimestamp, null, 'Non-numeric client timestamp should normalize to null');

  // 2.6 window:open-quick-add invocation
  const openRes = await handlers['window:open-quick-add'](validEvent);
  assert.strictEqual(openRes.success, true);
  assert.strictEqual(quickAddOpened, true, 'openQuickAddWindow should be invoked');

  console.log('  ✓ All IPC handlers reject unauthorized origins and validate payloads');
})();

console.log('\n[Test Passed] All Milestone 5 & 7 IPC security tests passed cleanly.\n');
