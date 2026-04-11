/* ========================================
   TaskForge - App Logic
   ======================================== */

// ── Constants ──────────────────────────────
const STORAGE_KEY = 'taskforge_data';

const PROJECT_COLORS = [
  '#00d4ff', '#a855f7', '#ff9f1c', '#2ed573', '#ff4757', '#ff6b81',
  '#1e90ff', '#ffd32a', '#7bed9f', '#e056fd', '#686de0', '#f8a5c2'
];

const PRIORITY_COLORS = {
  urgent: '#ff4757',
  high: '#ff9f1c',
  medium: '#00d4ff',
  low: '#2ed573',
  none: '#555570'
};

const TAG_COLORS = [
  { bg: 'rgba(0,212,255,0.12)', text: '#00d4ff', border: 'rgba(0,212,255,0.25)' },
  { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.25)' },
  { bg: 'rgba(255,159,28,0.12)', text: '#ff9f1c', border: 'rgba(255,159,28,0.25)' },
  { bg: 'rgba(46,213,115,0.12)', text: '#2ed573', border: 'rgba(46,213,115,0.25)' },
  { bg: 'rgba(255,71,87,0.12)', text: '#ff4757', border: 'rgba(255,71,87,0.25)' },
  { bg: 'rgba(104,109,224,0.12)', text: '#686de0', border: 'rgba(104,109,224,0.25)' }
];

const AVATAR_COLORS = [
  '#ff4757', '#1e90ff', '#2ed573', '#a855f7', '#ff9f1c',
  '#e056fd', '#686de0', '#00d4ff', '#ff6b81', '#ffd32a'
];

const DEFAULT_COLUMNS = [
  { name: 'Backlog', color: '#555570' },
  { name: 'To Do', color: '#00d4ff' },
  { name: 'In Progress', color: '#a855f7' },
  { name: 'In Review', color: '#ff9f1c' },
  { name: 'Done', color: '#2ed573' }
];

// ── Utilities ──────────────────────────────
function genId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  return AVATAR_COLORS[hashStr(name) % AVATAR_COLORS.length];
}

function getTagColor(index) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

function getTagColorForName(name) {
  return TAG_COLORS[hashStr(name) % TAG_COLORS.length];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function getDueDateStatus(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffDays = (due - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 2) return 'due-soon';
  return '';
}

// ── Firebase Stubs / DB ───────────────────
const DB = {
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    this._firebasePush(data);
  },

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* corrupted */ }
    }
    return null;
  },

  // TODO: Replace with Firebase
  // import { doc, setDoc } from 'firebase/firestore';
  // import { db } from './firebase-config';
  _firebasePush(data) {
    // TODO: await setDoc(doc(db, 'users', userId), data);
    console.log('[Firebase Stub] Push data to Firestore', Object.keys(data));
  },

  // TODO: Replace with Firebase
  // import { doc, getDoc } from 'firebase/firestore';
  _firebasePull() {
    // TODO: const snap = await getDoc(doc(db, 'users', userId)); return snap.data();
    console.log('[Firebase Stub] Pull data from Firestore');
    return null;
  },

  // TODO: Replace with Firebase
  // import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
  _firebaseAuth() {
    // TODO: const result = await signInWithPopup(auth, new GoogleAuthProvider());
    console.log('[Firebase Stub] Auth with Google');
    return null;
  }
};

// ── State ──────────────────────────────────
let state = {
  projects: [],
  tasks: [],
  comments: [],
  currentProjectId: null,
  currentView: 'board'
};

// Currently viewed task in detail panel
let currentDetailTaskId = null;
// Column context menu target
let contextMenuColumnId = null;
// Task context menu target
let contextMenuTaskId = null;
// Project context menu target
let contextMenuProjectId = null;
// Project drag state
let draggedProjectId = null;

function save() {
  DB.save(state);
}

function loadState() {
  const data = DB.load();
  if (data) {
    state = {
      projects: data.projects || [],
      tasks: data.tasks || [],
      comments: data.comments || [],
      currentProjectId: data.currentProjectId || null,
      currentView: data.currentView || 'board'
    };
  }
}

// ── Seed Data ──────────────────────────────
function seedData() {
  const projectId = genId();
  const cols = DEFAULT_COLUMNS.map((c, i) => ({
    id: genId(),
    name: c.name,
    color: c.color,
    order: i
  }));

  state.projects = [{
    id: projectId,
    name: 'Getting Started',
    color: '#00d4ff',
    columns: cols,
    createdAt: new Date().toISOString()
  }];

  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const fmt = d => d.toISOString().split('T')[0];

  state.tasks = [
    {
      id: genId(), projectId, columnId: cols[1].id, parentId: null,
      title: 'Explore the Kanban board', description: 'Drag cards between columns to change their status. Try it out!',
      priority: 'medium', dueDate: fmt(tomorrow), dueTime: null,
      tags: ['onboarding', 'ui'], assignees: ['Alex Morgan'],
      completed: false, completedAt: null, order: 0, createdAt: new Date().toISOString()
    },
    {
      id: genId(), projectId, columnId: cols[1].id, parentId: null,
      title: 'Create your first project', description: 'Click "New Project" in the sidebar to create a custom project.',
      priority: 'low', dueDate: fmt(nextWeek), dueTime: null,
      tags: ['onboarding'], assignees: ['Jamie Chen'],
      completed: false, completedAt: null, order: 1, createdAt: new Date().toISOString()
    },
    {
      id: genId(), projectId, columnId: cols[2].id, parentId: null,
      title: 'Set up team members', description: 'Add assignees to tasks to track who is working on what.',
      priority: 'high', dueDate: fmt(tomorrow), dueTime: '14:00',
      tags: ['team', 'setup'], assignees: ['Alex Morgan', 'Sam Rivera'],
      completed: false, completedAt: null, order: 0, createdAt: new Date().toISOString()
    },
    {
      id: genId(), projectId, columnId: cols[0].id, parentId: null,
      title: 'Review project settings', description: '',
      priority: 'none', dueDate: null, dueTime: null,
      tags: [], assignees: [],
      completed: false, completedAt: null, order: 0, createdAt: new Date().toISOString()
    },
    {
      id: genId(), projectId, columnId: cols[3].id, parentId: null,
      title: 'Design system documentation', description: 'Review the design tokens and component patterns.',
      priority: 'urgent', dueDate: fmt(yesterday), dueTime: null,
      tags: ['design', 'docs'], assignees: ['Jamie Chen', 'Alex Morgan', 'Taylor Kim'],
      completed: false, completedAt: null, order: 0, createdAt: new Date().toISOString()
    },
    {
      id: genId(), projectId, columnId: cols[4].id, parentId: null,
      title: 'Welcome to TaskForge!', description: 'This task is already done. Nicely done!',
      priority: 'low', dueDate: fmt(today), dueTime: null,
      tags: ['welcome'], assignees: ['Sam Rivera'],
      completed: true, completedAt: new Date().toISOString(), order: 0, createdAt: new Date().toISOString()
    }
  ];

  // Add a comment to the first task
  state.comments = [
    {
      id: genId(),
      taskId: state.tasks[0].id,
      author: 'TaskForge Bot',
      text: 'Welcome! Try dragging this card to another column.',
      date: new Date().toISOString()
    }
  ];

  state.currentProjectId = projectId;
  state.currentView = 'board';
  save();
}

