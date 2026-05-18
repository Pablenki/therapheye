// ═══════════════════════════════════════════════════════════════════════════════
// Therapheye Extension – Background Service Worker v1.5.0
// ═══════════════════════════════════════════════════════════════════════════════

const WORK_MINUTES        = 20;
const INACTIVITY_MINUTES  = 5;
const WARN_BEFORE_PAUSE_S = 120;
const TICK_INTERVAL_MS    = 1000;
const STORAGE_KEY         = 'therapeye_ext_timer';

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  isRunning: false,
  accumulatedMs: 0,
  startTimestamp: null,
  sessionStartTimestamp: null,
  nextBreakAtMs: null,
  finalized: false,
  stateDate: todayDate(),
  lastActivityTs: Date.now(),
  inactivityWarning: false,
  inactivityWarnStartTs: null,
  lastSavePointMs: 0,   // ms already saved to sesiones_salud_visual this day (from this extension)
};

// Flag temporal (no persistido): indica que el popup debe mostrar el banner de inicio al abrir el navegador
let startupPromptPending = false;

let tickInterval   = null;
let browserId      = null; // Unique ID for this browser/extension instance
let foreignSession = null; // { source, accumulatedMs, isRunning } if another source is running
let dbPollCounter  = 0;    // counts ticks for DB poll scheduling

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcElapsedMs() {
  let ms = state.accumulatedMs;
  if (state.isRunning && state.startTimestamp) {
    const delta = Date.now() - state.startTimestamp;
    if (delta > 0 && delta < 16 * 3600000) ms += delta;
  }
  return Math.max(0, ms);
}

function formatDuration(totalMs) {
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ─── Browser ID ───────────────────────────────────────────────────────────────

async function loadBrowserId() {
  try {
    const stored = await chrome.storage.local.get('therapeye_browser_id');
    if (stored.therapeye_browser_id) {
      browserId = stored.therapeye_browser_id;
    } else {
      browserId = 'ext-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
      await chrome.storage.local.set({ therapeye_browser_id: browserId });
    }
  } catch (e) {
    browserId = 'ext-' + Date.now().toString(36);
  }
}

// ─── Neon DB ─────────────────────────────────────────────────────────────────

const NEON_SQL_URL    = 'https://ep-purple-lake-af84yqd7-pooler.c-2.us-west-2.aws.neon.tech/sql';
const NEON_CONN_STR   = 'postgresql://neondb_owner:npg_V7S0FsDyOZtI@ep-purple-lake-af84yqd7-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

async function neonQuery(query, params = []) {
  const res = await fetch(NEON_SQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': NEON_CONN_STR },
    body: JSON.stringify({ query, params }),
  });
  if (!res.ok) throw new Error(`Neon ${res.status}`);
  const data = await res.json();
  if (data.fields && data.rows) {
    const fieldNames = data.fields.map(f => f.name);
    return {
      ...data,
      rows: data.rows.map(row =>
        Array.isArray(row)
          ? Object.fromEntries(fieldNames.map((n, i) => [n, row[i]]))
          : row
      ),
    };
  }
  if (data.results?.[0]) return data.results[0];
  return data;
}

// ─── DB Migration ─────────────────────────────────────────────────────────────

async function runMigrations() {
  try {
    await neonQuery(`ALTER TABLE timer_state ADD COLUMN IF NOT EXISTS source VARCHAR(64)`);
  } catch (e) {
    console.warn('[Therapheye BG] Migration error (ignored):', e);
  }
}

// ─── DB: save timer state ─────────────────────────────────────────────────────
// IMPORTANT: saves state.accumulatedMs (raw) + state.startTimestamp (real start).
// Do NOT save calcElapsedMs() as accumulated_ms — that causes double-counting cross-browser.

async function saveTimerToDB() {
  try {
    const stored = await chrome.storage.local.get('therapeye_user');
    const user = stored?.therapeye_user;
    if (!user?.id) return;

    await neonQuery(
      `INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts, session_start_ts, next_break_at_ms, finalized, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id, fecha) DO UPDATE SET
         accumulated_ms = $3, is_running = $4, last_start_ts = $5,
         session_start_ts = $6, next_break_at_ms = $7, finalized = $8,
         source = $9, updated_at = NOW()`,
      [
        user.id,
        todayDate(),
        Math.round(state.accumulatedMs),          // raw accumulated (NOT calcElapsedMs!)
        state.isRunning,
        state.startTimestamp ? String(state.startTimestamp) : null,  // real start time
        state.sessionStartTimestamp ? String(state.sessionStartTimestamp) : null,
        state.nextBreakAtMs ? String(state.nextBreakAtMs) : null,
        state.finalized,
        browserId,                                // source = this extension's browser ID
      ]
    );
  } catch (e) {
    console.warn('[Therapheye BG] Error syncing to DB:', e);
  }
}

