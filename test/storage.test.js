const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateTasks, loadTasks, saveTasks, DEFAULT_TASKS } = require('../src/main/storage');

console.log('[Test] Running Milestone 4 & 7 Storage & Persistence Tests...');

// 1. Task Validation Tests
(() => {
  console.log('  Testing validateTasks() schema enforcement and sanitization...');

  // 1.1 Non-array input rejection
  const invalidInputs = ['not an array', null, undefined, 12345, true, { tasks: [] }];
  for (const invalid of invalidInputs) {
    assert.throws(() => {
      validateTasks(invalid);
    }, /Invalid task list format/, `Should reject non-array input: ${typeof invalid}`);
  }

  // 1.2 Empty array input
  assert.deepStrictEqual(validateTasks([]), [], 'Empty array input should return empty array');

  // 1.3 Valid task passes through unchanged
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
  assert.strictEqual(validated[0].id, 'task-100');
  assert.strictEqual(validated[0].title, 'Valid Task Title');
  assert.strictEqual(validated[0].description, 'Some valid details');
  assert.strictEqual(validated[0].priority, 'high');
  assert.strictEqual(validated[0].dueDate, '2026-10-30');
  assert.strictEqual(validated[0].completed, true);
  assert.strictEqual(validated[0].createdAt, 1700000000000);

  // 1.4 Dropping invalid task records (primitives, missing/empty title, nested arrays)
  const malformedRecords = [
    null,
    undefined,
    12345,
    'just a string',
    true,
    ['nested array'],
    {},
    { title: '' },
    { title: '   ' },
    { title: null },
    { title: 12345 },
    { title: false },
    { title: { text: 'Nested title' } },
    { title: ['array title'] }
  ];
  const filtered = validateTasks(malformedRecords);
  assert.strictEqual(filtered.length, 0, 'Malformed records or tasks without valid string title must be dropped');

  // 1.5 Missing optional fields receive safe defaults
  const minimalTask = [{ title: 'Minimal Task' }];
  const sanitizedMinimal = validateTasks(minimalTask);
  assert.strictEqual(sanitizedMinimal.length, 1);
  assert(sanitizedMinimal[0].id.startsWith('task-'), 'Generated ID should have task- prefix');
  assert.strictEqual(sanitizedMinimal[0].title, 'Minimal Task');
  assert.strictEqual(sanitizedMinimal[0].description, '');
  assert.strictEqual(sanitizedMinimal[0].priority, 'medium');
  assert.strictEqual(sanitizedMinimal[0].dueDate, '');
  assert.strictEqual(sanitizedMinimal[0].completed, false);
  assert(typeof sanitizedMinimal[0].createdAt === 'number' && sanitizedMinimal[0].createdAt > 0);

  // 1.6 Priority validation, fallback, and normalization
  const priorityTest = validateTasks([
    { title: 'T1', priority: 'INVALID_PRIORITY' },
    { title: 'T2', priority: 'low' },
    { title: 'T3', priority: 'HIGH' },
    { title: 'T4', priority: ' Medium ' },
    { title: 'T5', priority: 123 },
    { title: 'T6', priority: null },
    { title: 'T7', priority: 'urgent' },
    { title: 'T8', priority: 'critical' }
  ]);
  assert.strictEqual(priorityTest[0].priority, 'medium', 'Invalid string priority should fall back to medium');
  assert.strictEqual(priorityTest[1].priority, 'low', 'lowercase low should be accepted');
  assert.strictEqual(priorityTest[2].priority, 'high', 'uppercase HIGH should be normalized to high');
  assert.strictEqual(priorityTest[3].priority, 'medium', 'whitespace padded Medium should be trimmed to medium');
  assert.strictEqual(priorityTest[4].priority, 'medium', 'Numeric priority should fall back to medium');
  assert.strictEqual(priorityTest[5].priority, 'medium', 'null priority should fall back to medium');
  assert.strictEqual(priorityTest[6].priority, 'medium', 'unsupported priority "urgent" should fall back to medium');
  assert.strictEqual(priorityTest[7].priority, 'medium', 'unsupported priority "critical" should fall back to medium');

  // 1.7 Completed boolean coercion
  const boolTest = validateTasks([
    { title: 'Bool 1', completed: 1 },
    { title: 'Bool 2', completed: 0 },
    { title: 'Bool 3', completed: 'yes' },
    { title: 'Bool 4', completed: false },
    { title: 'Bool 5', completed: true },
    { title: 'Bool 6', completed: null },
    { title: 'Bool 7', completed: undefined }
  ]);
  assert.strictEqual(boolTest[0].completed, true);
  assert.strictEqual(boolTest[1].completed, false);
  assert.strictEqual(boolTest[2].completed, true);
  assert.strictEqual(boolTest[3].completed, false);
  assert.strictEqual(boolTest[4].completed, true);
  assert.strictEqual(boolTest[5].completed, false);
  assert.strictEqual(boolTest[6].completed, false);

  // 1.8 Duplicate ID handling
  const duplicateIdTasks = [
    { id: 'dup-id', title: 'First Task' },
    { id: 'dup-id', title: 'Second Task' },
    { id: 'dup-id', title: 'Third Task' }
  ];
  const deduplicated = validateTasks(duplicateIdTasks);
  assert.strictEqual(deduplicated.length, 3, 'All tasks should be preserved');
  assert.strictEqual(deduplicated[0].id, 'dup-id', 'First task keeps its original ID');
  assert.notStrictEqual(deduplicated[1].id, 'dup-id', 'Second duplicate task receives new ID');
  assert.notStrictEqual(deduplicated[2].id, 'dup-id', 'Third duplicate task receives new ID');
  assert.notStrictEqual(deduplicated[1].id, deduplicated[2].id, 'Regenerated IDs must be distinct');
  const uniqueIds = new Set(deduplicated.map(t => t.id));
  assert.strictEqual(uniqueIds.size, 3, 'All resulting task IDs must be unique');

  // 1.9 Invalid field types for description, dueDate, createdAt
  const invalidFieldTypes = [
    {
      title: 'Type Checking Task',
      description: { not: 'a string' },
      dueDate: 20261025,
      createdAt: 'invalid-date'
    }
  ];
  const sanitizedTypes = validateTasks(invalidFieldTypes);
  assert.strictEqual(sanitizedTypes[0].description, '', 'Non-string description should default to empty string');
  assert.strictEqual(sanitizedTypes[0].dueDate, '', 'Non-string dueDate should default to empty string');
  assert(typeof sanitizedTypes[0].createdAt === 'number' && Number.isFinite(sanitizedTypes[0].createdAt), 'Invalid createdAt should default to current timestamp');

  // 1.10 Field length clipping / bounds protection
  const longTitle = 'A'.repeat(500);
  const longDesc = 'B'.repeat(3000);
  const longDueDate = '2026-10-25' + 'C'.repeat(100);
  const clipped = validateTasks([
    {
      title: longTitle,
      description: longDesc,
      dueDate: longDueDate
    }
  ]);
  assert.strictEqual(clipped[0].title.length, 300, 'Title must be capped at 300 chars');
  assert.strictEqual(clipped[0].description.length, 2000, 'Description must be capped at 2000 chars');
  assert.strictEqual(clipped[0].dueDate.length, 50, 'DueDate must be capped at 50 chars');

  console.log('  ✓ validateTasks() passes all schema, edge cases, and sanitization checks');
})();

