// Student Task Manager — Aesthetic Edition
// Talks to Flask backend, adds motion, PWA install, confetti & toasts

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

// new aesthetic elements (may be null on auth pages)
const progressRing = document.getElementById('progress-ring');
const progressLabel = document.getElementById('progress-label');
const progressDetail = document.getElementById('progress-detail');
const progressBar = document.getElementById('progress-bar');
const installBanner = document.getElementById('install-banner');
const iosHint = document.getElementById('ios-hint');
const toastStack = document.getElementById('toast-stack');
const confettiCanvas = document.getElementById('confetti');

let allTasks = [];
let currentFilter = 'all';
let deferredPrompt = null;

// ---------- Dateline with nice format ----------
if (dateline) {
  const d = new Date();
  dateline.textContent = d.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

// ---------- Toasts ----------
function showToast(message, variant = 'default', duration = 2600) {
  if (!toastStack) return;
  const el = document.createElement('div');
  el.className = `toast ${variant}`;
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M13 16h-1v-4h-1m1-4h.01"/><circle cx="12" cy="12" r="10"/></svg>`
  };
  el.innerHTML = `${icons[variant] || icons.default}<span>${escapeHtml(message)}</span>`;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ---------- Confetti (lightweight) ----------
function burstConfetti(x = window.innerWidth / 2, y = window.innerHeight / 2) {
  if (!confettiCanvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = confettiCanvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const W = confettiCanvas.width = window.innerWidth * DPR;
  const H = confettiCanvas.height = window.innerHeight * DPR;
  confettiCanvas.style.width = window.innerWidth + 'px';
  confettiCanvas.style.height = window.innerHeight + 'px';
  ctx.scale(DPR, DPR);

  const count = 26;
  const particles = [];
  const colors = ['#0F7173', '#2EC4B6', '#E4572E', '#F4A300', '#6A9955', '#7FE3D2'];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x / DPR, y: y / DPR,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 9 - 2,
      r: Math.random() * 6 + 4,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      color: colors[i % colors.length],
      life: 0, ttl: 700 + Math.random() * 500
    });
  }
  let start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;
    particles.forEach(p => {
      p.life = elapsed;
      if (p.life > p.ttl) return;
      alive = true;
      p.x += p.vx * 0.016 * 60 * 0.016 * 100;
      // simpler physics
      p.x += p.vx * 0.18;
      p.y += p.vy * 0.18;
      p.vy += 0.28;
      p.vx *= 0.99;
      p.rot += p.vr * 0.06;
      const alpha = 1 - p.life / p.ttl;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      // rounded rect particle
      const w = p.r, h = p.r * 0.62;
      ctx.beginPath();
      ctx.roundRect(-w/2, -h/2, w, h, 3);
      ctx.fill();
      ctx.restore();
    });
    if (alive && elapsed < 1400) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
  requestAnimationFrame(frame);
}

// ---------- PWA install handling ----------
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBanner && !isStandalone() && !localStorage.getItem('planner-install-dismissed')) {
    installBanner.classList.add('visible');
  }
});

function setupInstallUI() {
  const btnInstall = document.getElementById('btn-install');
  const btnDismiss = document.getElementById('btn-dismiss');
  const btnIosDismiss = document.getElementById('btn-ios-dismiss');

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) {
        showToast('To install: open browser menu → Install app', 'default', 3400);
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') showToast('App installed! 🎉', 'success');
      deferredPrompt = null;
      installBanner.classList.remove('visible');
    });
  }
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      installBanner.classList.remove('visible');
      localStorage.setItem('planner-install-dismissed', '1');
    });
  }
  if (btnIosDismiss && iosHint) {
    btnIosDismiss.addEventListener('click', () => {
      iosHint.classList.remove('visible');
      localStorage.setItem('planner-ios-dismissed', '1');
    });
  }
  // iOS hint
  if (isIos() && !isStandalone() && iosHint && !localStorage.getItem('planner-ios-dismissed')) {
    // show after a short delay, and only if not already showing install banner via beforeinstallprompt (which never fires on iOS)
    setTimeout(() => iosHint.classList.add('visible'), 1200);
  }
  // if already installed, hide everything
  if (isStandalone() && installBanner) installBanner.classList.remove('visible');
  if (isStandalone() && iosHint) iosHint.classList.remove('visible');
}
setupInstallUI();

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // check for updates
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('New version available — refresh to update', 'default', 4000);
          }
        });
      });
    }).catch(() => {
      // fallback try static path (for dev)
      navigator.serviceWorker.register('/static/sw.js').catch(()=>{});
    });
  });
}