// ─── DB: poll for foreign session ─────────────────────────────────────────────
// Detects if another browser/page has the timer running.

async function pollDBForForeignSession() {
  try {
    const stored = await chrome.storage.local.get('therapeye_user');
    const user = stored?.therapeye_user;
    if (!user?.id) return;

    const result = await neonQuery(
      `SELECT accumulated_ms, is_running, last_start_ts, source
       FROM timer_state WHERE user_id = $1 AND fecha = $2 LIMIT 1`,
      [user.id, todayDate()]
    );
    if (!result.rows?.length) return;
    const row = result.rows[0];
    const dbSource    = row.source;
    const dbIsRunning = row.is_running === true || row.is_running === 'true' || row.is_running === 't';
    const dbAccMs     = Number(row.accumulated_ms) || 0;
    const dbStartTs   = row.last_start_ts ? Number(row.last_start_ts) : null;

    const isForeign = dbIsRunning && dbSource && dbSource !== browserId;

    if (isForeign && !state.isRunning) {
      // Another source is running, we are not → show "running elsewhere"
      const dbElapsed = dbAccMs + (dbStartTs ? (Date.now() - dbStartTs) : 0);
      const newForeign = { source: dbSource, accumulatedMs: dbAccMs, startTimestamp: dbStartTs, elapsedMs: dbElapsed };

      // Only broadcast if state changed
      if (!foreignSession || foreignSession.source !== dbSource) {
        foreignSession = newForeign;
        broadcastForeignSession();
      } else {
        foreignSession = newForeign;
      }
    } else if (state.isRunning || !dbIsRunning) {
      if (foreignSession) {
        foreignSession = null;
        chrome.runtime.sendMessage({ type: 'FOREIGN_SESSION_CLEARED' }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[Therapheye BG] DB poll error:', e);
  }
}

function broadcastForeignSession() {
  if (!foreignSession) return;
  chrome.runtime.sendMessage({
    type: 'RUNNING_ELSEWHERE',
    source: foreignSession.source,
    elapsedMs: foreignSession.elapsedMs,
    formatted: formatDuration(foreignSession.elapsedMs),
    accumulatedMs: foreignSession.accumulatedMs,
    startTimestamp: foreignSession.startTimestamp,
  }).catch(() => {});
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function saveState() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (e) {
    console.warn('[Therapheye BG] Error saving state:', e);
  }
}

// ─── Auto-save del día anterior al detectar cambio de fecha ──────────────────
// Evita perder tiempo acumulado cuando pasa la medianoche sin que el usuario
// haya dado "Finalizar". Guarda en daily_history y en la DB bajo la fecha anterior.

async function autoSavePreviousDay(prevDate, elapsedMs) {
  try {
    if (elapsedMs <= 0) return;

    // 1. daily_history en chrome.storage.local
    const stored = await chrome.storage.local.get('daily_history');
    const history = stored.daily_history ?? {};
    // Guardar solo si no hay un valor mayor ya registrado
    const existing = history[prevDate]?.totalMs ?? 0;
    if (elapsedMs > existing) {
      history[prevDate] = { totalMs: Math.round(elapsedMs), sessions: 0, autoSaved: true };
      const keys = Object.keys(history).sort().reverse().slice(0, 30);
      const trimmed = {};
      keys.forEach(k => { trimmed[k] = history[k]; });
      await chrome.storage.local.set({ daily_history: trimmed });
    }

    // 2. DB: guardar bajo la fecha anterior, sin sobreescribir si ya hay más tiempo
    const storedUser = await chrome.storage.local.get('therapeye_user');
    const user = storedUser?.therapeye_user;
    if (user?.id) {
      await neonQuery(
        `INSERT INTO timer_state (user_id, fecha, accumulated_ms, is_running, last_start_ts,
           session_start_ts, next_break_at_ms, finalized, source, updated_at)
         VALUES ($1, $2, $3, false, NULL, NULL, NULL, false, $4, NOW())
         ON CONFLICT (user_id, fecha) DO UPDATE SET
           accumulated_ms = GREATEST(timer_state.accumulated_ms, $3),
           is_running     = false,
           last_start_ts  = NULL,
           source         = $4,
           updated_at     = NOW()`,
        [user.id, prevDate, Math.round(elapsedMs), browserId]
      );
    }

    console.log('[Therapheye BG] Auto-guardado día anterior', prevDate, Math.round(elapsedMs / 1000) + 's');
  } catch (e) {
    console.warn('[Therapheye BG] Error en auto-save día anterior:', e);
  }
}

async function loadState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (result[STORAGE_KEY]) {
      const saved = result[STORAGE_KEY];
      if (saved.stateDate !== todayDate()) {
        // Día nuevo — auto-guardar el tiempo del día anterior antes de resetear
        const prevElapsedMs = saved.accumulatedMs || 0;
        if (prevElapsedMs > 0 && !saved.finalized) {
          await autoSavePreviousDay(saved.stateDate, prevElapsedMs);
        }
        state = { ...state, accumulatedMs: 0, startTimestamp: null, isRunning: false, sessionStartTimestamp: null, nextBreakAtMs: null, finalized: false, stateDate: todayDate(), lastActivityTs: Date.now(), inactivityWarning: false, inactivityWarnStartTs: null };
      } else {
        state = { ...state, ...saved, lastActivityTs: Date.now(), inactivityWarning: false, inactivityWarnStartTs: null };
      }
    }
  } catch (e) {
    console.warn('[Therapheye BG] Error loading state:', e);
  }
}

// ─── Activity Detection ───────────────────────────────────────────────────────

function setupIdleDetection() {
  chrome.idle.setDetectionInterval(60);
  chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === 'active') registerActivity();
  });
}