// 2. Storage File I/O, Failure Handling, and Recovery Tests
(async () => {
  console.log('  Testing storage file reading, atomic writing, and error recovery...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-mgr-test-'));

  try {
    // 2.1 First-run initialization when file is missing
    const missingFile = path.join(tempDir, 'nonexistent-tasks.json');
    const initRes = await loadTasks(missingFile);
    assert.strictEqual(initRes.success, true, 'First-run should succeed');
    assert.strictEqual(initRes.isInitialSeed, true, 'First-run should report isInitialSeed');
    assert.strictEqual(initRes.tasks.length, DEFAULT_TASKS.length, 'First-run should seed DEFAULT_TASKS');
    assert(fs.existsSync(missingFile), 'First-run should create file on disk');

    // 2.2 Atomic write persists valid tasks cleanly
    const sampleTasks = [
      { id: 't-1', title: 'Atomic Task 1', priority: 'high', completed: false },
      { id: 't-2', title: 'Atomic Task 2', priority: 'low', completed: true }
    ];
    const saveRes = await saveTasks(sampleTasks, missingFile);
    assert.strictEqual(saveRes.success, true, 'saveTasks should succeed');
    assert.strictEqual(saveRes.count, 2, 'saveTasks should report count');
    assert(!fs.existsSync(`${missingFile}.tmp`), 'Temporary file should be removed after rename');

    // Read back through loadTasks
    const loadRes = await loadTasks(missingFile);
    assert.strictEqual(loadRes.success, true);
    assert.strictEqual(loadRes.tasks.length, 2);
    assert.strictEqual(loadRes.tasks[0].title, 'Atomic Task 1');

    // 2.3 Empty storage file handling
    const emptyFile = path.join(tempDir, 'empty-tasks.json');
    fs.writeFileSync(emptyFile, '   \n  ', 'utf8');
    const emptyRes = await loadTasks(emptyFile);
    assert.strictEqual(emptyRes.success, true);
    assert.deepStrictEqual(emptyRes.tasks, [], 'Empty file should safely return empty array');

    // 2.4 Corrupted JSON recovery (does not crash or destroy the file)
    const corruptedFile = path.join(tempDir, 'corrupted-tasks.json');
    const corruptedContent = '{"tasks": [BROKEN_JSON_SYNTAX...';
    fs.writeFileSync(corruptedFile, corruptedContent, 'utf8');

    const corruptRes = await loadTasks(corruptedFile);
    assert.strictEqual(corruptRes.success, false, 'Corrupted JSON should return failure flag');
    assert(corruptRes.error.includes('corrupted'), 'Error should indicate file was corrupted');
    assert.strictEqual(corruptRes.tasks.length, DEFAULT_TASKS.length, 'Should provide DEFAULT_TASKS fallback');
    // Ensure the corrupted file was NOT overwritten or destroyed
    const contentAfterCorruptRead = fs.readFileSync(corruptedFile, 'utf8');
    assert.strictEqual(contentAfterCorruptRead, corruptedContent, 'Corrupted file must be preserved intact for forensics');

    // 2.5 Invalid stored data structure (valid JSON, but not an array)
    const invalidStructFile = path.join(tempDir, 'invalid-struct-tasks.json');
    fs.writeFileSync(invalidStructFile, JSON.stringify({ invalid: 'object' }), 'utf8');

    const invalidStructRes = await loadTasks(invalidStructFile);
    assert.strictEqual(invalidStructRes.success, false, 'Non-array JSON should return failure flag');
    assert(invalidStructRes.error.includes('invalid'), 'Error should describe invalid format');
    assert.strictEqual(invalidStructRes.tasks.length, DEFAULT_TASKS.length, 'Should fallback to default tasks');

    // 2.6 Failed save does not overwrite existing file or leave tmp artifacts
    const preSaveContent = fs.readFileSync(missingFile, 'utf8');
    const invalidSaveRes = await saveTasks('invalid-non-array-payload', missingFile);
    assert.strictEqual(invalidSaveRes.success, false, 'Invalid save payload should fail');
    assert(invalidSaveRes.error.includes('Invalid task list format'), 'Error should explain validation failure');
    // Ensure pre-existing valid file is unmodified
    const postSaveContent = fs.readFileSync(missingFile, 'utf8');
    assert.strictEqual(postSaveContent, preSaveContent, 'Existing file must not be modified when save fails');
    assert(!fs.existsSync(`${missingFile}.tmp`), 'Temporary .tmp file must be cleaned up on failure');

    // 2.7 Auto-creation of nested directory path
    const nestedFile = path.join(tempDir, 'sub', 'folder', 'tasks.json');
    const nestedSaveRes = await saveTasks(sampleTasks, nestedFile);
    assert.strictEqual(nestedSaveRes.success, true, 'saveTasks should automatically create parent directories');
    assert(fs.existsSync(nestedFile), 'Nested file should be created');

    console.log('  ✓ Storage read/write, failure handling, and recovery verified');
  } finally {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n[Test Passed] All Milestone 4 & 7 persistence and recovery tests passed cleanly.\n');
})();
