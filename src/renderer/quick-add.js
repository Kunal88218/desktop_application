// Quick-Add Window Renderer Script
// Uses secure preload APIs to create tasks, trigger notification, and sync to main window

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('quick-add-form');
  const titleInput = document.getElementById('quick-title');
  const descInput = document.getElementById('quick-desc');
  const prioritySelect = document.getElementById('quick-priority');
  const dueInput = document.getElementById('quick-due');
  const errorEl = document.getElementById('quick-title-error');
  const cancelBtn = document.getElementById('quick-cancel-btn');
  const submitBtn = document.getElementById('quick-submit-btn');
  const toastContainer = document.getElementById('toast-container');

  function sanitizeError(rawError, fallback = 'Unable to create task.') {
    if (!rawError) return fallback;
    const str = (typeof rawError === 'string' ? rawError : (rawError.message || String(rawError))).trim();
    let cleaned = str.replace(/(?:\/[a-zA-Z0-9._-]+)+/g, '[file]');
    cleaned = cleaned.replace(/[a-zA-Z]:\\[a-zA-Z0-9._\-\\]+/g, '[file]');
    cleaned = cleaned.replace(/^[A-Z0-9_]+:\s*/i, '');
    cleaned = cleaned.split('\n')[0].trim();
    return cleaned || fallback;
  }

  function showQuickToast(message, type = 'danger') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // Close window on Cancel button
  cancelBtn.addEventListener('click', () => {
    if (window.electronAPI && typeof window.electronAPI.closeCurrentWindow === 'function') {
      window.electronAPI.closeCurrentWindow();
    } else {
      window.close();
    }
  });

  // Close window on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (window.electronAPI && typeof window.electronAPI.closeCurrentWindow === 'function') {
        window.electronAPI.closeCurrentWindow();
      } else {
        window.close();
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const priority = prioritySelect.value;
    const dueDate = dueInput.value;

    if (!title) {
      errorEl.style.display = 'block';
      titleInput.focus();
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      if (window.electronAPI && typeof window.electronAPI.quickAddTask === 'function') {
        const result = await window.electronAPI.quickAddTask({
          title,
          description,
          priority,
          dueDate
        });

        if (result && result.success) {
          // Window is closed by main process after sync
        } else {
          const userMsg = sanitizeError(result ? result.error : null, 'Could not create task.');
          showQuickToast(userMsg, 'danger');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add Task';
        }
      } else {
        showQuickToast('Electron desktop integration unavailable', 'danger');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Task';
      }
    } catch (err) {
      console.error('Failed to submit quick add task:', err);
      showQuickToast(sanitizeError(err, 'Failed to add task.'), 'danger');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Task';
    }
  });
});
