/* ========================================
   HarvestVoice — UI wiring
   ======================================== */

const $ = (id) => document.getElementById(id);
const speech = new SpeechCapture();
let pendingSetup = null;   // extracted-but-unconfirmed batch header
let activePTT = null;      // 'setup' | 'capture'

/* ============ Boot ============ */

function init() {
  Log.info('app init', { userAgent: navigator.userAgent, url: location.href });
  Store.load();
  $('facility-name').textContent = CONFIG.facility.name;

  populateSelect($('f-strain'), CONFIG.strains, '— pick a strain —');
  populateSelect($('f-room'), CONFIG.rooms, '— pick a room —');
  populateSelect($('f-dest'), CONFIG.dryingRooms, '— pick a drying room —');
  populateSelect($('f-unit'), CONFIG.facility.allowedUnits, '— pick a unit —');
  populateSelect($('b-strain'), CONFIG.strains, null);
  populateSelect($('b-room'), CONFIG.rooms, null);
  populateSelect($('b-dest'), CONFIG.dryingRooms, null);
  populateSelect(
    $('s-employee'),
    CONFIG.employees.map((e) => e.name),
    null,
    CONFIG.employees.map((e) => e.id),
  );

  wireSpeech();
  wirePTT($('setup-ptt'), 'setup');
  wirePTT($('capture-ptt'), 'capture');
  wireButtons();
  loadSettingsIntoForm();
  updateMicPill();
  updateSyncPill();

  // A session survives a reload — that's the Phase 2 crash-recovery seam.
  if (Store.state.session) enterCaptureView();
  else enterSetupView();
}

function populateSelect(el, values, placeholder, ids) {
  el.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    el.appendChild(opt);
  }
  values.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = ids ? ids[i] : v;
    opt.textContent = v;
    el.appendChild(opt);
  });
}

/* ============ Speech routing ============ */

/* Per-button push-to-talk state. Kept outside wirePTT so the shared speech
   callbacks can restore each button's label when recording actually ends. */
const PTT = {};
const TAP_MS = 400;   // shorter than this is a tap, not a hold
let lastPeak = 0;     // peak input level of the most recent take, 0-100

function wireSpeech() {
  speech.onStateChange = (listening) => {
    const s = PTT[activePTT];
    if (!s) return;
    s.btn.classList.toggle('listening', listening);
    if (listening) {
      s.label.textContent = s.latched ? 'Listening — tap to finish' : 'Listening…';
      if (activePTT === 'capture') setFeedback('Listening…', '');
      Meter.start();
    } else {
      s.latched = false;
      s.label.textContent = s.original;
      const peak = Meter.stop();
      Log.info('input peak during take', peak + '%');
      if (peak > 0 && peak < 2) {
        Log.error('Mic produced almost no signal — wrong input device, or it is muted.');
      }
      lastPeak = peak;
    }
  };

  // Drive the level bar on whichever button is active.
  Meter.onLevel = (rms) => {
    const s = PTT[activePTT];
    if (!s) return;
    // sqrt curve so normal speech fills a useful part of the bar
    s.btn.style.setProperty('--level', Math.min(1, Math.sqrt(rms) * 2.2).toFixed(3));
  };

  speech.onEmpty = () => {
    const hint = lastPeak < 2
      ? `Nothing heard — input level was ${lastPeak}%. Check your microphone (tap 🎤 → Test mic).`
      : 'Didn\'t catch that. Try again, a little closer to the mic.';
    Log.warn('empty take surfaced to user', { lastPeak });
    if (activePTT === 'capture') setFeedback(hint, 'bad');
    else toast(hint, 'bad');
  };

  speech.onInterim = (text) => {
    if (activePTT === 'setup') showTranscript(text + ' …');
    else setFeedback('“' + text + '”', '');
  };

  speech.onFinal = (text) => {
    Log.info(`routing transcript to ${activePTT} handler`, text);
    if (activePTT === 'setup') handleSetupUtterance(text);
    else handleCaptureUtterance(text);
  };

  speech.onError = (err) => {
    if (err === 'not-allowed') { handleMicDenied(); return; }
    if (err === 'virtual-device') {
      setMicPill('Wrong input device — see diagnostics', 'pill-bad');
      toast('Your default mic is a virtual device and will record silence. Change it in Windows sound settings.', 'bad');
      return;
    }
    if (err === 'network') {
      toast('No connection — Chrome speech needs internet. Use the keypad.', 'bad');
      showKeypad(activePTT || 'capture', true);
      return;
    }
    toast('Speech error: ' + err, 'bad');
  };
}

