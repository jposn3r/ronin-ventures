/* ========================================
   Meal Planner — LocalStorageAdapter
   ----------------------------------------
   The only StorageAdapter implementation today.

   The whole store is one localStorage key holding
   one JSON document. Per-entity keys would make
   exportAll a gather across keys and open the
   door to a half-written export if one key fails;
   a single document is atomic by construction.

   Reads come from an in-memory copy loaded once
   at init, so a render never pays for a JSON
   parse. Writes go to memory and then to disk.
   ======================================== */

import { assertAdapter, assertEntity, APP_ID } from './adapter.js';
import { SCHEMA_VERSION, emptyData, migrate, normalize, ENTITIES } from './schema.js';

const STORAGE_KEY = APP_ID;

/**
 * @param {{key?: string, storage?: Storage}} [options]
 * @returns {import('./adapter.js').StorageAdapter}
 */
export function createLocalStorageAdapter(options = {}) {
  const key = options.key || STORAGE_KEY;
  const storage = options.storage || safeStorage();

  /** @type {Record<string, Record<string, object>>} */
  let data = emptyData();
  let ready = false;

  /** Serialise and write. Surfaces quota failures instead of silently losing data. */
  function flush() {
    const payload = { schemaVersion: SCHEMA_VERSION, app: APP_ID, data };
    try {
      storage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      // Quota is the realistic failure: years of weeks in a 5 MB budget.
      // The in-memory copy is still correct, so the session continues; the
      // caller decides whether to warn.
      console.error('Meal Planner: could not persist to localStorage.', err);
      throw new Error('Storage is full or unavailable. Export your data before making more changes.');
    }
  }

  function requireReady() {
    if (!ready) throw new Error('Adapter used before init(). Call await adapter.init() at boot.');
  }

  const adapter = {
    async init() {
      let raw = null;
      try {
        raw = storage.getItem(key);
      } catch (err) {
        console.warn('Meal Planner: localStorage is unreadable, starting empty.', err);
      }

      if (!raw) {
        data = emptyData();
        ready = true;
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        // Corrupt JSON. Overwriting it would destroy whatever is recoverable,
        // so it is set aside under a dated key and the session starts clean.
        const backup = `${key}:corrupt:${new Date().toISOString()}`;
        console.error(`Meal Planner: stored data is unreadable. Preserved at "${backup}".`, err);
        try {
          storage.setItem(backup, raw);
        } catch {
          /* If even the backup will not fit, there is nothing further to do. */
        }
        data = emptyData();
        ready = true;
        return;
      }

      const result = migrate(parsed);
      data = result.data;
      ready = true;
      if (result.migrated) flush();
    },

    async getAll(entity) {
      requireReady();
      assertEntity(entity);
      // Copies, so a caller mutating a returned record cannot corrupt the
      // store behind store.js's back.
      return Object.values(data[entity]).map((r) => ({ ...r }));
    },

    async get(entity, id) {
      requireReady();
      assertEntity(entity);
      const found = data[entity][id];
      return found ? { ...found } : null;
    },

    async put(entity, record) {
      requireReady();
      assertEntity(entity);
      const stored = writeOne(entity, record);
      flush();
      return { ...stored };
    },

    async putMany(entity, records) {
      requireReady();
      assertEntity(entity);
      const stored = records.map((r) => writeOne(entity, r));
      flush();
      return stored.map((r) => ({ ...r }));
    },

    async delete(entity, id) {
      requireReady();
      assertEntity(entity);
      delete data[entity][id];
      flush();
    },

    async exportAll() {
      requireReady();
      return {
        schemaVersion: SCHEMA_VERSION,
        app: APP_ID,
        exportedAt: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(data)),
      };
    },

    async importAll(payload, opts = {}) {
      requireReady();
      const mode = opts.mode === 'merge' ? 'merge' : 'replace';

      if (!payload || typeof payload !== 'object' || !payload.data) {
        throw new Error('That file is not a Meal Planner export.');
      }
      if (payload.app && payload.app !== APP_ID) {
        throw new Error(`That file came from "${payload.app}", not Meal Planner.`);
      }

      const result = migrate(payload);

      if (mode === 'replace') {
        data = emptyData();
      }
      for (const entity of ENTITIES) {
        const incoming = result.data[entity] || {};
        for (const record of Object.values(incoming)) {
          writeOne(entity, record);
        }
      }
      flush();
    },

    async clear() {
      requireReady();
      data = emptyData();
      flush();
    },
  };

  /**
   * Normalise, stamp, and place a record. Shared by put, putMany and import so
   * all three enforce the same shape.
   * @param {string} entity
   * @param {object} record
   */
  function writeOne(entity, record) {
    const clean = normalize(entity, record);
    if (!clean.id) throw new Error(`Cannot store a ${entity} record without an id.`);
    const now = new Date().toISOString();
    const existing = data[entity][clean.id];
    if ('createdAt' in clean) {
      clean.createdAt = clean.createdAt || (existing && existing.createdAt) || now;
      clean.updatedAt = now;
    }
    data[entity][clean.id] = clean;
    return clean;
  }

  return assertAdapter(adapter);
}

/**
 * localStorage throws on access in some privacy modes rather than merely
 * being empty. An in-memory stand-in keeps the app usable for the session,
 * with the obvious caveat that nothing survives the tab closing.
 * @returns {Storage}
 */
function safeStorage() {
  try {
    const probe = '__mp_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    console.warn('Meal Planner: localStorage is blocked. Data will not persist beyond this session.');
    const mem = new Map();
    return /** @type {any} */ ({
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    });
  }
}