function setupTabListeners() {
  chrome.tabs.onActivated.addListener(() => registerActivity());
  chrome.webNavigation?.onCompleted?.addListener(() => registerActivity());
  chrome.tabs.onUpdated.addListener((_, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) registerActivity();
  });
}

function registerActivity() {
  const wasWarning = state.inactivityWarning;
  state.lastActivityTs = Date.now();
  state.inactivityWarning = false;
  state.inactivityWarnStartTs = null;
  if (wasWarning && state.isRunning) {
    chrome.notifications.clear('therapeye-inactivity');
    broadcastState();
  }
}

// ─── Timer Tick ───────────────────────────────────────────────────────────────

function startTick() {
  if (tickInterval) return;
  tickInterval = setInterval(tick, TICK_INTERVAL_MS);
}

function stopTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function tick() {
  if (!state.isRunning) return;

  const now     = Date.now();
  const elapsed = calcElapsedMs();
  dbPollCounter++;

  // ── Cambio de día: auto-guardar y resetear ──
  if (state.stateDate !== todayDate()) {
    const prevDate    = state.stateDate;
    const prevElapsed = elapsed;
    autoSavePreviousDay(prevDate, prevElapsed);
    // Resetear al nuevo día
    state.accumulatedMs        = 0;
    state.startTimestamp       = now;   // reiniciar conteo desde ahora
    state.sessionStartTimestamp = now;
    state.nextBreakAtMs        = WORK_MINUTES * 60000;
    state.stateDate            = todayDate();
    state.finalized            = false;
    state.lastSavePointMs      = 0;
    saveState();
    saveTimerToDB();
    broadcastState();
    return;
  }

  // ── Inactivity check ──
  const inactiveMs  = now - state.lastActivityTs;
  const inactiveMin = inactiveMs / 60000;

  if (inactiveMin >= INACTIVITY_MINUTES && !state.inactivityWarning) {
    state.inactivityWarning    = true;
    state.inactivityWarnStartTs = now;
    chrome.notifications.create('therapeye-inactivity', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '¿Sigues frente a la pantalla?',
      message: 'No se ha detectado actividad. El temporizador se pausará en 2 minutos si no confirmas.',
      priority: 2,
      requireInteraction: true,
    });
    playAlertSound();
  }

  if (state.inactivityWarning && state.inactivityWarnStartTs) {
    const warnElapsed = (now - state.inactivityWarnStartTs) / 1000;
    if (warnElapsed >= WARN_BEFORE_PAUSE_S) {
      const totalInactiveMs = (INACTIVITY_MINUTES * 60000) + (WARN_BEFORE_PAUSE_S * 1000);
      const correctedMs     = Math.max(0, elapsed - totalInactiveMs);
      state.isRunning           = false;
      state.startTimestamp      = null;
      state.accumulatedMs       = correctedMs;
      state.inactivityWarning   = false;
      state.inactivityWarnStartTs = null;
      chrome.notifications.clear('therapeye-inactivity');
      chrome.notifications.create('therapeye-paused', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Temporizador pausado',
        message: `Se pausó automáticamente por inactividad. Se descontaron ${Math.round(totalInactiveMs / 60000)} minutos.`,
        priority: 1,
      });
      saveState();
      broadcastState();
      stopTick();
      return;
    }
  }

  // ── Break reminder ──
  if (state.nextBreakAtMs !== null && elapsed >= state.nextBreakAtMs) {
    chrome.notifications.create('therapeye-break-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '¡Hora de descansar!',
      message: 'Llevas 20 minutos. Mira a 6 metros durante 20 segundos.',
      priority: 2,
    });
    // Send overlay to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_REMINDER_2020' }).catch(() => {});
      }
    });
    state.nextBreakAtMs = elapsed + WORK_MINUTES * 60000;
    saveDailyHistory(elapsed);
  }

  updateBadge(elapsed);
  broadcastState();

  // Periodic save every 30s
  if (Math.floor(Date.now() / 30000) !== Math.floor((Date.now() - 1000) / 30000)) {
    saveState();
    saveTimerToDB();
  }

  // DB poll every 60s to detect foreign sessions
  if (dbPollCounter % 60 === 0) {
    pollDBForForeignSession();
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(elapsedMs) {
  const min  = Math.floor(elapsedMs / 60000);
  const h    = Math.floor(min / 60);
  const m    = min % 60;
  const text = h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}m`;
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({
    color: state.inactivityWarning ? '#EF4444' : (state.isRunning ? '#10B981' : '#6B7280'),
  });
}

// ─── Sound ────────────────────────────────────────────────────────────────────

async function playAlertSound() {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play inactivity alert sound',
      });
    }
    chrome.runtime.sendMessage({ type: 'PLAY_ALERT' });
  } catch (e) {
    console.warn('[Therapheye BG] Error playing sound:', e);
  }
}

// ─── Broadcast state to popup ─────────────────────────────────────────────────

function broadcastState() {
  const elapsed = calcElapsedMs();
  chrome.runtime.sendMessage({
    type: 'STATE_UPDATE',
    isRunning: state.isRunning,
    elapsedMs: elapsed,
    accumulatedMs: state.accumulatedMs,      // raw (for correct DB sync)
    startTimestamp: state.startTimestamp,    // real start time (for correct DB sync)
    formatted: formatDuration(elapsed),
    inactivityWarning: state.inactivityWarning,
    nextBreakAtMs: state.nextBreakAtMs,
    finalized: state.finalized,
    lastSavePointMs: state.lastSavePointMs,
    startupPromptPending,
    foreignSession: foreignSession ? {
      source: foreignSession.source,
      elapsedMs: foreignSession.elapsedMs,
      formatted: formatDuration(foreignSession.elapsedMs),
    } : null,
  }).catch(() => {});
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATE') {
    const elapsed = calcElapsedMs();
    sendResponse({
      isRunning: state.isRunning,
      elapsedMs: elapsed,
      accumulatedMs: state.accumulatedMs,     // raw accumulated
      startTimestamp: state.startTimestamp,   // real start time
      formatted: formatDuration(elapsed),
      inactivityWarning: state.inactivityWarning,
      nextBreakAtMs: state.nextBreakAtMs,
      finalized: state.finalized,
      lastSavePointMs: state.lastSavePointMs,
      startupPromptPending,
      foreignSession: foreignSession ? {
        source: foreignSession.source,
        elapsedMs: foreignSession.elapsedMs,
        formatted: formatDuration(foreignSession.elapsedMs),
      } : null,
    });
    return true;
  }

  if (msg.type === 'DISMISS_STARTUP_PROMPT') {
    startupPromptPending = false;
    chrome.notifications.clear('therapeye-startup-prompt');
    broadcastState();
    return;
  }

  if (msg.type === 'START') {
    if (state.isRunning) return;
    const now = Date.now();
    state.isRunning            = true;
    state.startTimestamp       = now;
    state.sessionStartTimestamp = state.sessionStartTimestamp ?? now;
    state.nextBreakAtMs        = state.accumulatedMs + WORK_MINUTES * 60000;
    state.finalized            = false;
    state.lastActivityTs       = now;
    state.inactivityWarning    = false;
    state.stateDate            = todayDate();
    foreignSession             = null; // Clear any foreign session when we take over
    startupPromptPending       = false; // Usuario respondió — limpiar prompt
    chrome.notifications.clear('therapeye-startup-prompt');
    saveState();
    saveTimerToDB();
    startTick();
    broadcastState();
    updateBadge(calcElapsedMs());
  }

  if (msg.type === 'PAUSE') {
    if (!state.isRunning) return;
    state.accumulatedMs    = calcElapsedMs();
    state.isRunning        = false;
    state.startTimestamp   = null;
    state.inactivityWarning = false;
    state.inactivityWarnStartTs = null;
    chrome.notifications.clear('therapeye-inactivity');
    saveState();
    saveTimerToDB();
    saveDailyHistory(state.accumulatedMs);
    stopTick();
    broadcastState();
    updateBadge(state.accumulatedMs);
  }

  if (msg.type === 'RESET') {
    state.isRunning            = false;
    state.startTimestamp       = null;
    state.accumulatedMs        = 0;
    state.sessionStartTimestamp = null;
    state.nextBreakAtMs        = null;
    state.finalized            = false;
    state.inactivityWarning    = false;
    state.inactivityWarnStartTs = null;
    state.stateDate            = todayDate();
    state.lastSavePointMs      = 0;
    foreignSession             = null;
    chrome.notifications.clear('therapeye-inactivity');
    saveState();
    stopTick();
    broadcastState();
    updateBadge(0);
  }

  if (msg.type === 'SYNC_FROM_DB') {
    // Popup sends DB state so extension can adopt it.
    // msg.accumulatedMs = raw accumulated (NOT calcElapsed)
    // msg.startTimestamp = real start time
    // The correct elapsed = accumulatedMs + (is_running ? now - startTimestamp : 0)
    const dbRawMs  = msg.accumulatedMs || 0;
    const dbStartTs = msg.startTimestamp || null;
    const dbElapsed = dbRawMs + (msg.isRunning && dbStartTs ? Math.max(0, Date.now() - dbStartTs) : 0);
    const extElapsed = calcElapsedMs();

    const dbAhead  = dbElapsed > extElapsed + 2000;
    const dbWasRunning = !state.isRunning && msg.isRunning;
    const dbSource = msg.source;
    const isForeign = dbSource && dbSource !== browserId;

    if (isForeign && msg.isRunning && !state.isRunning) {
      // Foreign source is running, we are not → store as foreign session, don't adopt
      foreignSession = {
        source: dbSource,
        accumulatedMs: dbRawMs,
        startTimestamp: dbStartTs,
        elapsedMs: dbElapsed,
      };
      broadcastForeignSession();
      return;
    }

    if (dbAhead || dbWasRunning) {
      state.accumulatedMs  = dbRawMs;
      state.isRunning      = msg.isRunning || false;
      // Keep the REAL startTimestamp from DB — don't reset to Date.now()
      // so calcElapsedMs() gives the correct total without double-counting.
      state.startTimestamp = state.isRunning ? (dbStartTs || Date.now()) : null;
      state.stateDate      = todayDate();
      foreignSession       = null;
      saveState();
      if (state.isRunning) startTick(); else stopTick();
      broadcastState();
      updateBadge(calcElapsedMs());
    }
    return;
  }

  if (msg.type === 'TAKE_OVER') {
    // User clicked "Usar aquí" in popup — adopt the foreign session as our own
    if (!foreignSession) return;
    const now = Date.now();
    const elapsed = foreignSession.accumulatedMs + (foreignSession.startTimestamp ? Math.max(0, now - foreignSession.startTimestamp) : 0);
    // Snap to "paused at current elapsed" then user can start
    state.accumulatedMs  = elapsed;
    state.isRunning      = false;
    state.startTimestamp = null;
    state.stateDate      = todayDate();
    foreignSession       = null;
    saveState();
    saveTimerToDB();
    stopTick();
    broadcastState();
    updateBadge(state.accumulatedMs);
  }

  if (msg.type === 'CONFIRM_ACTIVE') {
    registerActivity();
    broadcastState();
  }

  // ── Usuario detectado en nueva pestaña/navegador → buscar sesión foránea ─────
  if (msg.type === 'USER_SYNCED') {
    // content.js acaba de escribir therapeye_user a chrome.storage.local
    // Intentamos inmediatamente detectar si hay una sesión corriendo en otro navegador
    pollDBForForeignSession();
    return;
  }

  // ── Guardar sesión en sesiones_salud_visual ──────────────────────────────────
  // msg.final = true  → save + reset timer
  // msg.final = false → save + keep timer running (update lastSavePointMs)
  if (msg.type === 'SAVE_SESSION') {
    (async () => {
      try {
        const currentMs = calcElapsedMs();
        const delta = Math.max(0, currentMs - (state.lastSavePointMs || 0));

        if (delta < 60_000) {
          sendResponse({ ok: false, reason: 'too_short' });
          return;
        }

        const stored = await chrome.storage.local.get('therapeye_user');
        const user = stored?.therapeye_user;
        if (!user?.id) { sendResponse({ ok: false, reason: 'no_user' }); return; }

        const today = todayDate();
        const now = Date.now();
        const sessionStart = state.sessionStartTimestamp ?? (now - currentMs);

        // Check existing session for today
        const existing = await neonQuery(
          `SELECT id, duration_ms FROM sesiones_salud_visual
           WHERE user_id = $1 AND DATE(created_at AT TIME ZONE 'America/Mexico_City') = $2
           ORDER BY created_at DESC LIMIT 1`,
          [user.id, today]
        );

        const existingRow = existing.rows?.[0];
        const existingMs = Number(existingRow?.duration_ms) || 0;
        const newTotalMs = existingMs + delta;

        if (existingRow?.id) {
          await neonQuery(
            `UPDATE sesiones_salud_visual SET duration_ms = $1, ended_at = $2 WHERE id = $3`,
            [newTotalMs, new Date(now).toISOString(), existingRow.id]
          );
        } else {
          await neonQuery(
            `INSERT INTO sesiones_salud_visual (user_id, started_at, ended_at, duration_ms, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [user.id, new Date(sessionStart).toISOString(), new Date(now).toISOString(), newTotalMs]
          );
        }

        if (msg.final) {
          // Finalizar: resetear timer
          state.accumulatedMs        = 0;
          state.startTimestamp       = null;
          state.isRunning            = false;
          state.sessionStartTimestamp = null;
          state.nextBreakAtMs        = null;
          state.lastSavePointMs      = 0;
          stopTick();
          await saveState();
          await saveTimerToDB();
          updateBadge(0);
        } else {
          // Temporal: actualizar save point, seguir corriendo
          state.lastSavePointMs = currentMs;
          await saveState();
        }

        broadcastState();
        sendResponse({ ok: true, savedMs: newTotalMs });
      } catch (e) {
        console.warn('[Therapheye BG] SAVE_SESSION error:', e);
        sendResponse({ ok: false, reason: 'error' });
      }
    })();
    return true; // async sendResponse
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === 'therapeye-inactivity') {
    registerActivity();
    chrome.notifications.clear('therapeye-inactivity');
    broadcastState();
  }
  if (notifId === 'therapeye-startup-prompt') {
    // Clic en la notificación → iniciar el timer directamente
    chrome.notifications.clear('therapeye-startup-prompt');
    startupPromptPending = false;
    if (!state.isRunning && !state.finalized) {
      const now = Date.now();
      state.isRunning             = true;
      state.startTimestamp        = now;
      state.sessionStartTimestamp = state.sessionStartTimestamp ?? now;
      state.nextBreakAtMs         = state.accumulatedMs + WORK_MINUTES * 60000;
      state.finalized             = false;
      state.lastActivityTs        = now;
      state.stateDate             = todayDate();
      foreignSession              = null;
      saveState();
      saveTimerToDB();
      startTick();
      broadcastState();
      updateBadge(calcElapsedMs());
    }
    // También intentar abrir el popup para feedback visual
    chrome.action.openPopup?.().catch(() => {});
  }
});