// ── DOM References ─────────────────────────
const $ = id => document.getElementById(id);

const els = {
  sidebar: $('sidebar'),
  sidebarOverlay: $('sidebar-overlay'),
  projectList: $('project-list'),
  newProjectBtn: $('new-project-btn'),
  menuBtn: $('menu-btn'),
  projectTitle: $('project-title'),
  viewBoard: $('view-board'),
  viewList: $('view-list'),
  searchInput: $('search-input'),
  addTaskBtn: $('add-task-btn'),
  boardView: $('board-view'),
  listView: $('list-view'),
  emptyState: $('empty-state'),
  columnsContainer: $('columns-container'),
  listContainer: $('list-container'),
  // Detail panel
  detailOverlay: $('detail-overlay'),
  detailPanel: $('detail-panel'),
  detailClose: $('detail-close'),
  detailParentLink: $('detail-parent-link'),
  detailShare: $('detail-share'),
  detailDelete: $('detail-delete'),
  detailTitle: $('detail-title'),
  detailStatus: $('detail-status'),
  detailPriority: $('detail-priority'),
  detailDueDate: $('detail-due-date'),
  detailDueTime: $('detail-due-time'),
  detailAssignees: $('detail-assignees'),
  detailAssigneeInput: $('detail-assignee-input'),
  detailAssigneeInputWrapper: $('detail-assignee-input-wrapper'),
  detailTags: $('detail-tags'),
  detailTagInput: $('detail-tag-input'),
  detailDescription: $('detail-description'),
  detailSubtasks: $('detail-subtasks'),
  detailSubtaskInput: $('detail-subtask-input'),
  detailSubtaskAdd: $('detail-subtask-add'),
  detailMaxDepth: $('detail-max-depth'),
  detailComments: $('detail-comments'),
  detailCommentInput: $('detail-comment-input'),
  detailCommentSend: $('detail-comment-send'),
  // Project modal
  projectModal: $('project-modal-overlay'),
  projectNameInput: $('project-name-input'),
  colorPicker: $('color-picker'),
  projectCancel: $('project-cancel'),
  projectCreate: $('project-create'),
  // Context menus
  projectMenu: $('project-menu'),
  columnMenu: $('column-menu'),
  taskMenu: $('task-menu'),
  taskMenuCompleteLabel: $('task-menu-complete-label'),
  taskMenuPrioritySub: $('task-menu-priority-sub'),
  taskMenuMovetoSub: $('task-menu-moveto-sub'),
  // Toast
  toastContainer: $('toast-container'),
  // FAB
  fab: $('fab')
};

// ── Toast ──────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.25s';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ── Sidebar ────────────────────────────────
function renderSidebar() {
  els.projectList.innerHTML = '';
  state.projects.forEach((p, index) => {
    const taskCount = state.tasks.filter(t => t.projectId === p.id && !t.parentId).length;
    const item = document.createElement('div');
    item.className = 'project-item' + (p.id === state.currentProjectId ? ' active' : '');
    item.draggable = true;
    item.dataset.projectId = p.id;
    item.dataset.index = index;
    item.innerHTML = `
      <span class="project-dot" style="background:${p.color}"></span>
      <span class="project-name">${escapeHtml(p.name)}</span>
      <span class="project-count">${taskCount}</span>
    `;
    item.addEventListener('click', () => selectProject(p.id));

    // Right-click context menu
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openProjectMenu(p.id, e);
    });

    // Drag-and-drop reorder
    item.addEventListener('dragstart', e => {
      draggedProjectId = p.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    item.addEventListener('dragend', () => {
      draggedProjectId = null;
      item.classList.remove('dragging');
      clearProjectDragIndicators();
    });

    item.addEventListener('dragover', e => {
      if (!draggedProjectId || draggedProjectId === p.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearProjectDragIndicators();
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        item.classList.add('drag-over-above');
      } else {
        item.classList.add('drag-over-below');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over-above', 'drag-over-below');
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      if (!draggedProjectId || draggedProjectId === p.id) return;
      const fromIndex = state.projects.findIndex(pr => pr.id === draggedProjectId);
      const toIndex = state.projects.findIndex(pr => pr.id === p.id);
      if (fromIndex === -1 || toIndex === -1) return;

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midY;

      // Remove from old position
      const [moved] = state.projects.splice(fromIndex, 1);
      // Find new target index (may have shifted after splice)
      let newIndex = state.projects.findIndex(pr => pr.id === p.id);
      if (!insertBefore) newIndex++;
      state.projects.splice(newIndex, 0, moved);

      draggedProjectId = null;
      clearProjectDragIndicators();
      save();
      render();
    });

    els.projectList.appendChild(item);
  });
}

function clearProjectDragIndicators() {
  els.projectList.querySelectorAll('.project-item').forEach(el => {
    el.classList.remove('drag-over-above', 'drag-over-below');
  });
}

// ── Project Context Menu ────────────────────
function openProjectMenu(projectId, e) {
  closeTaskMenu();
  closeColumnMenu();
  closeProjectMenu();
  contextMenuProjectId = projectId;

  const menu = els.projectMenu;
  menu.classList.remove('hidden');
  menu.style.top = e.clientY + 'px';
  menu.style.left = e.clientX + 'px';

  // Keep in viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  });
}

function closeProjectMenu() {
  els.projectMenu.classList.add('hidden');
  contextMenuProjectId = null;
}

function renameProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  const item = els.projectList.querySelector(`.project-item[data-project-id="${projectId}"]`);
  if (!item) return;
  const nameSpan = item.querySelector('.project-name');
  if (!nameSpan) return;

  const oldName = project.name;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'project-name-input';
  input.value = oldName;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  function finish(save_name) {
    if (finished) return;
    finished = true;
    const newName = input.value.trim();
    if (save_name && newName && newName !== oldName) {
      project.name = newName;
      save();
      showToast('Project renamed', 'success');
    }
    render();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });

  input.addEventListener('blur', () => finish(true));
}

function deleteProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  if (state.projects.length <= 1) {
    showToast('Cannot delete the last project', 'error');
    return;
  }

  if (!confirm(`Delete project "${project.name}" and all its tasks?`)) return;

  // Delete all tasks and comments for this project
  const projectTasks = state.tasks.filter(t => t.projectId === projectId);
  const taskIds = projectTasks.map(t => t.id);
  state.tasks = state.tasks.filter(t => t.projectId !== projectId);
  state.comments = state.comments.filter(c => !taskIds.includes(c.taskId));

  // Remove project
  state.projects = state.projects.filter(p => p.id !== projectId);

  // If we deleted the current project, select another
  if (state.currentProjectId === projectId) {
    state.currentProjectId = state.projects.length ? state.projects[0].id : null;
  }

  save();
  render();
  showToast('Project deleted', 'success');
}

function setupProjectMenu() {
  els.projectMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      const projId = contextMenuProjectId;
      closeProjectMenu();
      if (action === 'rename') renameProject(projId);
      if (action === 'delete') deleteProject(projId);
    });
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!els.projectMenu.classList.contains('hidden') && !els.projectMenu.contains(e.target)) {
      closeProjectMenu();
    }
  });
}

function selectProject(id) {
  state.currentProjectId = id;
  save();
  closeSidebar();
  render();
}

function openSidebar() {
  els.sidebar.classList.add('open');
  els.sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.sidebarOverlay.classList.remove('active');
}

// ── Project Modal ──────────────────────────
let selectedProjectColor = PROJECT_COLORS[0];

function initColorPicker() {
  els.colorPicker.innerHTML = '';
  PROJECT_COLORS.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-option' + (color === selectedProjectColor ? ' selected' : '');
    btn.style.background = color;
    btn.style.setProperty('--glow-color', color + '60');
    btn.addEventListener('click', () => {
      selectedProjectColor = color;
      els.colorPicker.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    els.colorPicker.appendChild(btn);
  });
}

function openProjectModal() {
  els.projectNameInput.value = '';
  selectedProjectColor = PROJECT_COLORS[0];
  initColorPicker();
  els.projectModal.classList.remove('hidden');
  els.projectNameInput.focus();
}

function closeProjectModal() {
  els.projectModal.classList.add('hidden');
}

function createProject() {
  const name = els.projectNameInput.value.trim();
  if (!name) {
    showToast('Please enter a project name', 'error');
    return;
  }

  const project = {
    id: genId(),
    name,
    color: selectedProjectColor,
    columns: DEFAULT_COLUMNS.map((c, i) => ({
      id: genId(),
      name: c.name,
      color: c.color,
      order: i
    })),
    createdAt: new Date().toISOString()
  };

  state.projects.push(project);
  state.currentProjectId = project.id;
  save();
  closeProjectModal();
  render();
  showToast('Project created', 'success');
}

// ── Helpers ────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCurrentProject() {
  return state.projects.find(p => p.id === state.currentProjectId) || null;
}

function getTasksForColumn(columnId, searchQuery) {
  let tasks = state.tasks.filter(t => t.columnId === columnId && !t.parentId);
  if (searchQuery) {
    tasks = tasks.filter(t => t.title.toLowerCase().includes(searchQuery));
  }
  return tasks.sort((a, b) => a.order - b.order);
}

function getSubtasks(taskId) {
  return state.tasks.filter(t => t.parentId === taskId).sort((a, b) => a.order - b.order);
}

function getTaskDepth(taskId) {
  let depth = 0;
  let task = state.tasks.find(t => t.id === taskId);
  while (task && task.parentId) {
    depth++;
    task = state.tasks.find(t => t.id === task.parentId);
  }
  return depth;
}

function deleteTaskRecursive(taskId) {
  const children = state.tasks.filter(t => t.parentId === taskId);
  children.forEach(c => deleteTaskRecursive(c.id));
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  state.comments = state.comments.filter(c => c.taskId !== taskId);
}

// ── Render ─────────────────────────────────
function render() {
  renderSidebar();
  const project = getCurrentProject();

  if (!project) {
    els.projectTitle.textContent = 'TaskForge';
    els.boardView.classList.add('hidden');
    els.listView.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
    return;
  }

  els.emptyState.classList.add('hidden');
  els.projectTitle.textContent = project.name;

  // View toggle
  els.viewBoard.classList.toggle('active', state.currentView === 'board');
  els.viewList.classList.toggle('active', state.currentView === 'list');

  if (state.currentView === 'board') {
    els.boardView.classList.remove('hidden');
    els.listView.classList.add('hidden');
    renderBoard(project);
  } else {
    els.boardView.classList.add('hidden');
    els.listView.classList.remove('hidden');
    renderList(project);
  }
}

