// =============================================
// THERAPHEYE SCREEN GUARD — Content Script
// 1. Overlay de recordatorio 20-20-20 en cualquier pestaña
// 2. En páginas de Therapheye: sincroniza datos al localStorage
// =============================================

// ─── Detección de Therapheye ─────────────────────────────────────────────────

function isTherapheye() {
  const h = window.location.hostname;
  return h.includes('therapheye') || h === 'localhost' || h === '127.0.0.1';
}

if (isTherapheye()) {
  syncToLocalStorage();
  // Sync every 60s so the web always has fresh screen time data
  setInterval(syncToLocalStorage, 60_000);
  // Re-sync when user comes back to the tab
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') syncToLocalStorage();
  });
}

function syncToLocalStorage() {
  try {
    chrome.storage.local.get(['daily_history', 'therapeye_ext_timer', 'therapeye_user'], function(data) {
      if (chrome.runtime.lastError) return;
      try {
        // Sincronizar therapeye_user de localStorage → chrome.storage.local
        // Esto permite que background.js detecte sesiones foráneas en este navegador
        try {
          var rawUser = localStorage.getItem('therapeye_user');
          if (rawUser) {
            var localUser = JSON.parse(rawUser);
            var storedUser = data.therapeye_user;
            if (localUser && localUser.id && (!storedUser || storedUser.id !== localUser.id)) {
              chrome.storage.local.set({ therapeye_user: localUser }, function() {
                if (!chrome.runtime.lastError) {
                  chrome.runtime.sendMessage({ type: 'USER_SYNCED', user: localUser });
                }
              });
            }
          }
        } catch(eu) {}

        // Combinar daily_history con el estado actual del timer de hoy
        var history = Object.assign({}, data.daily_history || {});
        var timer = data.therapeye_ext_timer;
        if (timer && timer.stateDate) {
          var today = timer.stateDate;
          var elapsed = Number(timer.accumulatedMs) || 0;
          if (timer.isRunning && timer.startTimestamp) {
            var delta = Date.now() - Number(timer.startTimestamp);
            if (delta > 0 && delta < 16 * 3600000) elapsed += delta;
          }
          if (!history[today]) history[today] = { totalMs: 0, sessions: 0 };
          history[today].totalMs = Math.max(history[today].totalMs, Math.round(elapsed));
        }
        if (Object.keys(history).length > 0) {
          localStorage.setItem('therapheye_ext_screentime', JSON.stringify(history));
        }
        // Escribir el estado actual del timer para que el Dashboard lo lea directamente
        if (timer) {
          localStorage.setItem('therapeye_ext_timer', JSON.stringify(timer));
        }
        localStorage.setItem('therapheye_ext_installed', '1');
        window.dispatchEvent(new CustomEvent('therapheye-ext-sync', { detail: { daily: history } }));
      } catch(e) {}
    });
  } catch(e) {}
}

// ─── Throttled sync (max once per 10s for STATE_UPDATE messages) ─────────────

var _lastThrottledSync = 0;
function throttledSync() {
  var now = Date.now();
  if (now - _lastThrottledSync >= 10_000) {
    _lastThrottledSync = now;
    syncToLocalStorage();
  }
}

// ─── Bridge: la app web puede disparar eventos para comandar la extensión ─────

if (isTherapheye()) {
  // 'therapheye-save-session' → relay SAVE_SESSION a background
  document.addEventListener('therapheye-save-session', function(e) {
    var detail = e.detail || {};
    chrome.runtime.sendMessage({ type: 'SAVE_SESSION', final: detail.final !== false }, function(resp) {
      if (chrome.runtime.lastError) return;
      // Notificar a la app del resultado + refrescar timer en localStorage
      if (resp && resp.ok) syncToLocalStorage();
      try {
        localStorage.setItem('therapeye_ext_save_result', JSON.stringify({
          ok: resp?.ok ?? false,
          savedMs: resp?.savedMs ?? 0,
          final: detail.final !== false,
          ts: Date.now(),
        }));
        window.dispatchEvent(new CustomEvent('therapheye-ext-save-result', { detail: resp }));
      } catch(e2) {}
    });
  });
}

// ─── Overlay 20-20-20 ────────────────────────────────────────────────────────

var reminderVisible = false;
var reminderEl = null;
var countdownInterval = null;

chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === 'SHOW_REMINDER_2020') {
    showReminder();
  }
  // Keep screen time data fresh in the web app (throttled to every 10s)
  if (isTherapheye() && msg.type === 'STATE_UPDATE') {
    throttledSync();
  }
});