// ─── Startup prompt: ¿Iniciar timer al abrir el navegador? ───────────────────

async function showBrowserOpenPrompt() {
  try {
    const stored = await chrome.storage.local.get('therapeye_user');
    const user = stored?.therapeye_user;
    if (!user?.id) return;       // sin cuenta logueada → no preguntar
    if (state.finalized) return; // ya finalizó hoy → no preguntar
    if (state.isRunning) return; // ya está corriendo → no preguntar

    // Activar el banner en el popup (respaldo visual además de la notificación)
    startupPromptPending = true;
    broadcastState();

    chrome.notifications.create('therapeye-startup-prompt', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '¿Iniciar temporizador visual?',
      message: 'Detectamos que abriste el navegador. Haz clic en esta notificación para iniciar el temporizador.',
      priority: 2,
      requireInteraction: true,
    });
  } catch (e) {
    console.warn('[Therapheye BG] Error mostrando prompt de inicio:', e);
  }
}

// Nota: no usamos onButtonClicked porque los botones en notificaciones
// no son soportados de forma fiable en Opera y otros Chromium-based.
// El usuario interactúa desde el banner del popup (que siempre funciona).

// ─── Auto-pause cuando se cierran todas las ventanas del navegador ────────────
// Garantiza que el timer se pausa exactamente al cerrar el navegador,
// sin contar el tiempo que el browser estuvo cerrado.

