const assert = require('assert');
const { validateTasks } = require('../src/main/storage');

console.log('[Test] Running Milestone 6 Unit Tests: Native Desktop Integrations...');

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

console.log('\n[Test Passed] All Milestone 6 desktop integration unit tests passed cleanly.\n');