// ---------- API calls ----------
async function fetchTasks() {
  // skeleton
  if (taskList && allTasks.length === 0) {
    taskList.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('li');
      s.className = 'task-item skeleton';
      taskList.appendChild(s);
    }
    if (emptyState) emptyState.style.display = 'none';
  }
  try {
    const res = await fetch(API_URL);
    if (res.status === 401) { window.location.href = '/login'; return; }
    allTasks = await res.json();
    render();
  } catch (err) {
    showToast('You’re offline — showing cached tasks', 'default');
    // try cache fallback handled by SW, but still try to render what we have
    render();
  }
}

async function addTask(task) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (res.status === 401) { window.location.href = '/login'; return; }
  if (!res.ok) {
    const e = await res.json().catch(()=>({error:'Could not add task'}));
    showToast(e.error || 'Could not add task', 'error');
    return;
  }
  await fetchTasks();
  showToast('Task added ✨', 'success', 1800);
  // tiny pulse on composer
  const composer = document.querySelector('.composer');
  if (composer) {
    composer.style.transform = 'translateY(-1px) scale(1.005)';
    setTimeout(()=> composer.style.transform = '', 220);
  }
}

async function updateTask(id, updates, opts = {}) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (res.status === 401) { window.location.href = '/login'; return; }
  if (!res.ok) {
    showToast('Could not update task', 'error');
    return;
  }
  await fetchTasks();
  if (opts.completed) {
    showToast('Nice work! ✅', 'success', 1800);
    // confetti near the checkbox
    if (opts.rect) burstConfetti(opts.rect.left + opts.rect.width/2, opts.rect.top);
  }
}

async function deleteTask(id, el) {
  if (el) {
    el.classList.add('removing');
    // wait for animation before actually deleting (feels more delightful)
    await new Promise(r => setTimeout(r, 300));
  }
  const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (res.status === 401) { window.location.href = '/login'; return; }
  if (!res.ok) {
    if (el) el.classList.remove('removing');
    showToast('Could not delete task', 'error');
    return;
  }
  // keep animation; fetch will re-render but we can optimistic remove
  await fetchTasks();
  showToast('Task removed', 'default', 1600);
}

