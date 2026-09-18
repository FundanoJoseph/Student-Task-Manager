// script.js
// Frontend logic: talks to the Flask backend REST API using fetch()

const API_URL = '/api/tasks';

const form = document.getElementById('task-form');
const titleInput = document.getElementById('title');
const categoryInput = document.getElementById('category');
const priorityInput = document.getElementById('priority');
const dueDateInput = document.getElementById('due-date');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const taskCount = document.getElementById('task-count');
const tabButtons = document.querySelectorAll('.tab-btn');
const dateline = document.getElementById('dateline');

let allTasks = [];
let currentFilter = 'all';

dateline.textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', month: 'long', day: 'numeric',
});

// ---------- API calls ----------
async function fetchTasks() {
  const res = await fetch(API_URL);
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  allTasks = await res.json();
  render();
}

async function addTask(task) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  await fetchTasks();
}

async function updateTask(id, updates) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  await fetchTasks();
}

async function deleteTask(id) {
  const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  await fetchTasks();
}

// ---------- Formatting helpers ----------
function formatDueDate(isoDate) {
  // isoDate is "YYYY-MM-DD"
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------- Rendering ----------
function render() {
  let visibleTasks = allTasks;
  if (currentFilter === 'active') visibleTasks = allTasks.filter((t) => !t.completed);
  if (currentFilter === 'completed') visibleTasks = allTasks.filter((t) => t.completed);

  taskList.innerHTML = '';
  emptyState.style.display = visibleTasks.length === 0 ? 'block' : 'none';

  visibleTasks
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((task) => {
      const li = document.createElement('li');
      li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;

      const dueBadge = task.dueDate
        ? `<span class="due-badge ${task.overdue ? 'overdue' : ''}">${task.overdue ? 'Overdue · ' : 'Due '}${escapeHtml(formatDueDate(task.dueDate))}</span>`
        : '';

      li.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} />
        <div class="task-info">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span>${escapeHtml(task.category)}</span>
            <span>${escapeHtml(task.priority)} priority</span>
            ${dueBadge}
          </div>
        </div>
        <button class="delete-btn" title="Delete task">Remove</button>
      `;

      li.querySelector('.task-checkbox').addEventListener('change', (e) => {
        updateTask(task.id, { completed: e.target.checked });
      });

      li.querySelector('.delete-btn').addEventListener('click', () => {
        deleteTask(task.id);
      });

      taskList.appendChild(li);
    });

  const activeCount = allTasks.filter((t) => !t.completed).length;
  taskCount.textContent = `${activeCount} task${activeCount !== 1 ? 's' : ''} in progress`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Events ----------
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  addTask({
    title,
    category: categoryInput.value,
    priority: priorityInput.value,
    dueDate: dueDateInput.value || null,
  });

  titleInput.value = '';
  dueDateInput.value = '';
  titleInput.focus();
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ---------- Init ----------
fetchTasks();