chrome.windows.onRemoved.addListener(async () => {
  try {
    const windows = await chrome.windows.getAll();
    if (windows.length === 0 && state.isRunning) {
      console.log('[Therapheye BG] Todas las ventanas cerradas — pausando timer');
      state.accumulatedMs = calcElapsedMs();   // capturar tiempo exacto
      state.isRunning = false;
      state.startTimestamp = null;
      state.inactivityWarning = false;
      state.inactivityWarnStartTs = null;
      chrome.notifications.clear('therapeye-inactivity');
      stopTick();
      await saveState();
      await saveTimerToDB();
    }
  } catch (e) {
    console.warn('[Therapheye BG] Error en windows.onRemoved:', e);
  }
});

// ─── Initialization ───────────────────────────────────────────────────────────

// ─── Daily History (para EstadisticasAvanzadas) ───────────────────────────────
// Guarda un snapshot del tiempo acumulado del día en chrome.storage.local
// para que el content script lo sincronice al localStorage de Therapheye.

async function saveDailyHistory(elapsedMs) {
  try {
    const today = todayDate();
    const stored = await chrome.storage.local.get('daily_history');
    const history = stored.daily_history ?? {};
    // Guardar sólo los últimos 30 días
    history[today] = { totalMs: Math.round(elapsedMs), sessions: 0 };
    const keys = Object.keys(history).sort().reverse().slice(0, 30);
    const trimmed = {};
    keys.forEach(k => { trimmed[k] = history[k]; });
    await chrome.storage.local.set({ daily_history: trimmed });
  } catch (e) {
    console.warn('[Therapheye BG] Error saving daily history:', e);
  }
}

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;
  await loadBrowserId();
  await loadState();
  await runMigrations();
  setupIdleDetection();
  setupTabListeners();
  if (state.isRunning) startTick();
  updateBadge(calcElapsedMs());
  // Initial DB poll to detect foreign sessions
  pollDBForForeignSession();
}

chrome.runtime.onInstalled.addListener(() => init());

// onStartup = el usuario abrió el navegador → init + crash recovery + prompt
chrome.runtime.onStartup.addListener(async () => {
  await init();

  // Crash recovery: si el timer quedó marcado como "running" en storage pero el navegador
  // ya fue cerrado (windows.onRemoved no alcanzó a completar), pausar SIN añadir el
  // tiempo que el browser estuvo apagado. state.accumulatedMs ya tiene el valor correcto
  // del último save; state.startTimestamp es stale → NO usar calcElapsedMs() aquí.
  if (state.isRunning) {
    console.log('[Therapheye BG] Crash recovery: timer estaba activo. Pausando en tiempo guardado.');
    state.isRunning = false;
    state.startTimestamp = null;
    state.inactivityWarning = false;
    state.inactivityWarnStartTs = null;
    stopTick();
    await saveState();
    await saveTimerToDB();
    updateBadge(state.accumulatedMs);
  }

  // Mostrar prompt "¿Quieres iniciar?" después de que el estado esté estabilizado
  setTimeout(showBrowserOpenPrompt, 2000);
});

// Service worker restart (mismo navegador, sesión en curso) → solo reinit, sin prompt
init();
