/* ========================================
   Meal Planner — Ingredient categories
   ----------------------------------------
   Ordered the way the store is walked, not
   alphabetically. The shopping list groups by
   this order so the list reads top to bottom as
   you move through the aisles.
   ======================================== */

/** @typedef {'protein'|'carb'|'veg'|'fat'|'sauce'|'other'} Category */

/** @type {{id: Category, label: string}[]} */
export const CATEGORIES = [
  { id: 'protein', label: 'Protein' },
  { id: 'carb', label: 'Carbs' },
  { id: 'veg', label: 'Vegetables & fruit' },
  { id: 'fat', label: 'Fats' },
  { id: 'sauce', label: 'Sauces & seasoning' },
  { id: 'other', label: 'Other' },
];

/** @type {Category[]} */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/**
 * @param {string} id
 * @returns {string}
 */
export function categoryLabel(id) {
  const found = CATEGORIES.find((c) => c.id === id);
  return found ? found.label : 'Other';
}
