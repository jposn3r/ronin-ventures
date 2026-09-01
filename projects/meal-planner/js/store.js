/* ========================================
   Meal Planner — Store
   ----------------------------------------
   The ONLY module that talks to the storage
   adapter. Everything above it reads from the
   in-memory cache and calls these methods; no
   component imports the adapter directly.

   Reads are synchronous against the cache so
   rendering never awaits. Writes update the cache,
   notify subscribers, and persist in the
   background — the UI does not wait on disk to
   repaint a plate.
   ======================================== */

import { createLocalStorageAdapter } from './data/localAdapter.js';
import { SETTINGS_ID, normalizeSettings } from './data/schema.js';
import { SEED_INGREDIENTS } from './data/seed/ingredients.js';
import { SEED_MEALS } from './data/seed/meals.js';
import { SEED_DAY_TYPES, SEED_SLOT_TEMPLATES, SEED_SETTINGS } from './data/seed/defaults.js';
import { createWeek, isWeekEmpty } from './core/week.js';
import { mondayOf, today } from './core/dates.js';
import { makeId } from './core/ids.js';

/** @type {import('./data/adapter.js').StorageAdapter} */
let adapter = createLocalStorageAdapter();

/** In-memory cache. Keyed by id, mirroring the adapter's shape. */
const cache = {
  ingredients: new Map(),
  meals: new Map(),
  weeks: new Map(),
  dayTypes: new Map(),
  slotTemplates: new Map(),
  settings: normalizeSettings({}),
};

/** @type {Set<() => void>} */
const listeners = new Set();

/** Weeks materialised for browsing but not yet worth persisting. */
const draftWeeks = new Map();

/* ============ Lifecycle ============ */

/**
 * @param {{adapter?: object}} [options] Inject an adapter to swap backends.
 * @returns {Promise<void>}
 */
export async function init(options = {}) {
  if (options.adapter) adapter = options.adapter;
  await adapter.init();
  await reloadAll();
  if (!cache.settings.seeded) await seed();
}

async function reloadAll() {
  const [ingredients, meals, weeks, dayTypes, slotTemplates, settingsRows] = await Promise.all([
    adapter.getAll('ingredients'),
    adapter.getAll('meals'),
    adapter.getAll('weeks'),
    adapter.getAll('dayTypes'),
    adapter.getAll('slotTemplates'),
    adapter.getAll('settings'),
  ]);
  fill(cache.ingredients, ingredients);
  fill(cache.meals, meals);
  fill(cache.weeks, weeks);
  fill(cache.dayTypes, dayTypes);
  fill(cache.slotTemplates, slotTemplates);
  cache.settings = normalizeSettings(settingsRows.find((s) => s.id === SETTINGS_ID) || {});
  draftWeeks.clear();
}

/**
 * First-run seed. Guarded by settings.seeded rather than by emptiness, so
 * deliberately deleting every ingredient does not resurrect the whole library
 * on the next reload.
 */
async function seed() {
  await adapter.putMany('ingredients', SEED_INGREDIENTS);
  await adapter.putMany('meals', SEED_MEALS);
  await adapter.putMany('dayTypes', SEED_DAY_TYPES);
  await adapter.putMany('slotTemplates', SEED_SLOT_TEMPLATES);
  await adapter.put('settings', SEED_SETTINGS);
  await reloadAll();
  emit();
}

/* ============ Subscriptions ============ */

/**
 * @param {() => void} fn
 * @returns {() => void} Unsubscribe.
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

/* ============ Reads (synchronous, from cache) ============ */

export const get = {
  /** @returns {object[]} Active ingredients, alphabetical. */
  ingredients: (includeArchived = false) => sortByName(list(cache.ingredients, includeArchived)),
  /** @returns {object[]} Active meals, alphabetical. */
  meals: (includeArchived = false) => sortByName(list(cache.meals, includeArchived)),
  dayTypes: (includeArchived = false) => list(cache.dayTypes, includeArchived),
  slotTemplates: () => [...cache.slotTemplates.values()],
  settings: () => ({ ...cache.settings }),

  ingredient: (id) => cache.ingredients.get(id) || null,
  meal: (id) => cache.meals.get(id) || null,
  dayType: (id) => cache.dayTypes.get(id) || null,
  slotTemplate: (id) => cache.slotTemplates.get(id) || null,

  /** Lookup maps for the macro and shopping functions. */
  ingredientsById: () => cache.ingredients,
  mealsById: () => cache.meals,

  /**
   * The week starting on the given Monday. Materialised from the default
   * template if it has never been planned; that draft is NOT persisted until
   * something is actually put on a plate.
   * @param {string} weekStart
   * @returns {object}
   */
  week(weekStart) {
    const stored = cache.weeks.get(weekStart);
    if (stored) return stored;
    const draft = draftWeeks.get(weekStart);
    if (draft) return draft;
    const template =
      cache.slotTemplates.get(cache.settings.defaultSlotTemplateId) ||
      cache.slotTemplates.values().next().value;
    const fresh = createWeek(weekStart, template, cache.settings.defaultDayTypeId);
    draftWeeks.set(weekStart, fresh);
    return fresh;
  },

  /** @returns {string} Monday of the current week. */
  currentWeekStart: () => mondayOf(today()),

  /**
   * Meals that reference an ingredient. Drives the "used by N meals" warning
   * before archiving.
   * @param {string} ingredientId
   * @returns {object[]}
   */
  mealsUsingIngredient(ingredientId) {
    return [...cache.meals.values()].filter((m) =>
      (m.ingredients || []).some((line) => line.ingredientId === ingredientId)
    );
  },

  /**
   * Planned slots that reference a meal, across every stored week.
   * @param {string} mealId
   * @returns {{weekStart: string, date: string, label: string}[]}
   */
  slotsUsingMeal(mealId) {
    const hits = [];
    for (const week of cache.weeks.values()) {
      for (const day of week.days || []) {
        for (const slot of day.slots || []) {
          if (slot.mealId === mealId) {
            hits.push({ weekStart: week.weekStart, date: day.date, label: slot.label });
          }
        }
      }
    }
    return hits;
  },
};

