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
          // Success: window is closed by main process after sync
        } else {
          alert(`Failed to add task: ${result ? result.error : 'Unknown error'}`);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add Task';
        }
      }
    } catch (err) {
      console.error('Failed to submit quick add task:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Task';
    }
  });
});
