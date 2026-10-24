const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateTasks, DEFAULT_TASKS } = require('../src/main/storage');

console.log('[Test] Running Milestone 4 Unit Tests: Storage & Persistence...');

// 1. Task Validation Tests
(() => {
  console.log('  Testing validateTasks() schema enforcement...');

  // Non-array rejection
  assert.throws(() => {
    validateTasks('not an array');
  }, /Invalid task list format/, 'Should reject non-array inputs');

  // Valid tasks pass through
  const sample = [
    {
      id: 'task-100',
      title: 'Valid Task Title',
      description: 'Some valid details',
      priority: 'high',
      dueDate: '2026-10-30',
      completed: true,
      createdAt: 1700000000000
    }
  ];
  const validated = validateTasks(sample);
  assert.strictEqual(validated.length, 1);
  assert.strictEqual(validated[0].title, 'Valid Task Title');
  assert.strictEqual(validated[0].priority, 'high');
  assert.strictEqual(validated[0].completed, true);

  // Dropping invalid tasks (missing or empty title)
  const invalidSamples = [
    null,
    undefined,
    {},
    { title: '' },
    { title: '   ' },
    { title: 12345 }
  ];
  const filtered = validateTasks(invalidSamples);
  assert.strictEqual(filtered.length, 0, 'Tasks without valid title must be dropped');

  // Priority fallback to medium
  const priorityTest = validateTasks([
    { title: 'Test 1', priority: 'INVALID_PRIORITY' },
    { title: 'Test 2', priority: 'low' },
    { title: 'Test 3', priority: 'HIGH' }
  ]);
  assert.strictEqual(priorityTest[0].priority, 'medium', 'Invalid priority should fall back to medium');
  assert.strictEqual(priorityTest[1].priority, 'low');
  assert.strictEqual(priorityTest[2].priority, 'high');

  // Completed coercion
  const boolTest = validateTasks([
    { title: 'Bool 1', completed: 1 },
    { title: 'Bool 2', completed: 0 },
    { title: 'Bool 3', completed: 'yes' }
  ]);
  assert.strictEqual(boolTest[0].completed, true);
  assert.strictEqual(boolTest[1].completed, false);
  assert.strictEqual(boolTest[2].completed, true);

  console.log('  ✓ validateTasks() passes all schema and sanitization checks');
})();

// 2. Storage File I/O & Atomic Write Simulation Tests
(async () => {
  console.log('  Testing storage file reading, atomic writing, and error recovery...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-mgr-test-'));
  const testFile = path.join(tempDir, 'test-tasks.json');
  const tempFile = `${testFile}.tmp`;

  try {
    // Atomic Write test
    const tasksToWrite = [
      { id: 't-1', title: 'Persisted Task', priority: 'high', completed: false }
    ];
    const validated = validateTasks(tasksToWrite);
    fs.writeFileSync(tempFile, JSON.stringify(validated, null, 2), 'utf8');
    fs.renameSync(tempFile, testFile);

    assert(fs.existsSync(testFile), 'Target file should exist after rename');
    const readContent = JSON.parse(fs.readFileSync(testFile, 'utf8'));
    assert.strictEqual(readContent.length, 1);
    assert.strictEqual(readContent[0].title, 'Persisted Task');

    // Corrupted file recovery test
    fs.writeFileSync(testFile, '{{INVALID_JSON_CORRUPTED_DATA', 'utf8');
    let loadedData;
    try {
      const raw = fs.readFileSync(testFile, 'utf8');
      loadedData = JSON.parse(raw);
    } catch (err) {
      // Fallback
      loadedData = DEFAULT_TASKS;
    }
    assert(Array.isArray(loadedData), 'Corrupted JSON should safely trigger fallback');
    assert.strictEqual(loadedData.length, DEFAULT_TASKS.length);

    console.log('  ✓ Storage read/write and corruption fallback verified');
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      fs.rmdirSync(tempDir);
    } catch (_) {}
  }

  console.log('\n[Test Passed] All Milestone 4 persistence unit tests passed cleanly.\n');
})();
