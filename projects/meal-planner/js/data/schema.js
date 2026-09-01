/* ========================================
   Meal Planner — Schema, defaults, migrations
   ----------------------------------------
   The stored shape and the rules for moving it
   forward. Pure: no storage calls live here, so
   any adapter can reuse it.

   Every record is normalised on the way in.
   Imported JSON and hand-edited storage are both
   untrusted, and a missing field should surface
   as a sane default rather than propagate as
   undefined into the macro math.
   ======================================== */

import { CATEGORY_IDS } from '../core/categories.js';
import { UNITS } from '../core/units.js';

/** Bump when the stored shape changes, and add the matching migration below. */
export const SCHEMA_VERSION = 1;

/** @typedef {'ingredients'|'meals'|'weeks'|'dayTypes'|'slotTemplates'|'settings'} Entity */

/** @type {Entity[]} */
export const ENTITIES = ['ingredients', 'meals', 'weeks', 'dayTypes', 'slotTemplates', 'settings'];

/** Settings is a singleton; it lives in the same keyed map under this id. */
export const SETTINGS_ID = 'settings';

export const MIN_SLOTS = 1;
export const MAX_SLOTS = 10;

/**
 * @returns {Record<Entity, Record<string, object>>} An empty, fully-formed store.
 */
export function emptyData() {
  return { ingredients: {}, meals: {}, weeks: {}, dayTypes: {}, slotTemplates: {}, settings: {} };
}

/* ============ Migrations ============
   Keyed by the version being migrated TO. Each takes the whole data map and
   returns it. They run in sequence, so a v1 export opened after v4 ships walks
   2, 3, 4 in order rather than needing a bespoke v1-to-v4 path.
   ======================================== */

/** @type {Record<number, (data: any) => any>} */
const migrations = {};

/**
 * Bring a stored or imported payload up to the current schema version.
 * @param {{schemaVersion?: number, data?: object}} payload
 * @returns {{schemaVersion: number, data: object, migrated: boolean}}
 */
export function migrate(payload) {
  let version = Number(payload && payload.schemaVersion) || 0;
  let data = { ...emptyData(), ...((payload && payload.data) || {}) };
  const from = version;

  while (version < SCHEMA_VERSION) {
    const next = version + 1;
    const step = migrations[next];
    if (step) data = step(data);
    version = next;
  }

  // A payload from a NEWER build than this one. Refusing outright would strand
  // the data, so it loads as-is; unknown fields survive the round trip because
  // nothing here strips them.
  if (version > SCHEMA_VERSION) version = SCHEMA_VERSION;

  return { schemaVersion: SCHEMA_VERSION, data, migrated: from !== SCHEMA_VERSION };
}

/* ============ Normalisers ============ */

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeIngredient(raw = {}) {
  const servingUnit = UNITS[raw.servingUnit] ? raw.servingUnit : 'g';
  return {
    id: str(raw.id),
    name: str(raw.name, 'Untitled ingredient'),
    category: CATEGORY_IDS.includes(raw.category) ? raw.category : 'other',
    servingSize: num(raw.servingSize, 1),
    servingUnit,
    calories: num(raw.calories),
    protein: num(raw.protein),
    carbs: num(raw.carbs),
    fat: num(raw.fat),
    // Shopping rollup. All optional — absent means "show the raw quantity".
    purchaseUnit: UNITS[raw.purchaseUnit] ? raw.purchaseUnit : null,
    purchaseSize: raw.purchaseSize == null ? null : num(raw.purchaseSize, 1),
    purchaseLabel: raw.purchaseLabel == null ? null : str(raw.purchaseLabel),
    servingsPerPurchase: raw.servingsPerPurchase == null ? null : num(raw.servingsPerPurchase),
    notes: str(raw.notes),
    archived: Boolean(raw.archived),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeMeal(raw = {}) {
  return {
    id: str(raw.id),
    name: str(raw.name, 'Untitled meal'),
    description: str(raw.description),
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => str(t)).filter(Boolean) : [],
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients
          .filter((line) => line && str(line.ingredientId))
          .map((line) => ({ ingredientId: str(line.ingredientId), quantity: num(line.quantity, 1) }))
      : [],
    archived: Boolean(raw.archived),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeDayType(raw = {}) {
  const targets = raw.targets || {};
  return {
    id: str(raw.id),
    name: str(raw.name, 'Untitled day'),
    targets: {
      calories: num(targets.calories),
      protein: num(targets.protein),
      carbs: num(targets.carbs),
      fat: num(targets.fat),
    },
    color: str(raw.color, '#8a8f98'),
    archived: Boolean(raw.archived),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeSlotTemplate(raw = {}) {
  const slots = Array.isArray(raw.slots) ? raw.slots : [];
  return {
    id: str(raw.id),
    name: str(raw.name, 'Untitled template'),
    slots: slots
      .slice(0, MAX_SLOTS)
      .map((s, i) => ({ id: str(s && s.id, 'slot' + (i + 1)), label: str(s && s.label, 'Slot ' + (i + 1)) })),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeWeek(raw = {}) {
  const weekStart = str(raw.weekStart, str(raw.id));
  return {
    id: str(raw.id, weekStart),
    weekStart,
    days: Array.isArray(raw.days) ? raw.days.map(normalizeDay) : [],
    // Checkbox state is week-scoped and belongs with the week it describes, so
    // it survives a reload and never bleeds into next week's list.
    shoppingChecked:
      raw.shoppingChecked && typeof raw.shoppingChecked === 'object' ? { ...raw.shoppingChecked } : {},
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeDay(raw = {}) {
  return {
    date: str(raw.date),
    dayTypeId: str(raw.dayTypeId) || null,
    slots: (Array.isArray(raw.slots) ? raw.slots : []).slice(0, MAX_SLOTS).map(normalizeSlot),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeSlot(raw = {}) {
  return {
    id: str(raw.id),
    // Label is denormalised onto the slot on purpose: renaming a template must
    // not silently retitle meals already planned in past weeks.
    label: str(raw.label, 'Slot'),
    mealId: str(raw.mealId) || null,
    quantityMultiplier: num(raw.quantityMultiplier, 1),
  };
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function normalizeSettings(raw = {}) {
  return {
    id: SETTINGS_ID,
    defaultSlotTemplateId: str(raw.defaultSlotTemplateId) || null,
    defaultDayTypeId: str(raw.defaultDayTypeId) || null,
    // Fraction of a target that still reads as on-plan. Chasing 2,550 calories
    // to the calorie is not a real goal, and a UI that shows red for being 12
    // over trains you to ignore it.
    targetTolerance: num(raw.targetTolerance, 0.05),
    seeded: Boolean(raw.seeded),
  };
}

/** @type {Record<string, (raw: object) => object>} */
export const NORMALIZERS = {
  ingredients: normalizeIngredient,
  meals: normalizeMeal,
  weeks: normalizeWeek,
  dayTypes: normalizeDayType,
  slotTemplates: normalizeSlotTemplate,
  settings: normalizeSettings,
};

/**
 * @param {string} entity
 * @param {object} record
 * @returns {object}
 */
export function normalize(entity, record) {
  const fn = NORMALIZERS[entity];
  return fn ? fn(record) : record;
}
