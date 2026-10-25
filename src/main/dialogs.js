const { dialog } = require('electron');
const fs = require('fs');
const storage = require('./storage');
const { sendNotification } = require('./notifications');

/**
 * Prompts user to select destination file and exports tasks as structured JSON.
 */
async function exportTasksDialog(browserWindow, customDialog = null) {
  const dlg = customDialog || dialog;
  try {
    const defaultName = `productivity-tasks-${new Date().toISOString().split('T')[0]}.json`;
    const { canceled, filePath } = await dlg.showSaveDialog(browserWindow, {
      title: 'Export Tasks',
      defaultPath: defaultName,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      console.log('[Dialog] Export canceled by user');
      return { success: false, canceled: true };
    }

    const { tasks } = await storage.loadTasks();
    const exportPayload = {
      app: 'Desktop Productivity Manager',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      taskCount: tasks.length,
      tasks
    };

    await fs.promises.writeFile(filePath, JSON.stringify(exportPayload, null, 2), 'utf8');
    console.log(`[Dialog] Successfully exported ${tasks.length} tasks to ${filePath}`);

    sendNotification({
      title: 'Export Complete',
      body: `Successfully exported ${tasks.length} tasks to ${filePath.split('/').pop()}`
    });

    return {
      success: true,
      filePath,
      count: tasks.length
    };
  } catch (err) {
    console.error('[Dialog Error] Export failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Prompts user to choose a JSON file and imports tasks, merging them with existing tasks.
 */
async function importTasksDialog(browserWindow, customDialog = null) {
  const dlg = customDialog || dialog;
  try {
    const { canceled, filePaths } = await dlg.showOpenDialog(browserWindow, {
      title: 'Import Tasks',
      properties: ['openFile'],
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      console.log('[Dialog] Import canceled by user');
      return { success: false, canceled: true };
    }

    const targetPath = filePaths[0];
    const fileContent = await fs.promises.readFile(targetPath, 'utf8');

    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch (parseErr) {
      console.warn('[Dialog Error] Failed to parse imported JSON file:', parseErr.message);
      return { success: false, error: 'The selected file is not valid JSON.' };
    }

    // Extract task array
    const rawTasks = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.tasks) ? parsed.tasks : null);
    if (!rawTasks) {
      return { success: false, error: 'JSON file does not contain a valid tasks array.' };
    }

    const validatedImport = storage.validateTasks(rawTasks);
    if (validatedImport.length === 0) {
      return { success: false, error: 'No valid tasks could be extracted from the file.' };
    }

    // Merge with existing tasks, avoiding duplicate ID collisions
    const currentStore = await storage.loadTasks();
    const existingTasks = currentStore.tasks || [];
    const existingIds = new Set(existingTasks.map(t => t.id));

    const sanitizedImported = validatedImport.map(t => {
      if (existingIds.has(t.id)) {
        return {
          ...t,
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };
      }
      return t;
    });

    const mergedTasks = [...sanitizedImported, ...existingTasks];
    await storage.saveTasks(mergedTasks);

    console.log(`[Dialog] Imported ${sanitizedImported.length} tasks from ${targetPath}. Total tasks now: ${mergedTasks.length}`);

    sendNotification({
      title: 'Import Successful',
      body: `Imported ${sanitizedImported.length} tasks into Productivity Manager.`
    });

    return {
      success: true,
      importedCount: sanitizedImported.length,
      totalCount: mergedTasks.length,
      tasks: mergedTasks
    };
  } catch (err) {
    console.error('[Dialog Error] Import failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  exportTasksDialog,
  importTasksDialog
};