var EJERCICIOS_SUGERIDOS = [
  { emoji: '👀', nombre: 'Enfoque lejano', desc: 'Mira un objeto a más de 6m y enfócalo durante 20 seg.', ruta: '/exercises' },
  { emoji: '🔄', nombre: 'Rotación ocular', desc: 'Rota los ojos lentamente en círculo, 5 veces a cada lado.', ruta: '/exercises' },
  { emoji: '🤏', nombre: 'Palming', desc: 'Cubre los ojos con las palmas calientes durante 20 seg.', ruta: '/exercises' },
  { emoji: '↔️', nombre: 'Convergencia', desc: 'Acerca un dedo lentamente a tu nariz siguiéndolo con los ojos.', ruta: '/exercises' },
  { emoji: '🌟', nombre: 'Parpadeo consciente', desc: 'Parpadea 10 veces lento y deliberadamente para hidratar.', ruta: '/exercises' },
  { emoji: '📐', nombre: 'Ocho infinito', desc: 'Traza un ocho infinito con la vista durante 20 segundos.', ruta: '/exercises' },
];

function showReminder() {
  if (reminderVisible) return;
  reminderVisible = true;

  var ejercicio = EJERCICIOS_SUGERIDOS[Math.floor(Math.random() * EJERCICIOS_SUGERIDOS.length)];
  var appUrl = 'https://therapheye.netlify.app';

  var overlay = document.createElement('div');
  overlay.id = 'therapheye-reminder-overlay';
  overlay.innerHTML = [
    '<div class="thr-backdrop"></div>',
    '<div class="thr-card">',
      '<div class="thr-eyeicon">👁</div>',
      '<div class="thr-tag">Therapheye · Regla 20-20-20</div>',
      '<div class="thr-title">Descansa tus ojos</div>',
      '<div class="thr-body">Mira algo a <b>6 metros</b> de distancia durante <b>20 segundos</b>.</div>',
      '<div class="thr-ejercicio">',
        '<span class="thr-ej-emoji">' + ejercicio.emoji + '</span>',
        '<div class="thr-ej-info">',
          '<b class="thr-ej-nombre">' + ejercicio.nombre + '</b>',
          '<span class="thr-ej-desc">' + ejercicio.desc + '</span>',
        '</div>',
        '<a class="thr-ej-link" href="' + appUrl + ejercicio.ruta + '" target="_blank">Ver más →</a>',
      '</div>',
      '<div class="thr-countdown-wrap">',
        '<svg class="thr-ring" viewBox="0 0 44 44">',
          '<circle class="thr-ring-bg" cx="22" cy="22" r="18" fill="none" stroke-width="3"/>',
          '<circle class="thr-ring-fill" id="thr-ring-fill" cx="22" cy="22" r="18" fill="none" stroke-width="3"',
            ' stroke-dasharray="113.1" stroke-dashoffset="0"',
            ' transform="rotate(-90 22 22)"/>',
        '</svg>',
        '<span class="thr-countdown" id="thr-countdown-num">20</span>',
      '</div>',
      '<p class="thr-hint">El recordatorio desaparece automáticamente</p>',
      '<button class="thr-btn" id="thr-dismiss-btn">✓ Listo, lo hice</button>',
    '</div>',
  ].join('');

  document.body.appendChild(overlay);
  reminderEl = overlay;

  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    var card = overlay.querySelector('.thr-card');
    if (card) { card.style.transform = 'translateY(0)'; card.style.opacity = '1'; }
  });

  var count = 20;
  var ringFill = document.getElementById('thr-ring-fill');
  var circumference = 113.1;

  countdownInterval = setInterval(function() {
    count--;
    var numEl = document.getElementById('thr-countdown-num');
    if (numEl) numEl.textContent = count;
    if (ringFill) {
      var offset = circumference - (count / 20) * circumference;
      ringFill.setAttribute('stroke-dashoffset', offset.toFixed(2));
    }
    if (count <= 0) { clearInterval(countdownInterval); hideReminder(); }
  }, 1000);

  document.getElementById('thr-dismiss-btn').addEventListener('click', function() {
    clearInterval(countdownInterval);
    hideReminder();
  });

  // Click en backdrop también cierra
  overlay.querySelector('.thr-backdrop').addEventListener('click', function() {
    clearInterval(countdownInterval);
    hideReminder();
  });
}

function hideReminder() {
  if (!reminderEl) return;
  reminderEl.style.opacity = '0';
  var card = reminderEl.querySelector('.thr-card');
  if (card) { card.style.transform = 'translateY(20px)'; card.style.opacity = '0'; }
  var el = reminderEl;
  setTimeout(function() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    reminderEl = null;
    reminderVisible = false;
  }, 400);
}
