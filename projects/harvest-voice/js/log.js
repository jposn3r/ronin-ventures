/* ========================================
   HarvestVoice — Diagnostics
   ----------------------------------------
   Every log goes two places: the browser console
   (prefixed [HV] so it's greppable amid extension
   noise) and an on-screen panel.

   The on-screen panel is not a nicety. The target
   device is a phone in a drying room with no
   devtools attached — if voice misbehaves there,
   this is the only way to see why.

   Toggle it by tapping the mic chip in the header.
   ======================================== */

const Log = {
  entries: [],
  max: 300,
  t0: performance.now(),
  panelOpen: false,

  _push(level, msg, data) {
    const at = Math.round(performance.now() - this.t0);
    const entry = { at, level, msg, data };
    this.entries.push(entry);
    if (this.entries.length > this.max) this.entries.shift();

    const line = `[HV +${at}ms] ${msg}`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (data !== undefined) fn(line, data); else fn(line);

    this._render(entry);
  },

  info(msg, data) { this._push('info', msg, data); },
  warn(msg, data) { this._push('warn', msg, data); },
  error(msg, data) { this._push('error', msg, data); },

  _render(entry) {
    const body = document.getElementById('debug-body');
    if (!body) return;
    const row = document.createElement('div');
    row.className = 'debug-row debug-' + entry.level;
    const data = entry.data === undefined ? ''
      : ' ' + (typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data));
    row.textContent = `+${String(entry.at).padStart(6)}ms  ${entry.msg}${data}`;
    body.appendChild(row);
    // Only autoscroll if the user hasn't scrolled up to read something.
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
    if (nearBottom) body.scrollTop = body.scrollHeight;
  },

  toggle(force) {
    const panel = document.getElementById('debug-panel');
    if (!panel) return;
    this.panelOpen = force !== undefined ? force : !this.panelOpen;
    panel.classList.toggle('hidden', !this.panelOpen);
    if (this.panelOpen) this.repaint();
  },

  repaint() {
    const body = document.getElementById('debug-body');
    if (!body) return;
    body.innerHTML = '';
    this.entries.forEach((e) => this._render(e));
  },

  asText() {
    return this.entries
      .map((e) => `+${e.at}ms [${e.level}] ${e.msg}` + (e.data !== undefined ? ' ' + JSON.stringify(e.data) : ''))
      .join('\n');
  },

  clear() { this.entries = []; this.repaint(); },
};

// Surface anything the app throws — otherwise a silent exception in an event
// handler looks exactly like "nothing happened".
window.addEventListener('error', (e) => {
  Log.error('window.onerror', { message: e.message, source: e.filename, line: e.lineno });
});
window.addEventListener('unhandledrejection', (e) => {
  Log.error('unhandledrejection', String(e.reason && e.reason.message ? e.reason.message : e.reason));
});
