/* ========================================
   Meal Planner — Id generation
   ----------------------------------------
   Client-generated ids, so a record has a stable
   identity before it ever reaches storage. When
   a real backend arrives these stay the primary
   key and the sync becomes idempotent for free.
   ======================================== */

/**
 * @param {string} [prefix]
 * @returns {string}
 */
export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A url- and filename-safe slug. Used for seeded ids so the seed data reads
 * as `ing_chicken_breast` rather than an opaque timestamp.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}