// ---------- Formatting ----------
function formatDueDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}
function relativeDue(isoDate) {
  const [y,m,dd] = isoDate.split('-').map(Number);
  const due = new Date(y,m-1,dd);
  const today = new Date(); today.setHours(0,0,0,0);
  due.setHours(0,0,0,0);
  const diff = Math.round((due - today)/(1000*60*60*24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  return formatDueDate(isoDate);
}

// ---------- Rendering ----------
function render() {
  if (!taskList) return;
  let visibleTasks = allTasks;
  if (currentFilter === 'active') visibleTasks = allTasks.filter((t) => !t.completed);
  if (currentFilter === 'completed') visibleTasks = allTasks.filter((t) => t.completed);

  // progress computation
  const total = allTasks.length;
  const done = allTasks.filter(t=>t.completed).length;
  const pct = total === 0 ? 0 : Math.round(done/total*100);
  if (progressRing) {
    progressRing.style.setProperty('--progress', pct + '%');
    const span = progressRing.querySelector('span');
    if (span) span.textContent = pct + '%';
  }
  if (progressLabel) progressLabel.textContent = total === 0 ? 'No tasks yet' : `${done} of ${total} complete`;
  if (progressDetail) {
    if (total === 0) progressDetail.textContent = 'Add your first task to get started.';
    else if (pct === 100) progressDetail.textContent = 'All done — gorgeous work! 🎉';
    else if (pct >= 70) progressDetail.textContent = 'Almost there — keep the momentum.';
    else progressDetail.textContent = `${total - done} to go — you’ve got this.`;
  }
  if (progressBar) progressBar.style.setProperty('--progress', pct + '%');

  taskList.innerHTML = '';
  if (emptyState) emptyState.style.display = visibleTasks.length === 0 ? 'block' : 'none';

  visibleTasks
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((task) => {
      const li = document.createElement('li');
      li.className = `task-item priority-${task.priority} ${task.completed ? 'completed' : ''}`;
      li.dataset.id = task.id;

      const dueLabel = task.dueDate ? relativeDue(task.dueDate) : '';
      const dueFull = task.dueDate ? formatDueDate(task.dueDate) : '';
      const dueBadge = task.dueDate
        ? `<span class="due-badge ${task.overdue ? 'overdue' : ''}" title="${escapeHtml(dueFull)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            ${escapeHtml(dueLabel)}
           </span>`
        : '';

      const priorityClass = `priority-${task.priority}`;
      li.innerHTML = `
        <label class="task-check-wrap" title="${task.completed ? 'Mark as in progress' : 'Mark as done'}">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Complete task" />
        </label>
        <div class="task-info">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="meta-pill category">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8c1.5 0 2.9.4 4.1 1.1L20 8.9c.7 1.2 1.1 2.6 1.1 4.1z"/><path d="M12 8v4l3 3"/></svg>
              ${escapeHtml(task.category)}
            </span>
            <span class="meta-pill ${priorityClass}">${escapeHtml(task.priority)}</span>
            ${dueBadge}
          </div>
        </div>
        <button class="delete-btn" title="Delete task" aria-label="Delete task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Remove
        </button>
      `;

      const cb = li.querySelector('.task-checkbox');
      cb.addEventListener('change', (e) => {
        const rect = cb.getBoundingClientRect();
        const checked = e.target.checked;
        // optimistic animation: small scale
        li.style.transform = checked ? 'scale(0.99)' : '';
        updateTask(task.id, { completed: checked }, { completed: checked, rect });
        if (checked && navigator.vibrate) navigator.vibrate(18);
      });

      li.querySelector('.delete-btn').addEventListener('click', () => {
        deleteTask(task.id, li);
        if (navigator.vibrate) navigator.vibrate(10);
      });

      // subtle entrance tilt for fun
      li.addEventListener('mouseenter', () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      });

      taskList.appendChild(li);
    });

  // animated count
  const activeCount = allTasks.filter((t) => !t.completed).length;
  if (taskCount) {
    const label = currentFilter === 'completed' ? `${allTasks.filter(t=>t.completed).length} completed` :
                  currentFilter === 'active' ? `${activeCount} in progress` :
                  `${activeCount} in progress · ${allTasks.filter(t=>t.completed).length} done`;
    // tiny count bump animation
    taskCount.style.transform = 'scale(1.06)';
    taskCount.textContent = label;
    setTimeout(()=> taskCount.style.transform = '', 180);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---------- Events ----------
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      titleInput.style.boxShadow = '0 0 0 3px rgba(228,87,46,0.18)';
      titleInput.style.borderColor = 'var(--coral)';
      setTimeout(()=> { titleInput.style.boxShadow=''; titleInput.style.borderColor=''; }, 900);
      showToast('Please write a task title', 'error', 2000);
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:16px;height:16px"><path d="M12 5v14M5 12h14"/></svg> Adding…`;
    btn.disabled = true;

    addTask({
      title,
      category: categoryInput.value,
      priority: priorityInput.value,
      dueDate: dueDateInput.value || null,
    }).finally(() => {
      btn.innerHTML = old;
      btn.disabled = false;
    });

    titleInput.value = '';
    dueDateInput.value = '';
    titleInput.focus();
  });

  // quick add with Enter on due date triggers submit (native) but ensure UX
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.metaKey) form.requestSubmit();
  });
}

if (tabButtons) {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      // re-render with a soft fade
      if (taskList) {
        taskList.style.opacity = '0.55';
        taskList.style.transform = 'translateY(4px)';
        setTimeout(() => {
          render();
          taskList.style.opacity = '';
          taskList.style.transform = '';
          taskList.style.transition = 'opacity 0.2s, transform 0.2s';
          setTimeout(()=> taskList.style.transition='', 220);
        }, 140);
      } else {
        render();
      }
    });
  });
}

// quick action via URL (?action=new)
if (new URLSearchParams(location.search).get('action') === 'new' && titleInput) {
  setTimeout(()=> titleInput.focus(), 300);
}

// global keyboard: "/" to focus
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && titleInput) {
    e.preventDefault();
    titleInput.focus();
  }
});

// Init
if (taskList) fetchTasks();

// Add subtle parallax to orbs on mouse
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('mousemove', (e) => {
    const orbs = document.querySelectorAll('.orb');
    if (!orbs.length) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 18;
    const y = (e.clientY / window.innerHeight - 0.5) * 18;
    orbs.forEach((o, i) => {
      const factor = (i + 1) * 0.35;
      o.style.transform = `translate3d(${x * factor}px, ${y * factor}px, 0) scale(${1 + i*0.01})`;
    });
  }, { passive: true });
}