// ── Board View ─────────────────────────────
function renderBoard(project) {
  const search = els.searchInput.value.toLowerCase().trim();
  els.columnsContainer.innerHTML = '';

  const sortedColumns = [...project.columns].sort((a, b) => a.order - b.order);

  sortedColumns.forEach(col => {
    const tasks = getTasksForColumn(col.id, search);
    const colEl = document.createElement('div');
    colEl.className = 'column';
    colEl.dataset.columnId = col.id;

    colEl.innerHTML = `
      <div class="column-header">
        <span class="column-dot" style="background:${col.color}"></span>
        <span class="column-title">${escapeHtml(col.name)}</span>
        <span class="column-count">${tasks.length}</span>
        <button class="column-menu-btn" data-column-id="${col.id}">&ctdot;</button>
      </div>
      <div class="column-cards" data-column-id="${col.id}"></div>
      <div class="column-footer">
        <button class="add-task-col-btn" data-column-id="${col.id}">+ Add task</button>
      </div>
    `;

    const cardsContainer = colEl.querySelector('.column-cards');

    // Drop zone events
    cardsContainer.addEventListener('dragover', e => {
      e.preventDefault();
      colEl.classList.add('drag-over');
    });
    cardsContainer.addEventListener('dragleave', () => {
      colEl.classList.remove('drag-over');
    });
    cardsContainer.addEventListener('drop', e => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) {
        moveTaskToColumn(taskId, col.id);
      }
    });

    tasks.forEach(task => {
      cardsContainer.appendChild(createTaskCard(task));
    });

    // Add task button
    colEl.querySelector('.add-task-col-btn').addEventListener('click', () => {
      startInlineAdd(cardsContainer, col.id);
    });

    // Column title click to rename
    colEl.querySelector('.column-title').addEventListener('click', e => {
      e.stopPropagation();
      renameColumn(col.id);
    });

    // Column menu button
    colEl.querySelector('.column-menu-btn').addEventListener('click', e => {
      e.stopPropagation();
      openColumnMenu(col.id, e.target);
    });

    els.columnsContainer.appendChild(colEl);
  });

  // Add column button
  const addColBtn = document.createElement('button');
  addColBtn.className = 'add-column-btn';
  addColBtn.textContent = '+ Add Column';
  addColBtn.addEventListener('click', () => addColumn(project));
  els.columnsContainer.appendChild(addColBtn);
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.taskId = task.id;
  card.dataset.priority = task.priority;
  card.draggable = true;

  const subtasks = getSubtasks(task.id);
  const completedSubs = subtasks.filter(s => s.completed).length;

  let metaHtml = '';
  const metaItems = [];

  if (task.dueDate) {
    const status = getDueDateStatus(task.dueDate);
    metaItems.push(`<span class="task-meta-item ${status}">&#128197; ${formatDate(task.dueDate)}</span>`);
  }
  if (subtasks.length > 0) {
    metaItems.push(`<span class="task-meta-item">&#9744; ${completedSubs}/${subtasks.length}</span>`);
  }
  if (metaItems.length) {
    metaHtml = `<div class="task-meta">${metaItems.join('')}</div>`;
  }

  let tagsHtml = '';
  if (task.tags.length) {
    tagsHtml = '<div class="task-tags">' + task.tags.map(tag => {
      const c = getTagColorForName(tag);
      return `<span class="tag" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">${escapeHtml(tag)}</span>`;
    }).join('') + '</div>';
  }

  let assigneesHtml = '';
  if (task.assignees.length) {
    const shown = task.assignees.slice(0, 3);
    const overflow = task.assignees.length - 3;
    assigneesHtml = '<div class="task-assignees">' +
      shown.map(a => `<span class="avatar" style="background:${getAvatarColor(a)}">${getInitials(a)}</span>`).join('') +
      (overflow > 0 ? `<span class="avatar avatar-overflow">+${overflow}</span>` : '') +
    '</div>';
  }

  card.innerHTML = `
    <div class="task-card-top">
      <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}">&#10003;</button>
      <span class="task-card-title">${escapeHtml(task.title)}</span>
    </div>
    ${metaHtml}
    ${tagsHtml}
    ${assigneesHtml}
  `;

  // Events
  card.querySelector('.task-checkbox').addEventListener('click', e => {
    e.stopPropagation();
    toggleTaskComplete(task.id);
  });

  card.addEventListener('click', () => openDetailPanel(task.id));

  card.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openTaskMenu(task.id, e);
  });

  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', task.id);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  return card;
}

// ── List View ──────────────────────────────
function renderList(project) {
  const search = els.searchInput.value.toLowerCase().trim();
  els.listContainer.innerHTML = '';

  const sortedColumns = [...project.columns].sort((a, b) => a.order - b.order);

  sortedColumns.forEach(col => {
    const tasks = getTasksForColumn(col.id, search);
    const group = document.createElement('div');
    group.className = 'list-group';
    group.dataset.columnId = col.id;

    group.innerHTML = `
      <button class="list-group-header">
        <span class="list-group-arrow">&#9660;</span>
        <span class="column-dot" style="background:${col.color}"></span>
        <span class="list-group-name">${escapeHtml(col.name)}</span>
        <span class="list-group-count">${tasks.length}</span>
      </button>
      <div class="list-group-body"></div>
    `;

    const body = group.querySelector('.list-group-body');

    tasks.forEach(task => {
      body.appendChild(createListRow(task));
    });

    // Add task button in list
    const addBtn = document.createElement('button');
    addBtn.className = 'list-add-btn';
    addBtn.textContent = '+ Add task';
    addBtn.addEventListener('click', () => {
      startInlineAddList(body, col.id, addBtn);
    });
    body.appendChild(addBtn);

    // Drop zone for list group
    body.addEventListener('dragover', e => {
      e.preventDefault();
      group.style.outline = '1px solid var(--accent-cyan)';
    });
    body.addEventListener('dragleave', () => {
      group.style.outline = '';
    });
    body.addEventListener('drop', e => {
      e.preventDefault();
      group.style.outline = '';
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) moveTaskToColumn(taskId, col.id);
    });

    // Collapse toggle
    group.querySelector('.list-group-header').addEventListener('click', () => {
      group.classList.toggle('collapsed');
    });

    els.listContainer.appendChild(group);
  });
}

