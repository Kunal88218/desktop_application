// Renderer Process Script: Productivity Dashboard & Task Management Interface
// State resides in renderer memory for Milestone 3

(() => {
  // --- Initial Seed State ---
  let tasks = [
    {
      id: 'task-1',
      title: 'Review Electron Process Security Architecture',
      description: 'Ensure contextIsolation, nodeIntegration: false, and preload sandboxing are verified.',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
      completed: true,
      createdAt: Date.now() - 3600000
    },
    {
      id: 'task-2',
      title: 'Design In-Class Presentation Slides',
      description: 'Highlight IPC request-response pattern and multi-window orchestration.',
      priority: 'medium',
      dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0], // 2 days
      completed: false,
      createdAt: Date.now() - 1800000
    },
    {
      id: 'task-3',
      title: 'Conduct Automated Smoke Testing',
      description: 'Verify application launches headlessly and cleanly on macOS and Windows.',
      priority: 'high',
      dueDate: new Date().toISOString().split('T')[0], // Today
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

  let currentView = 'dashboard';
  let currentFilter = 'all'; // 'all' | 'active' | 'completed'
  let currentPriority = 'all'; // 'all' | 'high' | 'medium' | 'low'
  let searchQuery = '';
  let editingTaskId = null;

  // --- DOM Elements ---
  const taskListEl = document.getElementById('task-list');
  const emptyStateEl = document.getElementById('empty-state');
  const emptyTitleEl = document.getElementById('empty-state-title');
  const emptyDescEl = document.getElementById('empty-state-desc');
  const visibleTasksCountEl = document.getElementById('visible-tasks-count');
  const viewTitleEl = document.getElementById('view-title');
  const dashboardSummaryEl = document.getElementById('dashboard-summary');
  const viewTasksContainer = document.getElementById('view-tasks-container');
  const viewSystemContainer = document.getElementById('view-system-container');

  // Metrics
  const metricTotalEl = document.getElementById('metric-total');
  const metricActiveEl = document.getElementById('metric-active');
  const metricCompletedEl = document.getElementById('metric-completed');
  const metricHighEl = document.getElementById('metric-high');

  // Badges
  const countAllBadge = document.getElementById('count-all-badge');
  const countActiveBadge = document.getElementById('count-active-badge');
  const countCompletedBadge = document.getElementById('count-completed-badge');

  // Search & Filter
  const searchInput = document.getElementById('task-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const prioritySelect = document.getElementById('priority-filter');
  const filterPills = document.querySelectorAll('.filter-pill');

  // Modal & Form
  const modalEl = document.getElementById('task-modal');
  const modalTitleEl = document.getElementById('modal-title');
  const taskForm = document.getElementById('task-form');
  const taskEditIdInput = document.getElementById('task-edit-id');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskDescInput = document.getElementById('task-desc-input');
  const taskPrioritySelect = document.getElementById('task-priority-select');
  const taskDueInput = document.getElementById('task-due-input');
  const titleErrorEl = document.getElementById('title-error');
  const openAddTaskBtn = document.getElementById('open-add-task-btn');
  const emptyAddBtn = document.getElementById('empty-add-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  // --- Helper Functions ---
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'danger') icon = '✕';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  function updateMetricsAndBadges() {
    const total = tasks.length;
    const active = tasks.filter(t => !t.completed).length;
    const completed = tasks.filter(t => t.completed).length;
    const high = tasks.filter(t => !t.completed && t.priority === 'high').length;

    metricTotalEl.textContent = total;
    metricActiveEl.textContent = active;
    metricCompletedEl.textContent = completed;
    metricHighEl.textContent = high;

    countAllBadge.textContent = total;
    countActiveBadge.textContent = active;
    countCompletedBadge.textContent = completed;
  }

  function getFilteredTasks() {
    return tasks.filter(task => {
      // View-level filter
      if (currentView === 'active' && task.completed) return false;
      if (currentView === 'completed' && !task.completed) return false;

      // Status pill filter
      if (currentFilter === 'active' && task.completed) return false;
      if (currentFilter === 'completed' && !task.completed) return false;

      // Priority dropdown filter
      if (currentPriority !== 'all' && task.priority !== currentPriority) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = (task.description || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }

  function renderTasks() {
    updateMetricsAndBadges();

    const filtered = getFilteredTasks();
    visibleTasksCountEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'task' : 'tasks'}`;

    taskListEl.innerHTML = '';

    if (filtered.length === 0) {
      emptyStateEl.style.display = 'block';
      if (searchQuery.trim()) {
        emptyTitleEl.textContent = 'No matching tasks';
        emptyDescEl.textContent = `No tasks matched your search "${searchQuery}".`;
      } else if (currentFilter === 'completed' || currentView === 'completed') {
        emptyTitleEl.textContent = 'No completed tasks yet';
        emptyDescEl.textContent = 'Tasks you mark as done will appear here.';
      } else if (currentFilter === 'active' || currentView === 'active') {
        emptyTitleEl.textContent = 'All caught up!';
        emptyDescEl.textContent = 'You have no active tasks pending.';
      } else {
        emptyTitleEl.textContent = 'No tasks found';
        emptyDescEl.textContent = 'Get started by creating your first task.';
      }
      return;
    }

    emptyStateEl.style.display = 'none';

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'completed' : ''}`;
      card.dataset.id = task.id;

      // Format due date
      let dueDateHtml = '';
      if (task.dueDate) {
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = !task.completed && task.dueDate < today;
        dueDateHtml = `
          <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
            📅 ${task.dueDate} ${isOverdue ? '(Overdue)' : ''}
          </span>
        `;
      }

      card.innerHTML = `
        <div class="task-checkbox-wrapper">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} title="Toggle completion">
        </div>
        <div class="task-main">
          <div class="task-header">
            <span class="task-title">${escapeHTML(task.title)}</span>
            <span class="priority-badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
          </div>
          ${task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : ''}
          <div class="task-footer">
            ${dueDateHtml}
            <span>Created ${new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="action-btn edit-btn" title="Edit task">✏️</button>
          <button class="action-btn delete-btn" title="Delete task">🗑️</button>
        </div>
      `;

      // Event Listeners for Card
      const checkbox = card.querySelector('.task-checkbox');
      checkbox.addEventListener('change', () => toggleTaskComplete(task.id));

      const editBtn = card.querySelector('.edit-btn');
      editBtn.addEventListener('click', () => openEditModal(task.id));

      const deleteBtn = card.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => deleteTask(task.id));

      taskListEl.appendChild(card);
    });
  }

  // --- CRUD Operations ---
  function addTask(title, description, priority, dueDate) {
    const newTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      completed: false,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    renderTasks();
    showToast(`Task created: "${newTask.title}"`, 'success');
  }

  function updateTask(id, title, description, priority, dueDate) {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    tasks[index] = {
      ...tasks[index],
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate
    };

    renderTasks();
    showToast('Task updated successfully', 'success');
  }

  function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    renderTasks();
    showToast(
      task.completed ? `Completed: "${task.title}"` : `Marked active: "${task.title}"`,
      task.completed ? 'success' : 'info'
    );
  }

  function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    showToast(`Deleted: "${task.title}"`, 'danger');
  }

  // --- Modal Management ---
  function openAddModal() {
    editingTaskId = null;
    modalTitleEl.textContent = 'New Task';
    taskEditIdInput.value = '';
    taskTitleInput.value = '';
    taskDescInput.value = '';
    taskPrioritySelect.value = 'medium';
    taskDueInput.value = '';
    titleErrorEl.style.display = 'none';

    modalEl.style.display = 'flex';
    setTimeout(() => taskTitleInput.focus(), 50);
  }

  function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    modalTitleEl.textContent = 'Edit Task';
    taskEditIdInput.value = task.id;
    taskTitleInput.value = task.title;
    taskDescInput.value = task.description || '';
    taskPrioritySelect.value = task.priority || 'medium';
    taskDueInput.value = task.dueDate || '';
    titleErrorEl.style.display = 'none';

    modalEl.style.display = 'flex';
    setTimeout(() => taskTitleInput.focus(), 50);
  }

  function closeModal() {
    modalEl.style.display = 'none';
    editingTaskId = null;
    titleErrorEl.style.display = 'none';
  }

  // --- Navigation & View Switching ---
  function setView(viewName) {
    currentView = viewName;

    // Update active class on nav items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'system') {
      viewTasksContainer.style.display = 'none';
      viewSystemContainer.style.display = 'block';
      return;
    }

    viewSystemContainer.style.display = 'none';
    viewTasksContainer.style.display = 'block';

    // Show or hide welcome metrics banner
    if (viewName === 'dashboard') {
      dashboardSummaryEl.style.display = 'block';
      viewTitleEl.textContent = 'Dashboard Tasks';
    } else {
      dashboardSummaryEl.style.display = 'none';
      if (viewName === 'all') viewTitleEl.textContent = 'All Tasks';
      if (viewName === 'active') viewTitleEl.textContent = 'Active Tasks';
      if (viewName === 'completed') viewTitleEl.textContent = 'Completed Tasks';
    }

    // Sync filter pills to match view
    filterPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.filter === (viewName === 'dashboard' ? 'all' : viewName));
    });
    currentFilter = viewName === 'dashboard' ? 'all' : viewName;

    renderTasks();
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Sidebar Navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        setView(btn.dataset.view);
      });
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      renderTasks();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderTasks();
      searchInput.focus();
    });

    // Filter Pills
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.dataset.filter;
        renderTasks();
      });
    });

    // Priority Filter
    prioritySelect.addEventListener('change', (e) => {
      currentPriority = e.target.value;
      renderTasks();
    });

    // Add Task Triggers
    openAddTaskBtn.addEventListener('click', openAddModal);
    emptyAddBtn.addEventListener('click', openAddModal);

    // Modal Close
    modalCloseBtn.addEventListener('click', closeModal);
    modalCancelBtn.addEventListener('click', closeModal);

    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.style.display === 'flex') {
        closeModal();
      }
    });

    // Form Submit
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = taskTitleInput.value.trim();
      const description = taskDescInput.value.trim();
      const priority = taskPrioritySelect.value;
      const dueDate = taskDueInput.value;

      if (!title) {
        titleErrorEl.style.display = 'block';
        taskTitleInput.focus();
        return;
      }

      if (editingTaskId) {
        updateTask(editingTaskId, title, description, priority, dueDate);
      } else {
        addTask(title, description, priority, dueDate);
      }

      closeModal();
    });
  }

  // --- Preload Bridge / System Architecture Info ---
  async function loadSystemArchitectureDiagnostics() {
    const appNameEl = document.getElementById('app-name');
    const appVersionEl = document.getElementById('app-version');
    const platformNameEl = document.getElementById('platform-name');
    const electronVersionEl = document.getElementById('electron-version');
    const nodeVersionEl = document.getElementById('node-version');
    const statusEl = document.getElementById('connection-status');
    const badgeIsolation = document.getElementById('badge-isolation');
    const badgeNode = document.getElementById('badge-node');
    const badgeSandbox = document.getElementById('badge-sandbox');

    try {
      if (window.electronAPI && typeof window.electronAPI.getAppInfo === 'function') {
        const info = await window.electronAPI.getAppInfo();
        if (appNameEl) appNameEl.textContent = info.name;
        if (appVersionEl) appVersionEl.textContent = `v${info.version}`;
        if (platformNameEl) platformNameEl.textContent = `${info.platform} (${info.arch || 'unknown'})`;
        if (electronVersionEl) electronVersionEl.textContent = `v${info.electronVersion}`;
        if (nodeVersionEl) nodeVersionEl.textContent = `v${info.nodeVersion}`;
        if (statusEl) statusEl.textContent = 'Bridge Connected';

        if (window.electronAPI.securityStatus) {
          if (badgeIsolation) badgeIsolation.textContent = window.electronAPI.securityStatus.contextIsolation ? 'Enabled' : 'Disabled';
          if (badgeNode) badgeNode.textContent = window.electronAPI.securityStatus.nodeIntegration ? 'Enabled' : 'Disabled';
          if (badgeSandbox) badgeSandbox.textContent = window.electronAPI.securityStatus.sandbox ? 'Enabled' : 'Disabled';
        }
      } else {
        if (statusEl) statusEl.textContent = 'Standalone Mode';
      }
    } catch (err) {
      console.error('Preload diagnostic error:', err);
      if (statusEl) statusEl.textContent = 'Bridge Error';
    }
  }

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    renderTasks();
    loadSystemArchitectureDiagnostics();
  });
})();
