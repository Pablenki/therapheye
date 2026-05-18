// =============================================
// THERAPHEYE SCREEN GUARD — Popup JS v1.1
// Integrado con background.js (GET_STATE / START / PAUSE / RESET)
// =============================================

const APP_URL = 'https://therapheye.netlify.app';
const WORK_MINUTES = 20;

// ─── State ────────────────────────────────────────────────────────────────────

let timerState = null;    // último STATE_UPDATE del background
let tickInterval = null;  // para actualizar el reloj localmente cada segundo

// ─── Formateo ─────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function formatHMS(totalMs) {
  const s = Math.floor(totalMs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function formatShort(totalMs) {
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function msToDisplayHM(ms) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${pad(h)}:${pad(m)}`;
}

// ─── Timer display ────────────────────────────────────────────────────────────

function renderTimer(state) {
  if (!state) return;
  timerState = state;

  const elapsed = state.isRunning && state.startTimestamp
    ? state.accumulatedMs + Math.max(0, Date.now() - state.startTimestamp)
    : state.elapsedMs ?? state.accumulatedMs ?? 0;

  // Main clock
  document.getElementById('timer-display').textContent = formatHMS(elapsed);

  // Status dot + label
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  if (state.inactivityWarning) {
    statusDot.className = 'status-dot warn';
    statusLabel.textContent = 'Sin actividad detectada';
  } else if (state.isRunning) {
    statusDot.className = 'status-dot running';
    statusLabel.textContent = 'Activo';
  } else if (state.finalized) {
    statusDot.className = 'status-dot done';
    statusLabel.textContent = 'Sesión finalizada';
  } else {
    statusDot.className = 'status-dot paused';
    statusLabel.textContent = 'Pausado';
  }

  // Next break
  const nextBreakEl = document.getElementById('next-break');
  if (state.nextBreakAtMs !== null && state.isRunning) {
    const remaining = Math.max(0, state.nextBreakAtMs - elapsed);
    const mins = Math.ceil(remaining / 60_000);
    nextBreakEl.textContent = `Próximo descanso: ${mins} min`;
    nextBreakEl.style.display = '';
  } else {
    nextBreakEl.style.display = 'none';
  }

  // Buttons
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');

  btnStart.style.display = state.isRunning ? 'none' : '';
  btnPause.style.display = state.isRunning ? '' : 'none';
  btnStart.disabled = state.finalized;

  // Save row: visible when there's at least 1 minute of unsaved time
  const saveRow = document.getElementById('save-row');
  const unsavedMs = elapsed - (state.lastSavePointMs || 0);
  saveRow.style.display = (unsavedMs >= 60_000 && !state.finalized) ? '' : 'none';

  // Auto-save indicator
  const autoSaveEl = document.getElementById('auto-save-info');
  if (autoSaveEl) {
    if (state.lastSavePointMs > 0) {
      autoSaveEl.textContent = `✓ Historial actualizado · ${formatShort(state.lastSavePointMs)} guardados`;
      autoSaveEl.style.display = '';
    } else {
      autoSaveEl.style.display = 'none';
    }
  }

  // Inactivity warning
  const warnEl = document.getElementById('inactivity-warn');
  if (state.inactivityWarning) {
    warnEl.style.display = '';
  } else {
    warnEl.style.display = 'none';
  }

  // Foreign session
  const foreignEl = document.getElementById('foreign-session');
  if (state.foreignSession && !state.isRunning) {
    foreignEl.style.display = '';
    document.getElementById('foreign-time').textContent = state.foreignSession.formatted;
  } else {
    foreignEl.style.display = 'none';
  }

  // Startup prompt banner
  const startupBanner = document.getElementById('startup-banner');
  if (state.startupPromptPending && !state.isRunning && !state.finalized) {
    startupBanner.style.display = '';
  } else {
    startupBanner.style.display = 'none';
  }

  // Progress bar (20-min cycle)
  const progressEl = document.getElementById('break-progress');
  if (state.nextBreakAtMs !== null && state.isRunning) {
    const cycleStart = state.nextBreakAtMs - WORK_MINUTES * 60_000;
    const pct = Math.min(((elapsed - cycleStart) / (WORK_MINUTES * 60_000)) * 100, 100);
    progressEl.style.width = Math.max(0, pct) + '%';
  } else {
    progressEl.style.width = '0%';
  }
}

function tickLocally() {
  if (!timerState?.isRunning || !timerState?.startTimestamp) return;
  const elapsed = timerState.accumulatedMs + Math.max(0, Date.now() - timerState.startTimestamp);
  document.getElementById('timer-display').textContent = formatHMS(elapsed);

  // Update break progress
  const progressEl = document.getElementById('break-progress');
  if (timerState.nextBreakAtMs !== null) {
    const cycleStart = timerState.nextBreakAtMs - WORK_MINUTES * 60_000;
    const pct = Math.min(((elapsed - cycleStart) / (WORK_MINUTES * 60_000)) * 100, 100);
    progressEl.style.width = Math.max(0, pct) + '%';

    const nextBreakEl = document.getElementById('next-break');
    const remaining = Math.max(0, timerState.nextBreakAtMs - elapsed);
    const mins = Math.ceil(remaining / 60_000);
    nextBreakEl.textContent = `Próximo descanso: ${mins} min`;
  }
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────

async function renderWeeklyChart() {
  const DAYS_ES = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];
  const today = new Date().toISOString().slice(0, 10);

  const stored = await getStorage(['daily_history', 'therapeye_ext_timer']);
  const history = Object.assign({}, stored.daily_history || {});

  // Merge today's live timer
  const timer = stored.therapeye_ext_timer;
  if (timer?.stateDate) {
    let elapsed = Number(timer.accumulatedMs) || 0;
    if (timer.isRunning && timer.startTimestamp) {
      const delta = Date.now() - Number(timer.startTimestamp);
      if (delta > 0 && delta < 16 * 3600000) elapsed += delta;
    }
    if (!history[timer.stateDate]) history[timer.stateDate] = { totalMs: 0 };
    history[timer.stateDate].totalMs = Math.max(history[timer.stateDate].totalMs || 0, Math.round(elapsed));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, ms: history[key]?.totalMs ?? 0, label: DAYS_ES[d.getDay()], isToday: key === today };
  });

  const maxMs = Math.max(...weekDays.map(d => d.ms), 1);
  const DAILY_GOAL = 8 * 3_600_000;

  const chart = document.getElementById('weekly-chart');
  const daysEl = document.getElementById('chart-days');
  chart.innerHTML = '';
  daysEl.innerHTML = '';

  weekDays.forEach(day => {
    const heightPct = Math.max((day.ms / maxMs) * 100, day.ms > 0 ? 6 : 0);
    const bar = document.createElement('div');
    bar.className = 'chart-bar' + (day.isToday ? ' today' : day.ms >= DAILY_GOAL ? ' high' : day.ms > 0 ? ' ok' : '');
    bar.style.height = heightPct + '%';
    const tip = document.createElement('div');
    tip.className = 'chart-bar-tip';
    tip.textContent = day.ms > 0 ? formatShort(day.ms) : '—';
    bar.appendChild(tip);
    chart.appendChild(bar);

    const dayLabel = document.createElement('div');
    dayLabel.className = 'chart-day' + (day.isToday ? ' today' : '');
    dayLabel.textContent = day.label;
    daysEl.appendChild(dayLabel);
  });

  // Today hero
  const todayMs = history[today]?.totalMs ?? 0;
  document.getElementById('today-time').textContent = msToDisplayHM(todayMs);
  const pct = Math.min((todayMs / DAILY_GOAL) * 100, 100);
  const fill = document.getElementById('time-bar-fill');
  fill.style.width = pct + '%';
  fill.classList.remove('warn', 'ok');
  if (todayMs >= DAILY_GOAL) fill.classList.add('warn');
  else if (todayMs < DAILY_GOAL * 0.5) fill.classList.add('ok');
  document.getElementById('time-bar-label').textContent = `${formatShort(todayMs)} · objetivo ${formatShort(DAILY_GOAL)}`;
}

// ─── Controles ────────────────────────────────────────────────────────────────

function setupControls() {
  document.getElementById('btn-start').addEventListener('click', () => {
    sendMsg({ type: 'START' });
  });
  document.getElementById('btn-pause').addEventListener('click', () => {
    sendMsg({ type: 'PAUSE' });
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('¿Resetear el temporizador de hoy?')) return;
    sendMsg({ type: 'RESET' });
  });
  document.getElementById('btn-confirm-active').addEventListener('click', () => {
    sendMsg({ type: 'CONFIRM_ACTIVE' });
  });
  document.getElementById('btn-takeover').addEventListener('click', () => {
    sendMsg({ type: 'TAKE_OVER' });
  });

  // Quick links
  document.getElementById('btn-exercises').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: APP_URL });
    window.close();
  });
  document.getElementById('btn-stats').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: APP_URL });
    window.close();
  });
  document.getElementById('btn-app').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: APP_URL });
    window.close();
  });

  // Startup banner buttons
  document.getElementById('startup-yes').addEventListener('click', () => {
    sendMsg({ type: 'START' });
  });
  document.getElementById('startup-no').addEventListener('click', () => {
    sendMsg({ type: 'DISMISS_STARTUP_PROMPT' });
  });

  // Save session buttons
  const showSaveFeedback = (msg, isError) => {
    const fb = document.getElementById('save-feedback');
    fb.textContent = msg;
    fb.style.color = isError ? '#f87171' : '#10b981';
    fb.style.display = '';
    setTimeout(() => { fb.style.display = 'none'; }, 3000);
  };

  document.getElementById('btn-save-temp').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SAVE_SESSION', final: false }, (resp) => {
      if (resp?.ok) {
        showSaveFeedback('✓ Guardado. El temporizador sigue corriendo.', false);
        getState();
      } else {
        showSaveFeedback(resp?.reason === 'too_short' ? 'Mínimo 1 minuto para guardar.' : 'Error al guardar.', true);
      }
    });
  });

  document.getElementById('btn-save-final').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SAVE_SESSION', final: true }, (resp) => {
      if (resp?.ok) {
        showSaveFeedback('✓ Sesión guardada y finalizada.', false);
        getState();
      } else {
        showSaveFeedback(resp?.reason === 'too_short' ? 'Mínimo 1 minuto para guardar.' : 'Error al guardar.', true);
      }
    });
  });

  // Test reminder
  document.getElementById('test-reminder-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SHOW_REMINDER_2020' }).catch(() => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Therapheye — Regla 20-20-20',
          message: 'Mira algo a 6 metros por 20 segundos. ¡Cuida tus ojos!',
        });
      });
    }
    window.close();
  });
}

// ─── Mensajes desde background ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATE_UPDATE') {
    renderTimer(msg);
  }
  if (msg.type === 'RUNNING_ELSEWHERE' || msg.type === 'FOREIGN_SESSION_CLEARED') {
    getState();
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendMsg(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(res);
      });
    } catch { resolve(null); }
  });
}

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}));
  });
}

function getState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      if (state) renderTimer(state);
      resolve(state);
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  setupControls();
  await getState();
  await renderWeeklyChart();

  // Tick local para suavizar el contador mientras el popup está abierto
  tickInterval = setInterval(tickLocally, 1000);
});

window.addEventListener('unload', () => {
  clearInterval(tickInterval);
});