function createListRow(task) {
  const row = document.createElement('div');
  row.className = 'list-row' + (task.completed ? ' completed' : '');
  row.dataset.taskId = task.id;
  row.draggable = true;

  const dueStatus = getDueDateStatus(task.dueDate);

  let assigneesHtml = '';
  if (task.assignees.length) {
    const shown = task.assignees.slice(0, 2);
    const overflow = task.assignees.length - 2;
    assigneesHtml = '<div class="task-assignees" style="margin:0">' +
      shown.map(a => `<span class="avatar" style="background:${getAvatarColor(a)};width:20px;height:20px;font-size:8px">${getInitials(a)}</span>`).join('') +
      (overflow > 0 ? `<span class="avatar avatar-overflow" style="width:20px;height:20px;font-size:7px">+${overflow}</span>` : '') +
    '</div>';
  }

  let tagsHtml = '';
  if (task.tags.length) {
    tagsHtml = task.tags.slice(0, 2).map(tag => {
      const c = getTagColorForName(tag);
      return `<span class="tag" style="background:${c.bg};color:${c.text};border:1px solid ${c.border};font-size:9px">${escapeHtml(tag)}</span>`;
    }).join('');
  }

  row.innerHTML = `
    <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}" style="width:16px;height:16px;font-size:9px">&#10003;</button>
    <span class="list-row-title">${escapeHtml(task.title)}</span>
    <span class="list-row-due ${dueStatus}">${task.dueDate ? formatDate(task.dueDate) : ''}</span>
    <span class="list-row-priority" data-priority="${task.priority}">${task.priority !== 'none' ? task.priority : '-'}</span>
    <span class="list-row-assignees">${assigneesHtml}</span>
    <span class="list-row-tags">${tagsHtml}</span>
  `;

  row.querySelector('.task-checkbox').addEventListener('click', e => {
    e.stopPropagation();
    toggleTaskComplete(task.id);
  });

  row.addEventListener('click', e => {
    if (e.target.closest('.task-checkbox')) return;
    openDetailPanel(task.id);
  });

  row.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openTaskMenu(task.id, e);
  });

  row.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', task.id);
    row.style.opacity = '0.4';
  });
  row.addEventListener('dragend', () => {
    row.style.opacity = '';
  });

  return row;
}

// ── Task Operations ────────────────────────
function toggleTaskComplete(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  save();
  render();
  if (currentDetailTaskId === taskId) renderDetailPanel(taskId);
}

function moveTaskToColumn(taskId, columnId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.columnId === columnId) return;
  task.columnId = columnId;
  // Also move subtasks
  const moveChildren = (parentId) => {
    state.tasks.filter(t => t.parentId === parentId).forEach(child => {
      child.columnId = columnId;
      moveChildren(child.id);
    });
  };
  moveChildren(taskId);
  save();
  render();
  showToast('Task moved', 'success');
}

function createTask(columnId, title, parentId = null) {
  const project = getCurrentProject();
  if (!project) return null;
  const task = {
    id: genId(),
    projectId: project.id,
    columnId,
    parentId,
    title,
    description: '',
    priority: 'none',
    dueDate: null,
    dueTime: null,
    tags: [],
    assignees: [],
    completed: false,
    completedAt: null,
    order: state.tasks.filter(t => t.columnId === columnId && t.parentId === parentId).length,
    createdAt: new Date().toISOString()
  };
  state.tasks.push(task);
  save();
  return task;
}

// ── Inline Add ─────────────────────────────
function removeInlineInputs() {
  document.querySelectorAll('.inline-add-input').forEach(el => el.remove());
}

function startInlineAdd(container, columnId) {
  removeInlineInputs();
  const input = document.createElement('input');
  input.className = 'inline-add-input';
  input.placeholder = 'Task title...';
  container.appendChild(input);
  input.focus();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    const val = input.value.trim();
    if (val) {
      createTask(columnId, val);
      render();
    }
    input.remove();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { finished = true; input.remove(); }
  });
  input.addEventListener('blur', finish);
}

function startInlineAddList(body, columnId, beforeEl) {
  removeInlineInputs();
  const input = document.createElement('input');
  input.className = 'inline-add-input';
  input.placeholder = 'Task title...';
  input.style.margin = '4px 16px';
  input.style.width = 'calc(100% - 32px)';
  body.insertBefore(input, beforeEl);
  input.focus();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    const val = input.value.trim();
    if (val) {
      createTask(columnId, val);
      render();
    }
    input.remove();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { finished = true; input.remove(); }
  });
  input.addEventListener('blur', finish);
}

// ── Column Operations ──────────────────────
function openColumnMenu(columnId, target) {
  closeProjectMenu();
  contextMenuColumnId = columnId;
  const menu = els.columnMenu;
  menu.classList.remove('hidden');
  const rect = target.getBoundingClientRect();
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.left = rect.left + 'px';

  // Keep menu in viewport
  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
    }
  });
}

function closeColumnMenu() {
  els.columnMenu.classList.add('hidden');
  contextMenuColumnId = null;
}

function addColumn(project) {
  const name = prompt('Column name:');
  if (!name || !name.trim()) return;
  project.columns.push({
    id: genId(),
    name: name.trim(),
    color: PROJECT_COLORS[project.columns.length % PROJECT_COLORS.length],
    order: project.columns.length
  });
  save();
  render();
  showToast('Column added', 'success');
}

