const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Default initial tasks to seed when application is launched for the first time
const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Review Electron Process Security Architecture',
    description: 'Ensure contextIsolation, nodeIntegration: false, and preload sandboxing are verified.',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    completed: true,
    createdAt: Date.now() - 3600000
  },
  {
    id: 'task-2',
    title: 'Design In-Class Presentation Slides',
    description: 'Highlight IPC request-response pattern and multi-window orchestration.',
    priority: 'medium',
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    completed: false,
    createdAt: Date.now() - 1800000
  },
  {
    id: 'task-3',
    title: 'Conduct Automated Smoke Testing',
    description: 'Verify application launches headlessly and cleanly on macOS and Windows.',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    createdAt: Date.now() - 900000
  },
  {
    id: 'task-4',
    title: 'Organize Local Project Documentation',
    description: 'Prepare README and architecture flowcharts for grading evaluation.',
    priority: 'low',
    dueDate: '',
    completed: false,
    createdAt: Date.now()
  }
];

function getStorageFilePath() {
  const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../data');
  return path.join(userDataPath, 'tasks.json');
}

/**
 * Validates and sanitizes an array of task objects.
 * Discards malformed items and strictly enforces types and allowed values.
 */
function validateTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new Error('Invalid task list format: expected an array');
  }

  const validPriorities = ['low', 'medium', 'high'];
  const sanitized = [];
  const seenIds = new Set();

  for (const item of tasks) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    // Validate Title (required, string, non-empty, max 300 chars)
    if (typeof item.title !== 'string' || !item.title.trim()) {
      continue; // Skip tasks without a title
    }
    const title = item.title.trim().substring(0, 300);

    // Validate ID (ensure non-empty string and unique within the collection)
    let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : null;
    if (!id || seenIds.has(id)) {
      id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }
    seenIds.add(id);

    // Validate Description
    const description = typeof item.description === 'string' ? item.description.trim().substring(0, 2000) : '';

    // Validate Priority
    const priority = typeof item.priority === 'string' && validPriorities.includes(item.priority.toLowerCase().trim())
      ? item.priority.toLowerCase().trim()
      : 'medium';

    // Validate Due Date
    const dueDate = typeof item.dueDate === 'string' ? item.dueDate.trim().substring(0, 50) : '';

    // Validate Completed
    const completed = Boolean(item.completed);

    // Validate CreatedAt
    const createdAt = typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) && item.createdAt > 0
      ? item.createdAt
      : Date.now();

    sanitized.push({
      id,
      title,
      description,
      priority,
      dueDate,
      completed,
      createdAt
    });
  }

  return sanitized;
}

/**
 * Loads tasks from the application user data directory (or specified file path).
 * Falls back to default initial tasks if the file does not exist.
 * Protects against corrupted JSON without crashing.
 */
async function loadTasks(customFilePath = null) {
  const filePath = customFilePath || getStorageFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[Storage] No existing task store found at ${filePath}. Initializing with default seed tasks.`);
      await saveTasks(DEFAULT_TASKS, filePath);
      return { success: true, tasks: DEFAULT_TASKS, isInitialSeed: true };
    }

    const data = await fs.promises.readFile(filePath, 'utf8');
    if (!data.trim()) {
      console.warn('[Storage] Task store is empty. Returning empty task list.');
      return { success: true, tasks: [] };
    }

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (parseErr) {
      console.error('[Storage Error] Malformed JSON in task storage:', parseErr.message);
      // Return safe fallback without overwriting corrupted file
      return {
        success: false,
        error: 'Task data file was corrupted. Loaded emergency backup.',
        tasks: DEFAULT_TASKS
      };
    }

    if (!Array.isArray(parsed)) {
      console.error('[Storage Error] Task storage content is not an array.');
      return {
        success: false,
        error: 'Task data file format is invalid. Loaded emergency backup.',
        tasks: DEFAULT_TASKS
      };
    }

    const validated = validateTasks(parsed);
    console.log(`[Storage] Loaded ${validated.length} tasks from ${filePath}`);
    return { success: true, tasks: validated };
  } catch (err) {
    console.error('[Storage Error] Failed to read tasks file:', err.message);
    return { success: false, error: err.message, tasks: DEFAULT_TASKS };
  }
}

/**
 * Saves tasks to the application user data directory (or specified file path) using atomic write.
 * Writes to a temporary file first, then renames to avoid partial-write corruptions.
 */
async function saveTasks(tasks, customFilePath = null) {
  const filePath = customFilePath || getStorageFilePath();
  const tempPath = `${filePath}.tmp`;

  try {
    const validated = validateTasks(tasks);

    // Ensure target directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Atomic write pattern: write to tmp then rename
    const jsonString = JSON.stringify(validated, null, 2);
    await fs.promises.writeFile(tempPath, jsonString, 'utf8');
    await fs.promises.rename(tempPath, filePath);

    console.log(`[Storage] Successfully persisted ${validated.length} tasks to ${filePath}`);
    return { success: true, count: validated.length };
  } catch (err) {
    console.error('[Storage Error] Failed to save tasks:', err.message);
    // Cleanup temporary file if it was created
    try {
      if (fs.existsSync(tempPath)) {
        await fs.promises.unlink(tempPath);
      }
    } catch (_) {}

    return { success: false, error: err.message };
  }
}

module.exports = {
  loadTasks,
  saveTasks,
  validateTasks,
  getStorageFilePath,
  DEFAULT_TASKS
};