/* ============ Writes ============ */

/**
 * Persist a week. Empty draft weeks are skipped so browsing does not litter
 * storage; once a week holds anything it is stored from then on.
 * @param {object} week
 * @returns {Promise<void>}
 */
export async function saveWeek(week) {
  const alreadyStored = cache.weeks.has(week.id);
  if (!alreadyStored && isWeekEmpty(week)) {
    draftWeeks.set(week.id, week);
    emit();
    return;
  }
  cache.weeks.set(week.id, week);
  draftWeeks.delete(week.id);
  emit();
  const saved = await adapter.put('weeks', week);
  cache.weeks.set(saved.id, saved);
}

/**
 * @param {object} ingredient
 * @returns {Promise<object>}
 */
export async function saveIngredient(ingredient) {
  const record = { ...ingredient, id: ingredient.id || makeId('ing') };
  const saved = await adapter.put('ingredients', record);
  cache.ingredients.set(saved.id, saved);
  emit();
  return saved;
}

/**
 * @param {object} meal
 * @returns {Promise<object>}
 */
export async function saveMeal(meal) {
  const record = { ...meal, id: meal.id || makeId('meal') };
  const saved = await adapter.put('meals', record);
  cache.meals.set(saved.id, saved);
  emit();
  return saved;
}

/**
 * @param {object} dayType
 * @returns {Promise<object>}
 */
export async function saveDayType(dayType) {
  const record = { ...dayType, id: dayType.id || makeId('daytype') };
  const saved = await adapter.put('dayTypes', record);
  cache.dayTypes.set(saved.id, saved);
  emit();
  return saved;
}

/**
 * @param {object} template
 * @returns {Promise<object>}
 */
export async function saveSlotTemplate(template) {
  const record = { ...template, id: template.id || makeId('slottpl') };
  const saved = await adapter.put('slotTemplates', record);
  cache.slotTemplates.set(saved.id, saved);
  emit();
  return saved;
}

/**
 * @param {object} patch
 * @returns {Promise<object>}
 */
export async function saveSettings(patch) {
  const merged = normalizeSettings({ ...cache.settings, ...patch });
  const saved = await adapter.put('settings', merged);
  cache.settings = normalizeSettings(saved);
  emit();
  return cache.settings;
}

/**
 * Archive rather than delete. A hard delete of an ingredient used by six meals
 * silently zeroes their macros, and of a meal planned in past weeks rewrites
 * history. Archiving hides it from the pickers and keeps every reference
 * resolvable.
 * @param {'ingredients'|'meals'|'dayTypes'} entity
 * @param {string} id
 * @param {boolean} [archived]
 * @returns {Promise<void>}
 */
export async function setArchived(entity, id, archived = true) {
  const map = cache[entity];
  const record = map.get(id);
  if (!record) return;
  const saved = await adapter.put(entity, { ...record, archived });
  map.set(saved.id, saved);
  emit();
}

/**
 * Permanent removal. Only offered for records nothing references.
 * @param {'ingredients'|'meals'|'dayTypes'|'weeks'} entity
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function destroy(entity, id) {
  await adapter.delete(entity, id);
  cache[entity].delete(id);
  emit();
}

/* ============ Transfer ============ */

/**
 * @returns {Promise<object>}
 */
export async function exportAll() {
  return adapter.exportAll();
}

/**
 * @param {object} payload
 * @param {{mode?: 'replace'|'merge'}} [opts]
 * @returns {Promise<void>}
 */
export async function importAll(payload, opts) {
  await adapter.importAll(payload, opts);
  await reloadAll();
  emit();
}

/**
 * Wipe everything and re-seed. The escape hatch when the library gets messy.
 * @returns {Promise<void>}
 */
export async function resetToSeed() {
  await adapter.clear();
  await reloadAll();
  await seed();
}

/* ============ Helpers ============ */

/**
 * @param {Map<string, object>} map
 * @param {object[]} records
 */
function fill(map, records) {
  map.clear();
  for (const r of records) map.set(r.id, r);
}

/**
 * @param {Map<string, object>} map
 * @param {boolean} includeArchived
 * @returns {object[]}
 */
function list(map, includeArchived) {
  const all = [...map.values()];
  return includeArchived ? all : all.filter((r) => !r.archived);
}

/**
 * @param {object[]} records
 * @returns {object[]}
 */
function sortByName(records) {
  return records.sort((a, b) => a.name.localeCompare(b.name));
}