function handleMicDenied() {
  setMicPill('Microphone blocked — allow it in the address bar, then reload', 'pill-bad');
  toast('Microphone blocked. Use the keypad, or allow the mic and reload.', 'bad');
  showKeypad(activePTT || 'capture', true);
}

/**
 * Hold to talk, or tap to latch.
 *
 * Holding a button while handling a wet plant is awkward, so a short tap
 * switches to hands-free: it keeps listening until the next tap. Pointer
 * capture keeps a thumb that drifts off the edge from cancelling the take.
 */
function wirePTT(btn, which) {
  const label = btn.querySelector('.ptt-label');
  PTT[which] = { btn, label, original: label.textContent, latched: false, pressedAt: 0, primed: false };
  const s = PTT[which];

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Log.info(`pointerdown on ${which} PTT`, { pointerType: e.pointerType, latched: s.latched });
    if (!speech.supported) { Log.error('ignored — SpeechRecognition unsupported in this browser'); return; }
    activePTT = which;

    if (s.latched) {          // second tap ends a latched take
      Log.info('second tap — ending latched take');
      s.latched = false;
      speech.stop(0);
      return;
    }

    // Prompt for the mic once, on a real user gesture.
    if (!s.primed) {
      s.primed = true;
      speech.prime().then((p) => { if (p === 'denied') handleMicDenied(); });
    }

    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
    s.pressedAt = Date.now();
    speech.start();
  });

  const release = (e) => {
    if (!speech.supported || s.latched || !s.pressedAt) {
      Log.info(`${e.type} ignored`, { latched: s.latched, pressed: Boolean(s.pressedAt) });
      return;
    }
    e.preventDefault();
    try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* no-op */ }
    const held = Date.now() - s.pressedAt;
    s.pressedAt = 0;
    Log.info(`${e.type} on ${which} PTT`, { heldMs: held, mode: held < TAP_MS ? 'tap → latch' : 'hold → stop' });

    if (held < TAP_MS) {
      s.latched = true;
      label.textContent = 'Listening — tap to finish';
      return;
    }
    speech.stop();
  };

  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updateMicPill() {
  if (!speech.supported) {
    setMicPill('Voice unsupported in this browser — use the keypad', 'pill-bad');
    $('setup-ptt').disabled = true;
    $('capture-ptt').disabled = true;
    $('setup-ptt').querySelector('.ptt-label').textContent = 'Voice unavailable';
    $('capture-ptt').querySelector('.ptt-label').textContent = 'Voice unavailable';
    // No mic means the keypad is the only path — open it rather than hide it.
    showKeypad('setup', true);
    showKeypad('capture', true);
  } else {
    setMicPill('Microphone ready', 'pill-ok');
  }
}

function setMicPill(title, cls) {
  const el = $('mic-pill');
  el.title = title;
  el.className = 'pill ' + cls;
}

/** Degraded / no-voice input. Toggling focuses the field so the keyboard opens. */
function showKeypad(which, force) {
  const row = $(which + '-keypad');
  const open = force !== undefined ? force : row.classList.contains('hidden');
  row.classList.toggle('hidden', !open);
  if (open) setTimeout(() => $(which + '-text').focus(), 50);
}

/* ============ Batch setup ============ */

