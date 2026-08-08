/* ========================================
   HarvestVoice — State + local persistence
   ----------------------------------------
   localStorage is the source of truth in the
   prototype; Google Sheets is a SINK behind it.
   That boundary is the whole point: when the
   operator's POS API shows up, it becomes a
   second sink alongside Sheets and nothing
   upstream changes.
   ======================================== */

const STORAGE_KEY = 'harvest-voice:v1';

/* localStorage is finite and a shift produces hundreds of rows. Prototype cap;
   in production the archive lives in Postgres and this ceiling disappears. */
const MAX_ARCHIVED_BATCHES = 20;

const Store = {
  state: {
    settings: {
      apiKey: '',           // Anthropic key — localStorage only, never committed
      googleClientId: '',   // OAuth client ID (public, origin-restricted)
      spreadsheetId: '',
      employeeId: CONFIG.employees[0].id,
    },
    session: null,          // open batch, or null
    plants: [],             // rows for the open batch
    closedBatches: [],      // completed batch headers
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = { ...this.state, ...parsed, settings: { ...this.state.settings, ...(parsed.settings || {}) } };
      }
    } catch (err) {
      console.warn('Could not restore prior state:', err);
    }

    // Migration — batches closed before row retention existed have only a
    // summary. Mark them so the UI can say so plainly instead of rendering an
    // empty table that reads like a fresh bug.
    (this.state.closedBatches || []).forEach((b) => {
      if (!Array.isArray(b.plants)) {
        b.plants = [];
        b.rowsLost = (b.plantCount || 0) > 0;
      }
    });
    const lost = this.state.closedBatches.filter((b) => b.rowsLost).length;
    if (lost) Log.warn(`${lost} archived batch(es) have summary only — closed before row retention`);

    return this.state;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.warn('Could not persist state:', err);
    }
  },

  // ---- Session (batch) lifecycle ----

  openSession({ strain, room, destinationRoom, unit, notes }) {
    const now = new Date();
    const employee = CONFIG.employees.find((e) => e.id === this.state.settings.employeeId);
    this.state.session = {
      batchId: makeBatchId(strain, now),
      openedAt: now.toISOString(),
      strain,
      room,
      destinationRoom,
      unit: unit || CONFIG.facility.defaultUnit,
      notes: notes || '',
      employee: employee ? employee.name : 'Unknown',
    };
    this.state.plants = [];
    this.save();
    return this.state.session;
  },

  addPlant({ weight, unit, plantTag, notes, flagged }) {
    const s = this.state.session;
    if (!s) return null;
    const row = {
      // Client-generated ID. Makes the Sheets write idempotent — a retry after
      // a dropped connection can never create the plant twice.
      id: makeId(),
      timestamp: new Date().toISOString(),
      batchId: s.batchId,
      plantTag: plantTag || '',
      strain: s.strain,
      room: s.room,
      weight,
      unit: unit || s.unit,
      destinationRoom: s.destinationRoom,
      employee: s.employee,
      notes: notes || '',
      flagged: Boolean(flagged),
      sync: 'pending',
    };
    this.state.plants.push(row);
    this.save();
    return row;
  },

  undoLastPlant() {
    const removed = this.state.plants.pop() || null;
    this.save();
    return removed;
  },

  totals() {
    const plants = this.state.plants;
    const total = plants.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    return { count: plants.length, total: Math.round(total * 100) / 100 };
  },

  closeSession() {
    const s = this.state.session;
    if (!s) return null;
    const { count, total } = this.totals();
    const batch = {
      ...s,
      closedAt: new Date().toISOString(),
      plantCount: count,
      totalWeight: total,
      sync: 'pending',
      // A reopened batch re-archives as a new revision of itself, not a copy.
      revision: s.reopened ? (s.revision || 1) + 1 : 1,
      // Retain the individual rows. Discarding them on close destroyed the
      // record whenever Sheets wasn't connected — the aggregate alone is not
      // a chain of custody.
      plants: this.state.plants,
    };
    delete batch.reopened;
    this.state.closedBatches.push(batch);
    if (this.state.closedBatches.length > MAX_ARCHIVED_BATCHES) {
      const dropped = this.state.closedBatches.length - MAX_ARCHIVED_BATCHES;
      this.state.closedBatches = this.state.closedBatches.slice(dropped);
      Log.warn(`archive full — dropped ${dropped} oldest batch(es) from local storage`);
    }
    this.state.session = null;
    this.state.plants = [];
    this.save();
    return batch;
  },

  /** Newest first — what a worker wants to check is what they just did. */
  recentBatches() {
    return [...this.state.closedBatches].reverse();
  },

  getBatch(batchId) {
    return this.state.closedBatches.find((b) => b.batchId === batchId) || null;
  },

  /* ---- Editing a closed batch ----
     Every mutation stamps who and when, and flips the batch back to 'pending'
     so it can't silently drift out of sync with Sheets. A corrected weight in
     a regulated record has to be traceable, not just different. */

  _touch(batch) {
    const employee = CONFIG.employees.find((e) => e.id === this.state.settings.employeeId);
    batch.editedAt = new Date().toISOString();
    batch.editedBy = employee ? employee.name : 'Unknown';
    batch.revision = (batch.revision || 1) + 1;
    batch.sync = 'pending';
    this._recompute(batch);
    this.save();
  },

  _recompute(batch) {
    const rows = batch.plants || [];
    batch.plantCount = rows.length;
    batch.totalWeight = Math.round(rows.reduce((sum, p) => sum + (Number(p.weight) || 0), 0) * 100) / 100;
  },

  updatePlantInBatch(batchId, plantId, patch) {
    const batch = this.getBatch(batchId);
    if (!batch) return null;
    const plant = (batch.plants || []).find((p) => p.id === plantId);
    if (!plant) return null;

    Object.assign(plant, patch);
    const bounds = CONFIG.facility.plausibleWeight[plant.unit];
    plant.flagged = Boolean(bounds) && (plant.weight < bounds.min || plant.weight > bounds.max);
    plant.sync = 'pending';           // re-push this row on next sync
    plant.editedAt = new Date().toISOString();
    this._touch(batch);
    return plant;
  },

  deletePlantFromBatch(batchId, plantId) {
    const batch = this.getBatch(batchId);
    if (!batch) return null;
    const idx = (batch.plants || []).findIndex((p) => p.id === plantId);
    if (idx === -1) return null;
    const [removed] = batch.plants.splice(idx, 1);

    // If it already reached Sheets, remember where so resync can void that
    // row rather than leaving an orphaned record up there.
    if (removed.sheetRange) {
      batch.voided = batch.voided || [];
      batch.voided.push({ sheetRange: removed.sheetRange, weight: removed.weight, unit: removed.unit });
    }
    this._touch(batch);
    return removed;
  },

  updateBatchHeader(batchId, patch) {
    const batch = this.getBatch(batchId);
    if (!batch) return null;
    Object.assign(batch, patch);
    // Header fields are denormalised onto every plant row — keep them true.
    (batch.plants || []).forEach((p) => {
      p.strain = batch.strain;
      p.room = batch.room;
      p.destinationRoom = batch.destinationRoom;
      p.sync = 'pending';
    });
    this._touch(batch);
    return batch;
  },

  deleteBatch(batchId) {
    const idx = this.state.closedBatches.findIndex((b) => b.batchId === batchId);
    if (idx === -1) return false;
    this.state.closedBatches.splice(idx, 1);
    this.save();
    return true;
  },

  /** Pull an archived batch back into the active session so voice capture can
      add to it. Closing re-archives it in place under the same batch id. */
  reopenBatch(batchId) {
    if (this.state.session) return { error: 'Close the open batch first.' };
    const batch = this.getBatch(batchId);
    if (!batch) return { error: 'Batch not found.' };
    // Reopening a summary-only batch would restore zero rows and then re-close
    // it as a zero-plant batch — destroying the one record that survived.
    if (batch.rowsLost) return { error: 'This batch has no rows to reopen — its summary would be overwritten.' };

    this.state.session = {
      batchId: batch.batchId,
      openedAt: batch.openedAt,
      strain: batch.strain,
      room: batch.room,
      destinationRoom: batch.destinationRoom,
      unit: batch.unit,
      notes: batch.notes || '',
      employee: batch.employee,
      reopened: true,
      revision: batch.revision || 1,
      sheetRange: batch.sheetRange || null,
      voided: batch.voided || [],
    };
    this.state.plants = batch.plants || [];
    this.deleteBatch(batchId);
    this.save();
    return { session: this.state.session };
  },

  discardSession() {
    this.state.session = null;
    this.state.plants = [];
    this.save();
  },

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.save();
  },

  markSynced(ids) {
    const set = new Set(ids);
    for (const p of this.state.plants) if (set.has(p.id)) p.sync = 'synced';
    this.save();
  },

  markFailed(ids) {
    const set = new Set(ids);
    for (const p of this.state.plants) if (set.has(p.id)) p.sync = 'failed';
    this.save();
  },
};

function makeId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function makeBatchId(strain, date) {
  const slug = String(strain || 'BATCH').toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 12);
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${slug}-${d}-${suffix}`;
}
