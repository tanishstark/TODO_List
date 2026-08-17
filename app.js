/**
 * ZenTask - Modern Todo List & Productivity Manager
 * ES6+ Vanilla JavaScript Architecture
 */

(function () {
  'use strict';

  // ==========================================================================
  // Storage & State Services
  // ==========================================================================
  const STORAGE_KEYS = {
    TASKS: 'zentask_tasks_v1',
    CATEGORIES: 'zentask_categories_v1',
    SETTINGS: 'zentask_settings_v1'
  };

  const DEFAULT_CATEGORIES = [
    { id: 'work', name: 'Work', color: '#6366f1' },
    { id: 'personal', name: 'Personal', color: '#ec4899' },
    { id: 'study', name: 'Study', color: '#8b5cf6' },
    { id: 'fitness', name: 'Fitness', color: '#10b981' },
    { id: 'ideas', name: 'Ideas', color: '#f59e0b' }
  ];

  const DEFAULT_TASKS = [
    {
      id: 'task_welcome_1',
      title: 'Welcome to ZenTask! 👋 Complete this task',
      notes: 'Click the checkbox on the left to mark tasks as completed. Notice the celebration effect!',
      category: 'personal',
      priority: 'high',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      completed: false,
      starred: true,
      subtasks: [
        { id: 'sub_1', text: 'Test light/dark theme toggle in top right', completed: true },
        { id: 'sub_2', text: 'Try setting a 4-digit PIN lock in Settings', completed: false }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'task_welcome_2',
      title: 'Explore Categories and Priorities',
      notes: 'Group your tasks by category (Work, Personal, Fitness) and set priority levels to keep your workflow streamlined.',
      category: 'work',
      priority: 'medium',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      completed: false,
      starred: false,
      subtasks: [],
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'task_welcome_3',
      title: 'Deploy to Vercel in 1-Click 🚀',
      notes: 'ZenTask is 100% static and zero-config ready for Vercel hosting. Check out README.md for instructions!',
      category: 'ideas',
      priority: 'high',
      dueDate: '',
      completed: true,
      starred: true,
      subtasks: [],
      createdAt: new Date(Date.now() - 7200000).toISOString()
    }
  ];

  class StateStore {
    constructor() {
      this.tasks = this.load(STORAGE_KEYS.TASKS, DEFAULT_TASKS);
      this.categories = this.load(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
      this.settings = this.load(STORAGE_KEYS.SETTINGS, {
        theme: 'dark',
        soundEnabled: true,
        pinCode: null,
        isLocked: false
      });

      this.activeCategory = 'all';
      this.activeStatus = 'all';
      this.activePriority = 'all';
      this.searchQuery = '';
      this.sortBy = 'created-desc';
      this.pinBuffer = '';
      this.tempSubtasks = [];
      this.recentlyDeleted = null;
    }

    load(key, fallback) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      } catch (e) {
        console.warn(`Error reading localStorage for ${key}`, e);
        return fallback;
      }
    }

    saveTasks() {
      try {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(this.tasks));
      } catch (e) {
        console.error('Error saving tasks', e);
      }
    }

    saveCategories() {
      try {
        localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(this.categories));
      } catch (e) {
        console.error('Error saving categories', e);
      }
    }

    saveSettings() {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      } catch (e) {
        console.error('Error saving settings', e);
      }
    }
  }

  const store = new StateStore();

  // ==========================================================================
  // Audio & Micro-Effects
  // ==========================================================================
  class AudioFx {
    static playSuccess() {
      if (!store.settings.soundEnabled) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {
        // Ignore audio errors silently
      }
    }

    static spawnConfetti(originX, originY) {
      const count = 28;
      const colors = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#38bdf8'];

      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 6 + 5;
        const angle = Math.random() * 2 * Math.PI;
        const velocity = Math.random() * 85 + 40;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity - 20;

        Object.assign(particle.style, {
          position: 'fixed',
          left: `${originX}px`,
          top: `${originY}px`,
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          pointerEvents: 'none',
          zIndex: '9999',
          transform: 'translate(-50%, -50%)',
          transition: 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1), opacity 600ms ease'
        });

        document.body.appendChild(particle);

        requestAnimationFrame(() => {
          particle.style.transform = `translate(${vx}px, ${vy + 80}px) rotate(${Math.random() * 360}deg)`;
          particle.style.opacity = '0';
        });

        setTimeout(() => particle.remove(), 650);
      }
    }
  }

  // ==========================================================================
  // DOM Element Selectors
  // ==========================================================================
  const DOM = {
    // Overlays & Layout
    pinLockOverlay: document.getElementById('pinLockOverlay'),
    pinDots: document.querySelectorAll('#pinDots .dot'),
    pinKeypad: document.getElementById('pinKeypad'),
    pinErrorMsg: document.getElementById('pinErrorMsg'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    lockAppBtn: document.getElementById('lockAppBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    openAddModalBtn: document.getElementById('openAddModalBtn'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),

    // Dashboard Stats
    statTotal: document.getElementById('statTotal'),
    statPending: document.getElementById('statPending'),
    statCompleted: document.getElementById('statCompleted'),
    statPercent: document.getElementById('statPercent'),
    progressBarFill: document.getElementById('progressBarFill'),

    // Filter & Search Controls
    categoriesPillContainer: document.getElementById('categoriesPillContainer'),
    openManageCategoriesBtn: document.getElementById('openManageCategoriesBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    statusTabs: document.querySelectorAll('.status-tab-group .tab-btn'),
    priorityFilterSelect: document.getElementById('priorityFilterSelect'),
    sortBySelect: document.getElementById('sortBySelect'),

    // Task List
    taskListContainer: document.getElementById('taskListContainer'),
    emptyState: document.getElementById('emptyState'),

    // Task Modal
    taskModal: document.getElementById('taskModal'),
    taskModalTitle: document.getElementById('taskModalTitle'),
    taskForm: document.getElementById('taskForm'),
    taskIdInput: document.getElementById('taskIdInput'),
    taskTitleInput: document.getElementById('taskTitleInput'),
    taskDescInput: document.getElementById('taskDescInput'),
    taskCategorySelect: document.getElementById('taskCategorySelect'),
    taskPrioritySelect: document.getElementById('taskPrioritySelect'),
    taskDueDateInput: document.getElementById('taskDueDateInput'),
    subtaskItemInput: document.getElementById('subtaskItemInput'),
    addSubtaskBtn: document.getElementById('addSubtaskBtn'),
    subtaskListPreview: document.getElementById('subtaskListPreview'),
    closeTaskModalBtn: document.getElementById('closeTaskModalBtn'),
    cancelTaskModalBtn: document.getElementById('cancelTaskModalBtn'),

    // Category Modal
    categoryModal: document.getElementById('categoryModal'),
    newCategoryForm: document.getElementById('newCategoryForm'),
    newCatNameInput: document.getElementById('newCatNameInput'),
    newCatColorInput: document.getElementById('newCatColorInput'),
    categoryListContainer: document.getElementById('categoryListContainer'),
    closeCategoryModalBtn: document.getElementById('closeCategoryModalBtn'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
    pinStatusBadge: document.getElementById('pinStatusBadge'),
    pinSetupSection: document.getElementById('pinSetupSection'),
    pinActiveSection: document.getElementById('pinActiveSection'),
    newPinInput: document.getElementById('newPinInput'),
    savePinBtn: document.getElementById('savePinBtn'),
    currentPinInput: document.getElementById('currentPinInput'),
    removePinBtn: document.getElementById('removePinBtn'),
    soundToggle: document.getElementById('soundToggle'),

    // Footer & Import/Export
    exportDataBtn: document.getElementById('exportDataBtn'),
    importDataBtn: document.getElementById('importDataBtn'),
    importFileInput: document.getElementById('importFileInput'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================================================
  // Helper & Modal Utilities (with Modern Web Guidance Fallback)
  // ==========================================================================
  function setupDialogBackdropLightDismiss(dialog) {
    if (!dialog) return;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        dialog.close();
      });
    }
  }

  function showModalSafely(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeModalSafely(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function showToast(message, actionLabel = null, onAction = null) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (actionLabel && typeof onAction === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'toast-btn';
      actionBtn.textContent = actionLabel;
      actionBtn.addEventListener('click', () => {
        onAction();
        toast.remove();
      });
      toast.appendChild(actionBtn);
    }

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
      }
    }, 4000);
  }

  function formatDisplayDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isOverdue = date < now;

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (isToday) dateStr = 'Today';

    return {
      text: `${dateStr}, ${timeStr}`,
      isOverdue: isOverdue && !isToday
    };
  }

  // ==========================================================================
  // PIN & Security Controller
  // ==========================================================================
  class AuthController {
    static init() {
      // Check if locked
      if (store.settings.pinCode && store.settings.isLocked) {
        AuthController.showLockScreen();
      } else {
        DOM.pinLockOverlay.classList.add('hidden');
      }

      AuthController.updateSettingsUI();
      AuthController.bindEvents();
    }

    static showLockScreen() {
      store.pinBuffer = '';
      AuthController.updatePinDots();
      DOM.pinErrorMsg.textContent = '';
      DOM.pinLockOverlay.classList.remove('hidden');
    }

    static unlockApp() {
      store.settings.isLocked = false;
      store.saveSettings();
      DOM.pinLockOverlay.classList.add('hidden');
      store.pinBuffer = '';
      AuthController.updatePinDots();
      showToast('Welcome back! App unlocked.');
    }

    static lockApp() {
      if (!store.settings.pinCode) {
        showToast('Please set a PIN in Settings first.');
        DOM.openSettingsBtn.click();
        return;
      }
      store.settings.isLocked = true;
      store.saveSettings();
      AuthController.showLockScreen();
    }

    static updatePinDots() {
      DOM.pinDots.forEach((dot, index) => {
        if (index < store.pinBuffer.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      });
    }

    static handleDigit(digit) {
      if (store.pinBuffer.length >= 4) return;
      store.pinBuffer += digit;
      AuthController.updatePinDots();

      if (store.pinBuffer.length === 4) {
        setTimeout(AuthController.verifyPin, 120);
      }
    }

    static handleBackspace() {
      if (store.pinBuffer.length > 0) {
        store.pinBuffer = store.pinBuffer.slice(0, -1);
        AuthController.updatePinDots();
        DOM.pinErrorMsg.textContent = '';
      }
    }

    static handleClear() {
      store.pinBuffer = '';
      AuthController.updatePinDots();
      DOM.pinErrorMsg.textContent = '';
    }

    static verifyPin() {
      if (store.pinBuffer === store.settings.pinCode) {
        AuthController.unlockApp();
      } else {
        DOM.pinErrorMsg.textContent = 'Incorrect PIN. Try again.';
        const pinCard = document.querySelector('.pin-card');
        pinCard.classList.add('shake');
        setTimeout(() => {
          pinCard.classList.remove('shake');
          AuthController.handleClear();
        }, 450);
      }
    }

    static updateSettingsUI() {
      const hasPin = Boolean(store.settings.pinCode);
      if (hasPin) {
        DOM.pinStatusBadge.textContent = 'Active (4-Digit PIN)';
        DOM.pinStatusBadge.className = 'status-badge badge-enabled';
        DOM.pinSetupSection.classList.add('hidden');
        DOM.pinActiveSection.classList.remove('hidden');
      } else {
        DOM.pinStatusBadge.textContent = 'Disabled';
        DOM.pinStatusBadge.className = 'status-badge badge-disabled';
        DOM.pinSetupSection.classList.remove('hidden');
        DOM.pinActiveSection.classList.add('hidden');
      }
      DOM.soundToggle.checked = store.settings.soundEnabled;
    }

    static bindEvents() {
      // Keypad buttons
      DOM.pinKeypad.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        const key = btn.dataset.key;
        const action = btn.dataset.action;

        if (key !== undefined) {
          AuthController.handleDigit(key);
        } else if (action === 'backspace') {
          AuthController.handleBackspace();
        } else if (action === 'clear') {
          AuthController.handleClear();
        }
      });

      // Physical Keyboard Listener for PIN screen
      window.addEventListener('keydown', (e) => {
        if (!DOM.pinLockOverlay.classList.contains('hidden')) {
          if (e.key >= '0' && e.key <= '9') {
            AuthController.handleDigit(e.key);
          } else if (e.key === 'Backspace') {
            AuthController.handleBackspace();
          } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
            AuthController.handleClear();
          }
        }
      });

      // Quick Lock Button & Shortcut
      DOM.lockAppBtn.addEventListener('click', AuthController.lockApp);

      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
          e.preventDefault();
          AuthController.lockApp();
        }
      });

      // Enable PIN in Settings
      DOM.savePinBtn.addEventListener('click', () => {
        const pin = DOM.newPinInput.value.trim();
        if (/^\d{4}$/.test(pin)) {
          store.settings.pinCode = pin;
          store.saveSettings();
          DOM.newPinInput.value = '';
          AuthController.updateSettingsUI();
          showToast('PIN lock enabled successfully!');
        } else {
          showToast('PIN must be exactly 4 digits.');
        }
      });

      // Disable PIN in Settings
      DOM.removePinBtn.addEventListener('click', () => {
        const entered = DOM.currentPinInput.value.trim();
        if (entered === store.settings.pinCode) {
          store.settings.pinCode = null;
          store.settings.isLocked = false;
          store.saveSettings();
          DOM.currentPinInput.value = '';
          AuthController.updateSettingsUI();
          showToast('PIN lock has been disabled.');
        } else {
          showToast('Incorrect PIN. Cannot disable.');
        }
      });
    }
  }

  // ==========================================================================
  // Task & Category Management Controller
  // ==========================================================================
  class TaskController {
    static init() {
      TaskController.renderCategories();
      TaskController.renderCategorySelectOptions();
      TaskController.renderTasks();
      TaskController.updateStats();
      TaskController.bindEvents();
    }

    static renderCategories() {
      DOM.categoriesPillContainer.innerHTML = '';

      // "All" Pill
      const allPill = document.createElement('button');
      allPill.type = 'button';
      allPill.className = `cat-pill ${store.activeCategory === 'all' ? 'active' : ''}`;
      allPill.dataset.catId = 'all';
      allPill.textContent = 'All Tasks';
      DOM.categoriesPillContainer.appendChild(allPill);

      // Specific Category Pills
      store.categories.forEach((cat) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `cat-pill ${store.activeCategory === cat.id ? 'active' : ''}`;
        pill.dataset.catId = cat.id;

        const dot = document.createElement('span');
        dot.className = 'cat-dot';
        dot.style.backgroundColor = cat.color;

        pill.appendChild(dot);
        pill.appendChild(document.createTextNode(cat.name));
        DOM.categoriesPillContainer.appendChild(pill);
      });

      // Category list inside Manage Categories Modal
      DOM.categoryListContainer.innerHTML = '';
      store.categories.forEach((cat) => {
        const item = document.createElement('div');
        item.className = 'custom-cat-item';

        const badgeWrap = document.createElement('div');
        badgeWrap.className = 'cat-item-badge';
        const dot = document.createElement('span');
        dot.className = 'cat-dot';
        dot.style.backgroundColor = cat.color;
        badgeWrap.appendChild(dot);
        badgeWrap.appendChild(document.createTextNode(cat.name));

        item.appendChild(badgeWrap);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-task-action delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete category';
        deleteBtn.addEventListener('click', () => TaskController.deleteCategory(cat.id));

        item.appendChild(deleteBtn);
        DOM.categoryListContainer.appendChild(item);
      });
    }

    static renderCategorySelectOptions() {
      DOM.taskCategorySelect.innerHTML = '';
      store.categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        DOM.taskCategorySelect.appendChild(opt);
      });
    }

    static deleteCategory(catId) {
      if (store.categories.length <= 1) {
        showToast('You must keep at least one category.');
        return;
      }
      store.categories = store.categories.filter((c) => c.id !== catId);
      store.saveCategories();
      if (store.activeCategory === catId) store.activeCategory = 'all';
      TaskController.renderCategories();
      TaskController.renderCategorySelectOptions();
      TaskController.renderTasks();
      showToast('Category deleted.');
    }

    static getFilteredAndSortedTasks() {
      let filtered = [...store.tasks];

      // 1. Search Query
      if (store.searchQuery) {
        const q = store.searchQuery.toLowerCase();
        filtered = filtered.filter((t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (t.subtasks && t.subtasks.some((s) => s.text.toLowerCase().includes(q)))
        );
      }

      // 2. Category Filter
      if (store.activeCategory !== 'all') {
        filtered = filtered.filter((t) => t.category === store.activeCategory);
      }

      // 3. Status Filter
      if (store.activeStatus === 'active') {
        filtered = filtered.filter((t) => !t.completed);
      } else if (store.activeStatus === 'completed') {
        filtered = filtered.filter((t) => t.completed);
      } else if (store.activeStatus === 'starred') {
        filtered = filtered.filter((t) => t.starred);
      }

      // 4. Priority Filter
      if (store.activePriority !== 'all') {
        filtered = filtered.filter((t) => t.priority === store.activePriority);
      }

      // 5. Sorting
      filtered.sort((a, b) => {
        if (store.sortBy === 'created-desc') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        if (store.sortBy === 'due-asc') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (store.sortBy === 'priority-desc') {
          const priorityWeights = { high: 3, medium: 2, low: 1 };
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        }
        if (store.sortBy === 'alpha-asc') {
          return a.title.localeCompare(b.title);
        }
        return 0;
      });

      return filtered;
    }

    static renderTasks() {
      const tasks = TaskController.getFilteredAndSortedTasks();
      DOM.taskListContainer.innerHTML = '';

      if (tasks.length === 0) {
        DOM.emptyState.classList.remove('hidden');
      } else {
        DOM.emptyState.classList.add('hidden');
        tasks.forEach((task) => {
          const card = TaskController.createTaskCardElement(task);
          DOM.taskListContainer.appendChild(card);
        });
      }
    }

    static createTaskCardElement(task) {
      const card = document.createElement('article');
      card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
      card.dataset.taskId = task.id;

      // Category object lookup
      const catObj = store.categories.find((c) => c.id === task.category) || { name: task.category, color: '#6366f1' };
      const dueInfo = formatDisplayDate(task.dueDate);

      // Main Row
      const mainRow = document.createElement('div');
      mainRow.className = 'task-main-row';

      // Checkbox
      const checkWrap = document.createElement('label');
      checkWrap.className = 'task-checkbox-wrap';
      checkWrap.setAttribute('aria-label', `Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`);
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-checkbox';
      checkbox.checked = task.completed;
      checkbox.addEventListener('change', (e) => {
        TaskController.toggleTaskComplete(task.id, e.target.checked, e);
      });
      checkWrap.appendChild(checkbox);
      mainRow.appendChild(checkWrap);

      // Content Column
      const content = document.createElement('div');
      content.className = 'task-content';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'task-title-wrap';

      const title = document.createElement('h3');
      title.className = 'task-title';
      title.textContent = task.title;
      titleWrap.appendChild(title);
      content.appendChild(titleWrap);

      if (task.notes) {
        const notes = document.createElement('p');
        notes.className = 'task-notes';
        notes.textContent = task.notes;
        content.appendChild(notes);
      }

      // Meta row
      const metaRow = document.createElement('div');
      metaRow.className = 'task-meta-row';

      // Category badge
      const catBadge = document.createElement('span');
      catBadge.className = 'badge badge-cat';
      catBadge.style.color = catObj.color;
      catBadge.style.borderColor = `${catObj.color}40`;
      catBadge.style.backgroundColor = `${catObj.color}15`;
      catBadge.textContent = catObj.name;
      metaRow.appendChild(catBadge);

      // Priority badge
      const priorityBadge = document.createElement('span');
      priorityBadge.className = `badge badge-priority-${task.priority}`;
      priorityBadge.textContent = task.priority;
      metaRow.appendChild(priorityBadge);

      // Due date badge
      if (dueInfo) {
        const dueBadge = document.createElement('span');
        dueBadge.className = `badge badge-due ${dueInfo.isOverdue && !task.completed ? 'overdue' : ''}`;
        dueBadge.innerHTML = `⏰ ${dueInfo.text}`;
        metaRow.appendChild(dueBadge);
      }

      content.appendChild(metaRow);
      mainRow.appendChild(content);

      // Task Action Buttons
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      // Star Button
      const starBtn = document.createElement('button');
      starBtn.type = 'button';
      starBtn.className = `btn-task-action ${task.starred ? 'starred' : ''}`;
      starBtn.title = task.starred ? 'Unstar task' : 'Star task';
      starBtn.innerHTML = task.starred ? '★' : '☆';
      starBtn.addEventListener('click', () => TaskController.toggleStarTask(task.id));
      actions.appendChild(starBtn);

      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-task-action';
      editBtn.title = 'Edit task';
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      `;
      editBtn.addEventListener('click', () => TaskController.openEditModal(task.id));
      actions.appendChild(editBtn);

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-task-action delete';
      deleteBtn.title = 'Delete task';
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener('click', () => TaskController.deleteTask(task.id));
      actions.appendChild(deleteBtn);

      mainRow.appendChild(actions);
      card.appendChild(mainRow);

      // Subtasks section (if any)
      if (task.subtasks && task.subtasks.length > 0) {
        const subtasksSection = document.createElement('div');
        subtasksSection.className = 'task-subtasks-section';

        const completedSubCount = task.subtasks.filter((s) => s.completed).length;
        const summary = document.createElement('div');
        summary.className = 'subtask-summary';
        summary.textContent = `Checklist (${completedSubCount}/${task.subtasks.length})`;
        subtasksSection.appendChild(summary);

        task.subtasks.forEach((sub) => {
          const subRow = document.createElement('div');
          subRow.className = `subtask-item-row ${sub.completed ? 'done' : ''}`;

          const subCheck = document.createElement('input');
          subCheck.type = 'checkbox';
          subCheck.className = 'task-checkbox';
          subCheck.checked = sub.completed;
          subCheck.addEventListener('change', () => {
            TaskController.toggleSubtask(task.id, sub.id);
          });

          const subText = document.createElement('span');
          subText.textContent = sub.text;

          subRow.appendChild(subCheck);
          subRow.appendChild(subText);
          subtasksSection.appendChild(subRow);
        });

        card.appendChild(subtasksSection);
      }

      return card;
    }

    static toggleTaskComplete(taskId, isCompleted, event) {
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) return;

      task.completed = isCompleted;
      store.saveTasks();

      if (isCompleted) {
        AudioFx.playSuccess();
        if (event && event.clientX && event.clientY) {
          AudioFx.spawnConfetti(event.clientX, event.clientY);
        }
      }

      TaskController.renderTasks();
      TaskController.updateStats();
    }

    static toggleStarTask(taskId) {
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) return;
      task.starred = !task.starred;
      store.saveTasks();
      TaskController.renderTasks();
    }

    static toggleSubtask(taskId, subtaskId) {
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task || !task.subtasks) return;
      const sub = task.subtasks.find((s) => s.id === subtaskId);
      if (!sub) return;

      sub.completed = !sub.completed;
      
      // Auto-complete parent task if all subtasks are done
      if (task.subtasks.every((s) => s.completed)) {
        task.completed = true;
        AudioFx.playSuccess();
      }

      store.saveTasks();
      TaskController.renderTasks();
      TaskController.updateStats();
    }

    static deleteTask(taskId) {
      const idx = store.tasks.findIndex((t) => t.id === taskId);
      if (idx === -1) return;

      store.recentlyDeleted = {
        task: { ...store.tasks[idx] },
        index: idx
      };

      store.tasks.splice(idx, 1);
      store.saveTasks();
      TaskController.renderTasks();
      TaskController.updateStats();

      showToast('Task deleted.', 'Undo', () => {
        if (store.recentlyDeleted) {
          store.tasks.splice(store.recentlyDeleted.index, 0, store.recentlyDeleted.task);
          store.saveTasks();
          TaskController.renderTasks();
          TaskController.updateStats();
          store.recentlyDeleted = null;
          showToast('Task restored.');
        }
      });
    }

    static openCreateModal() {
      DOM.taskIdInput.value = '';
      DOM.taskModalTitle.textContent = 'New Task';
      DOM.taskTitleInput.value = '';
      DOM.taskDescInput.value = '';
      DOM.taskCategorySelect.value = store.categories[0]?.id || 'work';
      DOM.taskPrioritySelect.value = 'medium';
      DOM.taskDueDateInput.value = '';
      store.tempSubtasks = [];
      TaskController.renderSubtaskPreviewList();
      showModalSafely(DOM.taskModal);
      DOM.taskTitleInput.focus();
    }

    static openEditModal(taskId) {
      const task = store.tasks.find((t) => t.id === taskId);
      if (!task) return;

      DOM.taskIdInput.value = task.id;
      DOM.taskModalTitle.textContent = 'Edit Task';
      DOM.taskTitleInput.value = task.title;
      DOM.taskDescInput.value = task.notes || '';
      DOM.taskCategorySelect.value = task.category;
      DOM.taskPrioritySelect.value = task.priority;
      DOM.taskDueDateInput.value = task.dueDate || '';
      store.tempSubtasks = (task.subtasks || []).map((s) => ({ ...s }));
      TaskController.renderSubtaskPreviewList();

      showModalSafely(DOM.taskModal);
      DOM.taskTitleInput.focus();
    }

    static renderSubtaskPreviewList() {
      DOM.subtaskListPreview.innerHTML = '';
      store.tempSubtasks.forEach((sub, idx) => {
        const li = document.createElement('li');
        li.className = 'subtask-preview-item';

        const span = document.createElement('span');
        span.textContent = sub.text;
        li.appendChild(span);

        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'btn-remove-subtask';
        rmBtn.innerHTML = '&times;';
        rmBtn.title = 'Remove subtask';
        rmBtn.addEventListener('click', () => {
          store.tempSubtasks.splice(idx, 1);
          TaskController.renderSubtaskPreviewList();
        });
        li.appendChild(rmBtn);

        DOM.subtaskListPreview.appendChild(li);
      });
    }

    static updateStats() {
      const total = store.tasks.length;
      const completed = store.tasks.filter((t) => t.completed).length;
      const pending = total - completed;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      DOM.statTotal.textContent = total;
      DOM.statCompleted.textContent = completed;
      DOM.statPending.textContent = pending;
      DOM.statPercent.textContent = `${percent}%`;
      DOM.progressBarFill.style.width = `${percent}%`;
    }

    static bindEvents() {
      // Create Task Button triggers
      DOM.openAddModalBtn.addEventListener('click', TaskController.openCreateModal);
      DOM.emptyAddBtn.addEventListener('click', TaskController.openCreateModal);

      // Close Task Modal
      DOM.closeTaskModalBtn.addEventListener('click', () => closeModalSafely(DOM.taskModal));
      DOM.cancelTaskModalBtn.addEventListener('click', () => closeModalSafely(DOM.taskModal));

      // Add Subtask button in Modal
      const handleAddSubtask = () => {
        const val = DOM.subtaskItemInput.value.trim();
        if (val) {
          store.tempSubtasks.push({
            id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            text: val,
            completed: false
          });
          DOM.subtaskItemInput.value = '';
          TaskController.renderSubtaskPreviewList();
        }
      };

      DOM.addSubtaskBtn.addEventListener('click', handleAddSubtask);
      DOM.subtaskItemInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddSubtask();
        }
      });

      // Submit Task Form
      DOM.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = DOM.taskTitleInput.value.trim();
        if (!title) return;

        const editId = DOM.taskIdInput.value;
        if (editId) {
          // Edit existing
          const task = store.tasks.find((t) => t.id === editId);
          if (task) {
            task.title = title;
            task.notes = DOM.taskDescInput.value.trim();
            task.category = DOM.taskCategorySelect.value;
            task.priority = DOM.taskPrioritySelect.value;
            task.dueDate = DOM.taskDueDateInput.value;
            task.subtasks = store.tempSubtasks;
            store.saveTasks();
            showToast('Task updated.');
          }
        } else {
          // Create new
          const newTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: title,
            notes: DOM.taskDescInput.value.trim(),
            category: DOM.taskCategorySelect.value,
            priority: DOM.taskPrioritySelect.value,
            dueDate: DOM.taskDueDateInput.value,
            completed: false,
            starred: false,
            subtasks: store.tempSubtasks,
            createdAt: new Date().toISOString()
          };
          store.tasks.unshift(newTask);
          store.saveTasks();
          showToast('New task added!');
        }

        closeModalSafely(DOM.taskModal);
        TaskController.renderTasks();
        TaskController.updateStats();
      });

      // Category Pill selection
      DOM.categoriesPillContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.cat-pill');
        if (!pill) return;
        store.activeCategory = pill.dataset.catId;
        TaskController.renderCategories();
        TaskController.renderTasks();
      });

      // Manage Categories Modal
      DOM.openManageCategoriesBtn.addEventListener('click', () => {
        showModalSafely(DOM.categoryModal);
      });
      DOM.closeCategoryModalBtn.addEventListener('click', () => closeModalSafely(DOM.categoryModal));

      // Create new Category
      DOM.newCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = DOM.newCatNameInput.value.trim();
        const color = DOM.newCatColorInput.value;
        if (!name) return;

        const newId = `cat_${Date.now()}`;
        store.categories.push({ id: newId, name, color });
        store.saveCategories();
        DOM.newCatNameInput.value = '';
        TaskController.renderCategories();
        TaskController.renderCategorySelectOptions();
        showToast(`Category "${name}" created.`);
      });

      // Search Filtering
      DOM.searchInput.addEventListener('input', (e) => {
        store.searchQuery = e.target.value.trim();
        if (store.searchQuery) {
          DOM.clearSearchBtn.classList.remove('hidden');
        } else {
          DOM.clearSearchBtn.classList.add('hidden');
        }
        TaskController.renderTasks();
      });

      DOM.clearSearchBtn.addEventListener('click', () => {
        DOM.searchInput.value = '';
        store.searchQuery = '';
        DOM.clearSearchBtn.classList.add('hidden');
        TaskController.renderTasks();
      });

      // Status Tabs
      DOM.statusTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          DOM.statusTabs.forEach((t) => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          store.activeStatus = tab.dataset.status;
          TaskController.renderTasks();
        });
      });

      // Priority Filter
      DOM.priorityFilterSelect.addEventListener('change', (e) => {
        store.activePriority = e.target.value;
        TaskController.renderTasks();
      });

      // Sort Filter
      DOM.sortBySelect.addEventListener('change', (e) => {
        store.sortBy = e.target.value;
        TaskController.renderTasks();
      });

      // Clear completed tasks
      DOM.clearCompletedBtn.addEventListener('click', () => {
        const completedCount = store.tasks.filter((t) => t.completed).length;
        if (completedCount === 0) {
          showToast('No completed tasks to clear.');
          return;
        }
        if (confirm(`Remove all ${completedCount} completed tasks?`)) {
          store.tasks = store.tasks.filter((t) => !t.completed);
          store.saveTasks();
          TaskController.renderTasks();
          TaskController.updateStats();
          showToast(`Cleared ${completedCount} completed tasks.`);
        }
      });
    }
  }

  // ==========================================================================
  // Settings & Theme Controller
  // ==========================================================================
  class SettingsController {
    static init() {
      // Apply theme
      SettingsController.applyTheme(store.settings.theme);

      // Setup Modals
      [DOM.taskModal, DOM.categoryModal, DOM.settingsModal].forEach(setupDialogBackdropLightDismiss);

      SettingsController.bindEvents();
    }

    static applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      store.settings.theme = theme;
      store.saveSettings();
    }

    static toggleTheme() {
      const nextTheme = store.settings.theme === 'dark' ? 'light' : 'dark';
      SettingsController.applyTheme(nextTheme);
    }

    static bindEvents() {
      // Theme Toggle Click
      DOM.themeToggleBtn.addEventListener('click', SettingsController.toggleTheme);

      // Open Settings Modal
      DOM.openSettingsBtn.addEventListener('click', () => {
        AuthController.updateSettingsUI();
        showModalSafely(DOM.settingsModal);
      });
      DOM.closeSettingsModalBtn.addEventListener('click', () => closeModalSafely(DOM.settingsModal));

      // Sound toggle
      DOM.soundToggle.addEventListener('change', (e) => {
        store.settings.soundEnabled = e.target.checked;
        store.saveSettings();
        showToast(`Sound effects ${e.target.checked ? 'enabled' : 'disabled'}.`);
      });

      // Export JSON
      DOM.exportDataBtn.addEventListener('click', () => {
        const data = {
          version: '1.0',
          exportDate: new Date().toISOString(),
          tasks: store.tasks,
          categories: store.categories,
          settings: store.settings
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zentask-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported to JSON file.');
      });

      // Import JSON
      DOM.importDataBtn.addEventListener('click', () => {
        DOM.importFileInput.click();
      });

      DOM.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (data.tasks && Array.isArray(data.tasks)) {
              store.tasks = data.tasks;
              store.saveTasks();
            }
            if (data.categories && Array.isArray(data.categories)) {
              store.categories = data.categories;
              store.saveCategories();
            }
            TaskController.renderCategories();
            TaskController.renderCategorySelectOptions();
            TaskController.renderTasks();
            TaskController.updateStats();
            showToast('Backup restored successfully!');
          } catch (err) {
            showToast('Failed to import JSON: Invalid format.');
          }
        };
        reader.readAsText(file);
        DOM.importFileInput.value = '';
      });

      // Global Keyboard Shortcuts
      window.addEventListener('keydown', (e) => {
        // If modal open or typing in input, avoid global shortcuts
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

        if (isInputActive) return;

        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          TaskController.openCreateModal();
        } else if (e.key === '/') {
          e.preventDefault();
          DOM.searchInput.focus();
        }
      });
    }
  }

  // ==========================================================================
  // App Bootstrapper
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    SettingsController.init();
    AuthController.init();
    TaskController.init();
  });
})();