async function handleSetupUtterance(text) {
  showTranscript(text);
  setSetupSource('extracting…');
  const result = await extractBatchSetup(text);
  Log.info('batch setup extracted', result);
  pendingSetup = result;

  $('f-strain').value = result.strain || '';
  $('f-room').value = result.room || '';
  $('f-dest').value = result.destinationRoom || '';
  $('f-unit').value = result.unit || CONFIG.facility.defaultUnit;
  $('f-notes').value = result.notes || '';

  setSetupSource(result.source === 'claude' ? 'claude-opus-5' : 'local matching');
  if (result.warning) toast(result.warning, 'bad');

  $('setup-card').classList.remove('hidden');
  $('setup-open').classList.remove('hidden');
  reportMissing();

  requestAnimationFrame(() => {
    $('setup-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function reportMissing() {
  const missing = [];
  if (!$('f-strain').value) missing.push('strain');
  if (!$('f-room').value) missing.push('grow room');
  if (!$('f-dest').value) missing.push('drying room');

  const el = $('setup-missing');
  if (missing.length) {
    el.textContent = `Still need: ${missing.join(', ')}. Say it again or pick from the dropdown.`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }

  // Never offer an action that can only fail. Disabled rather than hidden so
  // it doesn't shift position under the worker's thumb as fields fill in.
  $('setup-open').disabled = missing.length > 0;
  return missing;
}

/** Return the setup view to its empty state. Shared by "Start over" and by
    re-entering the view after a batch closes — they must not drift apart. */
function resetSetup() {
  $('setup-card').classList.add('hidden');
  $('setup-open').classList.add('hidden');
  $('setup-open').disabled = true;
  $('setup-transcript').classList.add('hidden');
  document.querySelector('#setup-view .example')?.classList.remove('hidden');
  $('setup-text').value = '';
  pendingSetup = null;
}

function showTranscript(text) {
  const el = $('setup-transcript');
  el.textContent = '“' + text + '”';
  el.classList.remove('hidden');
  // The worked example has done its job once there's a real transcript.
  document.querySelector('#setup-view .example')?.classList.add('hidden');
}

function setSetupSource(label) { $('setup-source').textContent = label; }

function openBatch() {
  if (reportMissing().length) {
    toast('Fill the missing fields first.', 'bad');
    return;
  }
  Store.openSession({
    strain: $('f-strain').value,
    room: $('f-room').value,
    destinationRoom: $('f-dest').value,
    unit: $('f-unit').value || CONFIG.facility.defaultUnit,
    notes: $('f-notes').value,
  });
  WakeLock.acquire();
  enterCaptureView();
  toast('Batch open. Scan or speak weights.', 'ok');
}

/* ============ Capture loop ============ */

function handleCaptureUtterance(text) {
  const session = Store.state.session;
  if (!session) { Log.warn('capture utterance ignored — no open batch'); return; }
  const result = parsePlantUtterance(text, session);
  Log.info('parsed', { normalized: normalizeNumbers(text), kind: result.kind, weight: result.weight, tag: result.plantTag, flagged: result.implausible });

  switch (result.kind) {
    case 'empty':
      return;

    case 'undo': {
      const removed = Store.undoLastPlant();
      renderCapture();
      setFeedback(removed ? `Removed ${removed.weight}${removed.unit}.` : 'Nothing to undo.', removed ? 'warn' : '');
      return;
    }

    case 'close':
      showCloseModal();
      return;

    case 'repeat': {
      const last = Store.state.plants[Store.state.plants.length - 1];
      setFeedback(last ? `Last: ${last.weight}${last.unit}${last.plantTag ? ' · tag ' + last.plantTag : ''}` : 'Nothing logged yet.', '');
      return;
    }

    case 'unit_conflict':
      setFeedback(
        `You said "${result.spokenUnit}" but this batch is in "${result.sessionUnit}". Not logged — say it again in ${result.sessionUnit}, or close the batch.`,
        'bad',
      );
      return;

    case 'ambiguous':
      setFeedback(
        `Heard two numbers (${result.candidates.join(' and ')}) and can't tell which is the weight. Say it with the unit — "${result.candidates[result.candidates.length - 1]} grams".`,
        'bad',
      );
      return;

    case 'unparsed':
      setFeedback(`Didn't catch a weight in “${result.transcript}”. Try again.`, 'bad');
      return;

    case 'plant':
      logPlant(result);
      return;
  }
}

function logPlant(result) {
  // "plant four" is the worker counting out loud, not a tag. The row number is
  // already automatic — but if their count disagrees with ours, one of us has
  // lost track, and that's worth saying out loud.
  const expected = Store.state.plants.length + 1;
  const miscount = result.ordinal !== null && result.ordinal !== undefined && result.ordinal !== expected;
  if (result.ordinal) Log.info('spoken ordinal', { said: result.ordinal, expected, miscount });

  const row = Store.addPlant({
    weight: result.weight,
    unit: result.unit,
    plantTag: result.plantTag,
    flagged: result.implausible,
  });
  renderCapture(row.id);

  if (miscount) {
    setFeedback(
      `✓ ${row.weight}${row.unit} — but you said plant ${result.ordinal} and this is #${expected}. Check the count.`,
      'warn',
    );
    return;
  }

  if (result.implausible) {
    setFeedback(
      `Logged ${row.weight}${row.unit} — but that's outside ${result.bounds.min}–${result.bounds.max}${row.unit}. Flagged for review. Say "scratch that" if it's wrong.`,
      'warn',
    );
  } else {
    setFeedback(`✓ ${row.weight}${row.unit}${row.plantTag ? ' · tag ' + row.plantTag : ''}`, 'ok');
  }

  // Fire-and-forget. Sheets never blocks the loop.
  flushPendingPlants().then((r) => {
    if (r && r.synced) renderCapture();
    else if (r && r.error) { renderCapture(); updateSyncPill(true); }
  });
}

function setFeedback(text, cls) {
  const el = $('capture-feedback');
  el.textContent = text;
  el.className = 'feedback' + (cls ? ' ' + cls : '');
}

/* ============ Rendering ============ */

function enterSetupView() {
  $('setup-view').classList.remove('hidden');
  $('capture-view').classList.add('hidden');
  resetSetup();
  renderHistory();
  WakeLock.release();
}

function enterCaptureView() {
  const s = Store.state.session;
  $('setup-view').classList.add('hidden');
  $('capture-view').classList.remove('hidden');
  $('c-batch').textContent = s.batchId;
  $('c-strain').textContent = s.strain;
  $('c-room').textContent = s.room;
  $('c-dest').textContent = s.destinationRoom;
  $('c-unit').textContent = s.unit;
  $('c-employee').textContent = s.employee;
  $('stat-unit').textContent = s.unit + ' total';
  renderCapture();
}

function renderCapture(newestId) {
  const { count, total } = Store.totals();
  $('stat-count').textContent = count;
  $('stat-total').textContent = total;

  const body = $('plants-body');
  body.innerHTML = '';
  const plants = Store.state.plants;
  $('plants-empty').classList.toggle('hidden', plants.length > 0);

  // Newest first — on a phone the last few entries are the only ones that
  // matter, and they should never require a scroll to see.
  [...plants].reverse().forEach((p, i) => {
    const tr = document.createElement('tr');
    if (p.flagged) tr.classList.add('flagged');
    if (p.id === newestId) tr.classList.add('newest');
    const time = new Date(p.timestamp)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const sync = p.sync === 'synced' ? '●' : p.sync === 'failed' ? '✕' : '○';
    tr.innerHTML = `
      <td class="c-index">${plants.length - i}</td>
      <td class="c-time">${time}</td>
      <td class="c-tag">${p.plantTag || ''}</td>
      <td class="c-weight">${p.flagged ? '⚠ ' : ''}${p.weight} ${p.unit}</td>
      <td class="c-sync sync-${p.sync}" title="${p.sync}">${sync}</td>
    `;
    body.appendChild(tr);
  });
}

/* ============ History ============ */

function renderHistory() {
  const batches = Store.recentBatches();
  const section = $('history');
  section.classList.toggle('hidden', batches.length === 0);
  if (!batches.length) return;

  $('history-count').textContent = `${batches.length} stored`;
  const list = $('history-list');
  list.innerHTML = '';

  batches.forEach((b) => {
    const row = document.createElement('button');
    row.className = 'history-row';
    row.dataset.batchId = b.batchId;
    const when = new Date(b.closedAt).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const sync = b.sync === 'synced' ? '●' : b.sync === 'failed' ? '✕' : '○';
    row.innerHTML = `
      <span class="history-main">
        <span class="history-strain">${b.strain}</span>
        <span class="history-id">${b.batchId}</span>
      </span>
      <span class="history-figures">
        <span class="history-total">${b.totalWeight} ${b.unit}</span>
        <span class="history-meta">${b.rowsLost ? '<span class="lost-marker">summary only</span> · ' : ''}${b.plantCount} plants · ${when} <span class="sync-${b.sync}">${sync}</span></span>
      </span>
    `;
    row.addEventListener('click', () => openBatchDetail(b.batchId));
    list.appendChild(row);
  });
}

let openBatchId = null;   // batch currently shown in the detail sheet

function openBatchDetail(batchId) {
  const b = Store.getBatch(batchId);
  if (!b) { $('batch-overlay').classList.add('hidden'); return; }
  openBatchId = batchId;
  Log.info('opening archived batch', batchId);

  $('batch-title').textContent = b.strain;
  const edited = b.editedAt
    ? `<br>Edited ${new Date(b.editedAt).toLocaleString()} by ${b.editedBy}`
    : '';
  $('batch-summary').innerHTML = `
    Batch <strong>${b.batchId}</strong> · rev <strong>${b.revision || 1}</strong><br>
    <strong>${b.plantCount}</strong> plants · <strong>${b.totalWeight} ${b.unit}</strong> wet weight<br>
    Logged by ${b.employee}<br>
    Closed ${new Date(b.closedAt).toLocaleString()}${edited}
  `;

  $('b-strain').value = b.strain;
  $('b-room').value = b.room;
  $('b-dest').value = b.destinationRoom;
  $('b-notes').value = b.notes || '';

  $('batch-sync-state').textContent =
    b.sync === 'synced' ? 'Synced' : b.sync === 'failed' ? 'Sync failed' : 'Not synced';

  const rows = b.plants || [];
  const body = $('batch-plants');
  body.innerHTML = '';

  const empty = $('batch-no-rows');
  empty.classList.toggle('hidden', rows.length > 0);
  if (b.rowsLost) {
    empty.innerHTML = `Summary only — ${b.plantCount} rows were recorded but not retained.<br>` +
      `<span class="empty-sub">This batch was closed before row retention was added. The individual weights are gone; the total is not.</span>`;
    empty.classList.add('empty-lost');
  } else {
    empty.textContent = 'No plant rows in this batch.';
    empty.classList.remove('empty-lost');
  }

  [...rows].reverse().forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.className = 'row-editable' + (p.flagged ? ' flagged' : '');
    const time = new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const sync = p.sync === 'synced' ? '●' : p.sync === 'failed' ? '✕' : '○';
    tr.innerHTML = `
      <td class="c-index">${rows.length - i}</td>
      <td class="c-time">${time}</td>
      <td class="c-tag">${p.plantTag || ''}</td>
      <td class="c-weight">${p.flagged ? '⚠ ' : ''}${p.weight} ${p.unit}</td>
      <td class="c-sync sync-${p.sync}">${sync}</td>
    `;
    tr.addEventListener('click', () => openRowEditor(batchId, p.id));
    body.appendChild(tr);
  });

  $('batch-sync').disabled = b.sync === 'synced';
  $('batch-sync').textContent = b.sync === 'synced' ? 'Already synced' : 'Sync to Sheets';
  const blockReopen = Boolean(Store.state.session) || Boolean(b.rowsLost);
  $('batch-reopen').disabled = blockReopen;
  $('batch-reopen').textContent = b.rowsLost
    ? 'Cannot reopen — summary only'
    : Store.state.session ? 'Close the open batch first' : 'Reopen & add plants';
  $('batch-overlay').classList.remove('hidden');
}

function saveBatchHeader() {
  const b = Store.getBatch(openBatchId);
  if (!b) return;
  const patch = {
    strain: $('b-strain').value || b.strain,
    room: $('b-room').value || b.room,
    destinationRoom: $('b-dest').value || b.destinationRoom,
    notes: $('b-notes').value.trim(),
  };
  const unchanged = patch.strain === b.strain && patch.room === b.room
    && patch.destinationRoom === b.destinationRoom && patch.notes === (b.notes || '');
  if (unchanged) return;

  Store.updateBatchHeader(openBatchId, patch);
  Log.info('batch header edited', { batch: openBatchId, ...patch });
  openBatchDetail(openBatchId);
  renderHistory();
  toast('Batch details updated. Needs a resync.', 'ok');
}

/* ---- Row editor ---- */

let editing = { batchId: null, plantId: null };

function openRowEditor(batchId, plantId) {
  const b = Store.getBatch(batchId);
  const p = (b?.plants || []).find((x) => x.id === plantId);
  if (!p) return;
  editing = { batchId, plantId };

  $('r-unit').textContent = p.unit;
  $('r-weight').value = p.weight;
  $('r-tag').value = p.plantTag || '';
  $('r-notes').value = p.notes || '';
  $('r-warn').classList.add('hidden');
  $('r-meta').textContent =
    `Logged ${new Date(p.timestamp).toLocaleString()}` +
    (p.editedAt ? ` · last edited ${new Date(p.editedAt).toLocaleString()}` : '') +
    (p.sheetRange ? ` · in sheet at ${p.sheetRange}` : ' · never synced');
  $('row-overlay').classList.remove('hidden');
}

function saveRowEdit() {
  const raw = $('r-weight').value.trim();
  const weight = parseFloat(raw);
  if (!raw || Number.isNaN(weight) || weight <= 0) {
    const el = $('r-warn');
    el.textContent = 'Enter a weight greater than zero.';
    el.classList.remove('hidden');
    return;
  }
  Store.updatePlantInBatch(editing.batchId, editing.plantId, {
    weight,
    plantTag: $('r-tag').value.trim(),
    notes: $('r-notes').value.trim(),
  });
  Log.info('plant edited', { batch: editing.batchId, plant: editing.plantId, weight });
  $('row-overlay').classList.add('hidden');
  openBatchDetail(editing.batchId);
  renderHistory();
  toast('Plant updated. Batch needs a resync.', 'ok');
}

function deleteRow() {
  const removed = Store.deletePlantFromBatch(editing.batchId, editing.plantId);
  if (!removed) return;
  Log.warn('plant deleted', { batch: editing.batchId, weight: removed.weight, hadSheetRow: Boolean(removed.sheetRange) });
  $('row-overlay').classList.add('hidden');
  openBatchDetail(editing.batchId);
  renderHistory();
  toast(
    removed.sheetRange
      ? `Removed ${removed.weight}${removed.unit}. Its sheet row will be voided on resync.`
      : `Removed ${removed.weight}${removed.unit}.`,
    'ok',
  );
}

/* ============ Close batch ============ */

function showCloseModal() {
  const s = Store.state.session;
  const { count, total } = Store.totals();
  $('close-readback').innerHTML = `
    Batch <strong>${s.batchId}</strong><br>
    <strong>${s.strain}</strong> from ${s.room}<br>
    Hanging in <strong>${s.destinationRoom}</strong><br>
    <strong>${count}</strong> plants · <strong>${total} ${s.unit}</strong> wet weight<br>
    Logged by ${s.employee}
  `;
  $('close-overlay').classList.remove('hidden');
}

async function confirmClose() {
  const flush = await flushPendingPlants();
  if (flush && flush.error) toast('Some plant rows did not sync: ' + flush.error, 'bad');

  const batch = Store.closeSession();
  $('close-overlay').classList.add('hidden');

  if (Sheets.ready) {
    try {
      await Sheets.append('Batches', [batchToRow(batch)]);
      batch.sync = 'synced';
      Store.save();
      toast(`Batch ${batch.batchId} closed and written to Sheets.`, 'ok');
    } catch (err) {
      batch.sync = 'failed';
      Store.save();
      toast('Batch closed locally, Sheets write failed: ' + err.message, 'bad');
    }
  } else {
    toast(`Batch ${batch.batchId} closed — ${batch.plantCount} plants, ${batch.totalWeight}${batch.unit}. Saved locally.`, 'ok');
  }
  enterSetupView();
}

/* ============ Settings ============ */

function loadSettingsIntoForm() {
  const s = Store.state.settings;
  $('s-apikey').value = s.apiKey || '';
  $('s-clientid').value = s.googleClientId || '';
  $('s-sheetid').value = s.spreadsheetId || '';
  $('s-employee').value = s.employeeId || CONFIG.employees[0].id;
}

function saveSettings() {
  Store.updateSettings({
    apiKey: $('s-apikey').value.trim(),
    googleClientId: $('s-clientid').value.trim(),
    spreadsheetId: $('s-sheetid').value.trim(),
    employeeId: $('s-employee').value,
  });
  $('settings-overlay').classList.add('hidden');
  toast('Settings saved.', 'ok');
}

function connectGoogle() {
  const clientId = $('s-clientid').value.trim();
  const sheetId = $('s-sheetid').value.trim();
  if (!clientId || !sheetId) { toast('Need both a client ID and a spreadsheet ID.', 'bad'); return; }
  Store.updateSettings({ googleClientId: clientId, spreadsheetId: sheetId });

  if (!Sheets.init(clientId)) { toast('Google Identity script not loaded yet — try again.', 'bad'); return; }
  Sheets.connect(async () => {
    updateSyncPill();
    try {
      await Sheets.ensureTabs();
      toast('Connected. Plants and Batches tabs are ready.', 'ok');
      const r = await flushPendingPlants();
      if (r && r.synced) { renderCapture(); toast(`Pushed ${r.synced} queued rows.`, 'ok'); }
    } catch (err) {
      toast('Connected, but tab setup failed: ' + err.message, 'bad');
    }
  });
}

function updateSyncPill(failed) {
  const el = $('sync-pill');
  if (failed) { el.title = 'Google Sheets: sync error'; el.className = 'pill pill-bad'; return; }
  if (Sheets.ready) { el.title = 'Google Sheets: live'; el.className = 'pill pill-ok'; }
  else { el.title = 'Google Sheets: not connected — rows queue locally'; el.className = 'pill pill-idle'; }
}

/* ============ Buttons ============ */

function wireButtons() {
  $('setup-text-go').addEventListener('click', () => {
    const v = $('setup-text').value.trim();
    if (v) handleSetupUtterance(v);
  });
  $('setup-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('setup-text-go').click();
  });

  ['f-strain', 'f-room', 'f-dest'].forEach((id) => $(id).addEventListener('change', reportMissing));
  $('setup-open').addEventListener('click', openBatch);
  $('setup-cancel').addEventListener('click', resetSetup);

  $('setup-keypad-toggle').addEventListener('click', () => showKeypad('setup'));
  $('capture-keypad-toggle').addEventListener('click', () => showKeypad('capture'));

  $('capture-text-go').addEventListener('click', () => {
    const v = $('capture-text').value.trim();
    if (!v) return;
    handleCaptureUtterance(v);
    $('capture-text').value = '';
    $('capture-text').focus();
  });
  $('capture-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('capture-text-go').click();
  });

  $('btn-undo').addEventListener('click', () => handleCaptureUtterance('undo'));
  $('btn-close').addEventListener('click', showCloseModal);
  $('btn-flush').addEventListener('click', async () => {
    const r = await flushPendingPlants();
    renderCapture();
    if (r.skipped) toast('Not connected to Google Sheets.', 'bad');
    else if (r.error) { toast(r.error, 'bad'); updateSyncPill(true); }
    else toast(`Synced ${r.synced} rows.`, 'ok');
  });

  $('close-cancel').addEventListener('click', () => $('close-overlay').classList.add('hidden'));
  $('close-confirm').addEventListener('click', confirmClose);

  $('batch-close').addEventListener('click', () => $('batch-overlay').classList.add('hidden'));

  // Header fields save on change — no separate edit mode to get stuck in.
  ['b-strain', 'b-room', 'b-dest'].forEach((id) => {
    $(id).addEventListener('change', saveBatchHeader);
  });
  $('b-notes').addEventListener('blur', saveBatchHeader);

  $('batch-sync').addEventListener('click', async () => {
    const b = Store.getBatch(openBatchId);
    if (!b) return;
    const r = await flushBatch(b);
    if (r.skipped) { toast('Not connected to Google Sheets.', 'bad'); return; }
    if (r.error) { toast(r.error, 'bad'); updateSyncPill(true); }
    else {
      const parts = [];
      if (r.appended) parts.push(`${r.appended} added`);
      if (r.updated) parts.push(`${r.updated} updated`);
      if (r.voided) parts.push(`${r.voided} voided`);
      toast(`${b.batchId}: ${parts.join(', ') || 'already current'}.`, 'ok');
    }
    openBatchDetail(b.batchId);
    renderHistory();
  });

  $('batch-reopen').addEventListener('click', () => {
    const id = openBatchId;
    const r = Store.reopenBatch(id);
    if (r.error) { toast(r.error, 'bad'); return; }
    Log.info('batch reopened', id);
    $('batch-overlay').classList.add('hidden');
    WakeLock.acquire();
    enterCaptureView();
    toast(`${id} reopened — speak weights to add to it.`, 'ok');
  });

  $('batch-delete').addEventListener('click', () => {
    const b = Store.getBatch(openBatchId);
    if (!b) return;
    if (!confirm(`Delete batch ${b.batchId} and its ${b.plantCount} plant rows from this device?\n\nRows already written to Google Sheets are not removed.`)) return;
    Log.warn('batch deleted', b.batchId);
    Store.deleteBatch(b.batchId);
    $('batch-overlay').classList.add('hidden');
    renderHistory();
    toast(`Batch ${b.batchId} deleted locally.`, 'ok');
  });

  $('row-close').addEventListener('click', () => $('row-overlay').classList.add('hidden'));
  $('row-save').addEventListener('click', saveRowEdit);
  $('row-delete').addEventListener('click', deleteRow);

  $('settings-btn').addEventListener('click', () => {
    loadSettingsIntoForm();
    $('settings-overlay').classList.remove('hidden');
  });
  $('s-close').addEventListener('click', () => $('settings-overlay').classList.add('hidden'));
  $('s-save').addEventListener('click', saveSettings);
  $('s-connect').addEventListener('click', connectGoogle);

  // Diagnostics — the mic chip doubles as the toggle.
  $('mic-pill').addEventListener('click', () => Log.toggle());
  $('debug-close').addEventListener('click', () => Log.toggle(false));
  $('debug-clear').addEventListener('click', () => Log.clear());
  $('debug-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(Log.asText()); toast('Diagnostics copied.', 'ok'); }
    catch (err) { toast('Copy failed — select the text manually.', 'bad'); }
  });
  $('debug-mictest').addEventListener('click', runMicTest);

  [$('settings-overlay'), $('close-overlay'), $('batch-overlay'), $('row-overlay')].forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