function renameColumn(columnId) {
  const project = getCurrentProject();
  if (!project) return;
  const col = project.columns.find(c => c.id === columnId);
  if (!col) return;

  // Use inline editing in the column header
  const colEl = document.querySelector(`.column[data-column-id="${columnId}"]`);
  if (!colEl) return;
  const titleEl = colEl.querySelector('.column-title');
  if (!titleEl) return;
  const oldName = col.name;

  const input = document.createElement('input');
  input.className = 'column-title-input';
  input.value = oldName;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    const val = input.value.trim();
    if (val && val !== oldName) {
      col.name = val;
      save();
      showToast('Column renamed', 'success');
    }
    render();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { finished = true; render(); }
  });
  input.addEventListener('blur', finish);
}

function deleteColumn(columnId) {
  const project = getCurrentProject();
  if (!project) return;
  if (project.columns.length <= 1) {
    showToast('Cannot delete the last column', 'error');
    return;
  }
  if (!confirm('Delete this column and all its tasks?')) return;
  // Delete tasks in column
  const tasksInCol = state.tasks.filter(t => t.columnId === columnId);
  tasksInCol.forEach(t => deleteTaskRecursive(t.id));
  project.columns = project.columns.filter(c => c.id !== columnId);
  save();
  render();
  showToast('Column deleted', 'success');
}

// ── Task Context Menu ──────────────────────
function openTaskMenu(taskId, e) {
  closeProjectMenu();
  closeColumnMenu();
  closeTaskMenu();
  contextMenuTaskId = taskId;

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const project = getCurrentProject();
  if (!project) return;

  // Update "Mark Complete" / "Mark Incomplete" label
  els.taskMenuCompleteLabel.textContent = task.completed ? 'Mark Incomplete' : 'Mark Complete';

  // Build priority submenu
  const priorities = [
    { value: 'none', label: 'None', color: '#555570' },
    { value: 'low', label: 'Low', color: '#2ed573' },
    { value: 'medium', label: 'Medium', color: '#00d4ff' },
    { value: 'high', label: 'High', color: '#ff9f1c' },
    { value: 'urgent', label: 'Urgent', color: '#ff4757' }
  ];
  els.taskMenuPrioritySub.innerHTML = '';
  priorities.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'context-menu-item' + (task.priority === p.value ? ' active-priority' : '');
    btn.innerHTML = `<span class="priority-dot" style="background:${p.color}"></span>${p.label}`;
    btn.addEventListener('click', () => {
      task.priority = p.value;
      save();
      render();
      closeTaskMenu();
      showToast(`Priority set to ${p.label}`, 'success');
    });
    els.taskMenuPrioritySub.appendChild(btn);
  });

  // Build move-to submenu
  const sortedCols = [...project.columns].sort((a, b) => a.order - b.order);
  els.taskMenuMovetoSub.innerHTML = '';
  sortedCols.forEach(col => {
    const btn = document.createElement('button');
    btn.className = 'context-menu-item' + (task.columnId === col.id ? ' active-priority' : '');
    btn.innerHTML = `<span class="priority-dot" style="background:${col.color}"></span>${escapeHtml(col.name)}`;
    btn.addEventListener('click', () => {
      if (task.columnId !== col.id) {
        moveTaskToColumn(task.id, col.id);
      }
      closeTaskMenu();
    });
    els.taskMenuMovetoSub.appendChild(btn);
  });

  // Position menu at cursor
  const menu = els.taskMenu;
  menu.classList.remove('hidden');
  menu.style.top = e.clientY + 'px';
  menu.style.left = e.clientX + 'px';

  // Keep in viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  });
}

function closeTaskMenu() {
  els.taskMenu.classList.add('hidden');
  contextMenuTaskId = null;
}

