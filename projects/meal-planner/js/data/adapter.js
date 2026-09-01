/* ========================================
   Meal Planner — StorageAdapter contract
   ----------------------------------------
   The seam between the app and wherever the data
   physically lives. LocalStorageAdapter is the
   only implementation today; a Supabase or REST
   adapter drops in beside it with no UI change.

   Two rules make that swap real rather than
   aspirational:

   1. EVERY method returns a Promise, even though
      localStorage is synchronous. A network
      adapter cannot become async later without
      rewriting every call site, so the interface
      is async from day one and the local
      implementation simply resolves immediately.

   2. NOTHING outside js/data touches storage.
      store.js is the single caller, so the blast
      radius of a backend swap is this folder.
   ======================================== */

import { ENTITIES } from './schema.js';

/**
 * @typedef {import('./schema.js').Entity} Entity
 *
 * @typedef {object} StorageAdapter
 * @property {() => Promise<void>} init
 *   Open the store and run any pending migrations. Called once at boot.
 * @property {(entity: Entity) => Promise<object[]>} getAll
 * @property {(entity: Entity, id: string) => Promise<object|null>} get
 * @property {(entity: Entity, record: object) => Promise<object>} put
 *   Upsert by `record.id`. Returns the stored record after normalisation.
 * @property {(entity: Entity, records: object[]) => Promise<object[]>} putMany
 *   Batch upsert. One write instead of N, which matters when seeding or when
 *   a week's worth of slots changes at once.
 * @property {(entity: Entity, id: string) => Promise<void>} delete
 * @property {() => Promise<ExportPayload>} exportAll
 * @property {(payload: ExportPayload, opts?: {mode?: 'replace'|'merge'}) => Promise<void>} importAll
 * @property {() => Promise<void>} clear
 *
 * @typedef {object} ExportPayload
 * @property {number} schemaVersion
 * @property {string} exportedAt   ISO timestamp.
 * @property {string} app          Guards against importing an unrelated file.
 * @property {object} data
 */

/** Written into every export and checked on import. */
export const APP_ID = 'roninventures.meal-planner';

const REQUIRED_METHODS = [
  'init',
  'getAll',
  'get',
  'put',
  'putMany',
  'delete',
  'exportAll',
  'importAll',
  'clear',
];

/**
 * Fail loudly at boot if an adapter is incomplete, rather than at the moment
 * some rarely-used screen calls the one missing method.
 * @param {object} adapter
 * @returns {StorageAdapter}
 */
export function assertAdapter(adapter) {
  const missing = REQUIRED_METHODS.filter((m) => typeof adapter?.[m] !== 'function');
  if (missing.length) {
    throw new Error(`StorageAdapter is missing: ${missing.join(', ')}`);
  }
  return adapter;
}

/**
 * @param {string} entity
 * @returns {entity is Entity}
 */
export function isEntity(entity) {
  return ENTITIES.includes(/** @type {any} */ (entity));
}

/**
 * @param {string} entity
 */
export function assertEntity(entity) {
  if (!isEntity(entity)) {
    throw new Error(`Unknown entity "${entity}". Expected one of: ${ENTITIES.join(', ')}`);
  }
}