/* ============ Microphone self-test ============
   Answers the question logs alone can't: is the mic actually producing audio?
   A granted permission with a flat signal (wrong input device, hardware mute,
   OS-level block) looks identical to a broken app from the outside. */

async function runMicTest() {
  Log.toggle(true);
  Log.info('--- MIC TEST START ---');
  Log.info('environment', {
    secureContext: window.isSecureContext,
    origin: location.origin,
    speechRecognition: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    online: navigator.onLine,
  });

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      Log.info('permissions.query(microphone)', status.state);
    } catch (err) {
      Log.warn('permissions.query unavailable', String(err.message));
    }
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    Log.error('getUserMedia FAILED — this is why nothing happens', { name: err.name, message: err.message });
    if (err.name === 'NotAllowedError') Log.error('Fix: click the mic icon in the address bar and allow, then reload.');
    if (err.name === 'NotFoundError') Log.error('Fix: no input device found — check the OS sound settings.');
    return;
  }

  const track = stream.getAudioTracks()[0];
  const device = track.label || '(unnamed)';
  Log.info('microphone opened', { device, enabled: track.enabled, muted: track.muted, state: track.readyState });
  if (track.muted) Log.error('Track reports MUTED — the OS or hardware is muting this input.');

  // Name every input Chrome can see, so a wrong choice is obvious — and, more
  // usefully, name the real microphone the worker should switch to.
  let realDevices = [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'audioinput').map((d) => d.label || '(unnamed)');
    Log.info('available inputs', inputs);
    realDevices = inputs.filter((l) => l && !VIRTUAL_DEVICE.test(l) && !/^(Default|Communications) - /i.test(l));
  } catch (err) { /* no-op */ }

  if (VIRTUAL_DEVICE.test(device)) {
    Log.error(`"${device}" is a VIRTUAL audio device, not a real microphone — it records silence.`);
    if (realDevices.length) {
      Log.error(`Real microphone available: "${realDevices[0]}" — switch to it.`);
    }
    Log.error('Chrome pins a capture device per site. Fix BOTH:');
    Log.error('  1. chrome://settings/content/microphone → pick the real mic');
    Log.error('  2. Click the icon left of the URL → Reset permissions → reload → allow again');
  }

  // Sample the signal for 3s so a dead input is unmistakable.
  Log.info('listening for 3 seconds — say something now…');
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);

  let peak = 0;
  const started = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      peak = Math.max(peak, Math.sqrt(sum / buf.length));
      if (performance.now() - started < 3000) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });

  const level = Math.round(peak * 100);
  if (level < 2) {
    Log.error(`peak input level ${level}% — the mic is open but hearing nothing.`);
    Log.error('Fix: check the input device in OS sound settings, unmute it, and speak closer.');
  } else {
    Log.info(`peak input level ${level}% — mic is working.`);
  }

  stream.getTracks().forEach((t) => t.stop());
  await ctx.close();
  Log.info('--- MIC TEST END ---');
}

/* ============ Toasts ============ */

function toast(message, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = message;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

init();