function setupTaskMenu() {
  // Static action buttons (toggle-complete, copy-link, delete)
  els.taskMenu.querySelectorAll('button.context-menu-item[data-action]').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      const taskId = contextMenuTaskId;
      closeTaskMenu();

      if (!taskId) return;
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      if (action === 'toggle-complete') {
        toggleTaskComplete(taskId);
      }

      if (action === 'copy-link') {
        const text = `Task: ${task.title}\nPriority: ${task.priority}\nDue: ${task.dueDate || 'Not set'}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'success');
          });
        }
      }

      if (action === 'delete') {
        if (!confirm('Delete this task?')) return;
        deleteTaskRecursive(taskId);
        save();
        render();
        showToast('Task deleted', 'success');
      }
    });
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!els.taskMenu.classList.contains('hidden') && !els.taskMenu.contains(e.target)) {
      closeTaskMenu();
    }
  });
}

// ── Detail Panel ───────────────────────────
function openDetailPanel(taskId) {
  currentDetailTaskId = taskId;
  els.detailOverlay.classList.remove('hidden');
  els.detailPanel.classList.remove('hidden');
  // Trigger animation
  requestAnimationFrame(() => {
    els.detailPanel.classList.add('visible');
  });
  renderDetailPanel(taskId);
}

function closeDetailPanel() {
  els.detailPanel.classList.remove('visible');
  setTimeout(() => {
    els.detailOverlay.classList.add('hidden');
    els.detailPanel.classList.add('hidden');
    currentDetailTaskId = null;
  }, 300);
}

function renderDetailPanel(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) { closeDetailPanel(); return; }

  const project = state.projects.find(p => p.id === task.projectId);
  if (!project) return;

  // Parent link
  if (task.parentId) {
    const parent = state.tasks.find(t => t.id === task.parentId);
    els.detailParentLink.classList.remove('hidden');
    els.detailParentLink.textContent = '← ' + (parent ? parent.title : 'Parent');
    els.detailParentLink.onclick = () => openDetailPanel(task.parentId);
  } else {
    els.detailParentLink.classList.add('hidden');
  }

  // Title
  els.detailTitle.value = task.title;

  // Status (columns)
  els.detailStatus.innerHTML = '';
  project.columns.sort((a, b) => a.order - b.order).forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    opt.selected = col.id === task.columnId;
    els.detailStatus.appendChild(opt);
  });

  // Priority
  els.detailPriority.value = task.priority;

  // Due date/time
  els.detailDueDate.value = task.dueDate || '';
  els.detailDueTime.value = task.dueTime || '';

  // Assignees
  renderDetailAssignees(task);

  // Tags
  renderDetailTags(task);

  // Description
  els.detailDescription.value = task.description;

  // Subtasks
  renderDetailSubtasks(task);

  // Comments
  renderDetailComments(task);
}

function renderDetailAssignees(task) {
  els.detailAssignees.innerHTML = '';
  task.assignees.forEach((name, i) => {
    const el = document.createElement('div');
    el.className = 'detail-assignee';
    el.innerHTML = `
      <span class="avatar" style="background:${getAvatarColor(name)}">${getInitials(name)}</span>
      <span class="detail-assignee-name">${escapeHtml(name)}</span>
      <button class="detail-assignee-remove" data-index="${i}">&times;</button>
    `;
    el.querySelector('.detail-assignee-remove').addEventListener('click', () => {
      task.assignees.splice(i, 1);
      save();
      renderDetailAssignees(task);
      render();
    });
    els.detailAssignees.appendChild(el);
  });

  // Show/hide input based on max 5
  if (task.assignees.length >= 5) {
    els.detailAssigneeInputWrapper.classList.add('hidden');
  } else {
    els.detailAssigneeInputWrapper.classList.remove('hidden');
  }
}

function renderDetailTags(task) {
  els.detailTags.innerHTML = '';
  task.tags.forEach((tag, i) => {
    const c = getTagColorForName(tag);
    const el = document.createElement('div');
    el.className = 'detail-tag';
    el.innerHTML = `
      <span class="tag" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">
        ${escapeHtml(tag)}
        <button class="tag-remove" data-index="${i}">&times;</button>
      </span>
    `;
    el.querySelector('.tag-remove').addEventListener('click', () => {
      task.tags.splice(i, 1);
      save();
      renderDetailTags(task);
      render();
    });
    els.detailTags.appendChild(el);
  });
}

function renderDetailSubtasks(task) {
  const depth = getTaskDepth(task.id);
  const subtasks = getSubtasks(task.id);

  els.detailSubtasks.innerHTML = '';
  subtasks.forEach(sub => {
    const el = document.createElement('div');
    el.className = 'detail-subtask' + (sub.completed ? ' completed' : '');
    el.innerHTML = `
      <button class="task-checkbox ${sub.completed ? 'checked' : ''}" data-task-id="${sub.id}">&#10003;</button>
      <span class="detail-subtask-title">${escapeHtml(sub.title)}</span>
    `;
    el.querySelector('.task-checkbox').addEventListener('click', e => {
      e.stopPropagation();
      toggleTaskComplete(sub.id);
    });
    el.addEventListener('click', e => {
      if (e.target.closest('.task-checkbox')) return;
      openDetailPanel(sub.id);
    });
    els.detailSubtasks.appendChild(el);
  });

  // Show add input or max depth message
  if (depth >= 2) {
    els.detailSubtaskAdd.classList.add('hidden');
    els.detailMaxDepth.classList.remove('hidden');
  } else {
    els.detailSubtaskAdd.classList.remove('hidden');
    els.detailMaxDepth.classList.add('hidden');
  }
}

function renderDetailComments(task) {
  const comments = state.comments.filter(c => c.taskId === task.id).sort((a, b) => new Date(a.date) - new Date(b.date));
  els.detailComments.innerHTML = '';
  comments.forEach(c => {
    const el = document.createElement('div');
    el.className = 'comment';
    const d = new Date(c.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `
      <span class="avatar" style="background:${getAvatarColor(c.author)}">${getInitials(c.author)}</span>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-date">${dateStr}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    `;
    els.detailComments.appendChild(el);
  });
}

// ── Detail Panel Events ────────────────────
function setupDetailPanelEvents() {
  // Close
  els.detailClose.addEventListener('click', closeDetailPanel);
  els.detailOverlay.addEventListener('click', closeDetailPanel);

  // Title
  els.detailTitle.addEventListener('blur', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (task && els.detailTitle.value.trim()) {
      task.title = els.detailTitle.value.trim();
      save();
      render();
    }
  });

  els.detailTitle.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); els.detailTitle.blur(); }
  });

  // Status
  els.detailStatus.addEventListener('change', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (task) {
      const newColId = els.detailStatus.value;
      task.columnId = newColId;
      // Move children too
      const moveChildren = (parentId) => {
        state.tasks.filter(t => t.parentId === parentId).forEach(child => {
          child.columnId = newColId;
          moveChildren(child.id);
        });
      };
      moveChildren(task.id);
      save();
      render();
    }
  });

  // Priority
  els.detailPriority.addEventListener('change', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (task) {
      task.priority = els.detailPriority.value;
      save();
      render();
    }
  });

  // Due date
  els.detailDueDate.addEventListener('change', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (task) {
      task.dueDate = els.detailDueDate.value || null;
      save();
      render();
    }
  });

  // Due time
  els.detailDueTime.addEventListener('change', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (task) {
      task.dueTime = els.detailDueTime.value || null;
      save();
    }
  });

  // Description
  els.detailDescription.addEventListener('blur', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (task) {
      task.description = els.detailDescription.value;
      save();
    }
  });

  // Add assignee
  els.detailAssigneeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      const val = els.detailAssigneeInput.value.trim();
      if (task && val && task.assignees.length < 5) {
        task.assignees.push(val);
        els.detailAssigneeInput.value = '';
        save();
        renderDetailAssignees(task);
        render();
      }
    }
  });

  // Add tag
  els.detailTagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      const val = els.detailTagInput.value.trim().toLowerCase();
      if (task && val && !task.tags.includes(val)) {
        task.tags.push(val);
        els.detailTagInput.value = '';
        save();
        renderDetailTags(task);
        render();
      }
    }
  });

  // Add subtask
  els.detailSubtaskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const task = state.tasks.find(t => t.id === currentDetailTaskId);
      const val = els.detailSubtaskInput.value.trim();
      if (task && val) {
        createTask(task.columnId, val, task.id);
        els.detailSubtaskInput.value = '';
        renderDetailSubtasks(task);
        render();
      }
    }
  });

  // Add comment
  const sendComment = () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    const val = els.detailCommentInput.value.trim();
    if (task && val) {
      state.comments.push({
        id: genId(),
        taskId: task.id,
        author: 'You',
        text: val,
        date: new Date().toISOString()
      });
      els.detailCommentInput.value = '';
      save();
      renderDetailComments(task);
    }
  };

  els.detailCommentSend.addEventListener('click', sendComment);
  els.detailCommentInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendComment(); }
  });

  // Share
  els.detailShare.addEventListener('click', () => {
    const task = state.tasks.find(t => t.id === currentDetailTaskId);
    if (!task) return;
    const text = `Task: ${task.title}\nPriority: ${task.priority}\nDue: ${task.dueDate || 'Not set'}`;
    if (navigator.share) {
      navigator.share({ title: task.title, text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard', 'success');
      });
    }
  });

  // Delete
  els.detailDelete.addEventListener('click', () => {
    if (!confirm('Delete this task?')) return;
    deleteTaskRecursive(currentDetailTaskId);
    save();
    closeDetailPanel();
    render();
    showToast('Task deleted', 'success');
  });
}

// ── Search ─────────────────────────────────
function setupSearch() {
  els.searchInput.addEventListener('input', () => {
    render();
  });
}

// ── View Toggle ────────────────────────────
function setupViewToggle() {
  els.viewBoard.addEventListener('click', () => {
    state.currentView = 'board';
    save();
    render();
  });
  els.viewList.addEventListener('click', () => {
    state.currentView = 'list';
    save();
    render();
  });
}

// ── Column Menu ────────────────────────────
function setupColumnMenu() {
  els.columnMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      const colId = contextMenuColumnId;
      closeColumnMenu();
      if (action === 'rename') renameColumn(colId);
      if (action === 'add-task') {
        const container = document.querySelector(`.column-cards[data-column-id="${colId}"]`);
        if (container) startInlineAdd(container, colId);
      }
      if (action === 'delete') deleteColumn(colId);
    });
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!els.columnMenu.classList.contains('hidden') && !els.columnMenu.contains(e.target) && !e.target.classList.contains('column-menu-btn')) {
      closeColumnMenu();
    }
  });
}

// ── Header Buttons ─────────────────────────
function setupHeaderButtons() {
  // Menu (mobile)
  els.menuBtn.addEventListener('click', () => {
    if (els.sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  els.sidebarOverlay.addEventListener('click', closeSidebar);

  // Add task button
  els.addTaskBtn.addEventListener('click', () => {
    const project = getCurrentProject();
    if (!project || !project.columns.length) return;
    // Find first column (by order) and add task there
    const col = [...project.columns].sort((a, b) => a.order - b.order)[0];
    if (state.currentView === 'board') {
      const container = document.querySelector(`.column-cards[data-column-id="${col.id}"]`);
      if (container) startInlineAdd(container, col.id);
    } else {
      const group = document.querySelector(`.list-group[data-column-id="${col.id}"]`);
      if (group) {
        group.classList.remove('collapsed');
        const body = group.querySelector('.list-group-body');
        const addBtn = body.querySelector('.list-add-btn');
        if (body && addBtn) startInlineAddList(body, col.id, addBtn);
      }
    }
  });

  // FAB
  els.fab.addEventListener('click', () => {
    const project = getCurrentProject();
    if (!project || !project.columns.length) return;
    const col = [...project.columns].sort((a, b) => a.order - b.order)[0];
    if (state.currentView === 'board') {
      const container = document.querySelector(`.column-cards[data-column-id="${col.id}"]`);
      if (container) {
        startInlineAdd(container, col.id);
        container.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      const group = document.querySelector(`.list-group[data-column-id="${col.id}"]`);
      if (group) {
        group.classList.remove('collapsed');
        const body = group.querySelector('.list-group-body');
        const addBtn = body.querySelector('.list-add-btn');
        if (body && addBtn) startInlineAddList(body, col.id, addBtn);
      }
    }
  });

  // New project
  els.newProjectBtn.addEventListener('click', openProjectModal);
  els.projectCancel.addEventListener('click', closeProjectModal);
  els.projectCreate.addEventListener('click', createProject);

  // Enter on project name input
  els.projectNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); createProject(); }
    if (e.key === 'Escape') closeProjectModal();
  });

  // Click outside modal to close
  els.projectModal.addEventListener('click', e => {
    if (e.target === els.projectModal) closeProjectModal();
  });
}

// ── Keyboard Shortcuts ─────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      // Close in priority order: context menus, detail panel, project modal, sidebar
      if (!els.projectMenu.classList.contains('hidden')) {
        closeProjectMenu();
      } else if (!els.taskMenu.classList.contains('hidden')) {
        closeTaskMenu();
      } else if (!els.columnMenu.classList.contains('hidden')) {
        closeColumnMenu();
      } else if (!els.detailPanel.classList.contains('hidden')) {
        closeDetailPanel();
      } else if (!els.projectModal.classList.contains('hidden')) {
        closeProjectModal();
      } else if (els.sidebar.classList.contains('open')) {
        closeSidebar();
      }
    }
  });
}

// ── Init ───────────────────────────────────
function init() {
  loadState();

  // Seed if no projects
  if (!state.projects.length) {
    seedData();
  }

  setupDetailPanelEvents();
  setupSearch();
  setupViewToggle();
  setupProjectMenu();
  setupColumnMenu();
  setupTaskMenu();
  setupHeaderButtons();
  setupKeyboard();

  render();
}

document.addEventListener('DOMContentLoaded', init);
