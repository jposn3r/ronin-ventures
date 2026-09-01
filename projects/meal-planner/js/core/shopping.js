/* ========================================
   Meal Planner — Shopping list
   ----------------------------------------
   Pure. No DOM, no storage.

   Sums every planned slot in a week down to one
   line per ingredient, then tries to express that
   line in the unit you actually buy in.

   The purchase rollup degrades in three steps,
   and never guesses:

   1. Same dimension  — 42 oz of chicken becomes
      2.6 lb, because oz and lb are both mass.
   2. servingsPerPurchase — a 32 oz carton of egg
      whites is 4 cups, a fact no unit table can
      derive, so the ingredient states it and 7
      cups becomes 2 cartons.
   3. Neither — show the summed serving quantity
      and let the human decide.
   ======================================== */

import { convert, sameDimension, dimensionOf, roundTo } from './units.js';
import { CATEGORIES } from './categories.js';

/** @typedef {import('./units.js').Unit} Unit */

/**
 * @typedef {object} ShoppingLine
 * @property {string} ingredientId
 * @property {string} name
 * @property {string} category
 * @property {number} servings   Total servings needed across the week.
 * @property {number} quantity   servings x servingSize, in `unit`.
 * @property {Unit} unit
 * @property {{amount: number, unit: string, whole: boolean}|null} purchase
 * @property {string} notes
 * @property {string[]} usedIn   Distinct meal names that drove this line.
 */

/**
 * Sum a week's planned slots into a grouped shopping list.
 *
 * @param {object} week
 * @param {Map<string, object>|Record<string, object>} mealsById
 * @param {Map<string, object>|Record<string, object>} ingredientsById
 * @returns {{groups: {category: string, label: string, lines: ShoppingLine[]}[], lineCount: number, unresolved: string[]}}
 */
export function buildShoppingList(week, mealsById, ingredientsById) {
  const meal = asLookup(mealsById);
  const ingredient = asLookup(ingredientsById);

  /** @type {Map<string, {servings: number, usedIn: Set<string>}>} */
  const totals = new Map();
  /** @type {Set<string>} */
  const unresolved = new Set();

  const days = week && Array.isArray(week.days) ? week.days : [];
  for (const day of days) {
    for (const slot of day.slots || []) {
      if (!slot.mealId) continue;
      const m = meal(slot.mealId);
      if (!m) {
        unresolved.add(slot.mealId);
        continue;
      }
      const multiplier = slot.quantityMultiplier == null ? 1 : slot.quantityMultiplier;
      for (const line of m.ingredients || []) {
        const servings = (Number(line.quantity) || 0) * multiplier;
        if (servings === 0) continue;
        const entry = totals.get(line.ingredientId) || { servings: 0, usedIn: new Set() };
        entry.servings += servings;
        entry.usedIn.add(m.name);
        totals.set(line.ingredientId, entry);
      }
    }
  }

  /** @type {Map<string, ShoppingLine[]>} */
  const byCategory = new Map();
  let lineCount = 0;

  for (const [ingredientId, entry] of totals) {
    const ing = ingredient(ingredientId);
    if (!ing) {
      unresolved.add(ingredientId);
      continue;
    }
    const quantity = entry.servings * (Number(ing.servingSize) || 0);
    /** @type {ShoppingLine} */
    const line = {
      ingredientId,
      name: ing.name,
      category: ing.category || 'other',
      servings: entry.servings,
      quantity,
      unit: ing.servingUnit,
      purchase: rollUpToPurchase(ing, quantity, entry.servings),
      notes: ing.notes || '',
      usedIn: [...entry.usedIn].sort(),
    };
    const bucket = byCategory.get(line.category) || [];
    bucket.push(line);
    byCategory.set(line.category, bucket);
    lineCount += 1;
  }

  const groups = CATEGORIES.map((cat) => ({
    category: cat.id,
    label: cat.label,
    lines: (byCategory.get(cat.id) || []).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.lines.length > 0);

  return { groups, lineCount, unresolved: [...unresolved] };
}

/**
 * Express a total quantity in the unit the ingredient is bought in.
 * Returns null when no honest conversion exists.
 *
 * @param {object} ing
 * @param {number} quantity Total in the ingredient's serving unit.
 * @param {number} servings Total servings.
 * @returns {{amount: number, unit: string, whole: boolean}|null}
 */
export function rollUpToPurchase(ing, quantity, servings) {
  const packSize = Number(ing.purchaseSize) > 0 ? Number(ing.purchaseSize) : 1;

  // 1. A real unit conversion, when both units measure the same thing.
  if (ing.purchaseUnit && sameDimension(ing.servingUnit, ing.purchaseUnit)) {
    const converted = convert(quantity, ing.servingUnit, ing.purchaseUnit);
    if (converted != null) {
      const amount = converted / packSize;
      // You can buy 2.6 lb of beef but not 1.4 dozen eggs. Only count units
      // round up; rounding mass up would send you home with a spare pound.
      const whole = dimensionOf(ing.purchaseUnit) === 'count';
      return {
        amount: whole ? Math.ceil(amount) : roundTo(amount, 2),
        unit: ing.purchaseLabel || ing.purchaseUnit,
        whole,
      };
    }
  }

  // 2. The escape hatch for packaged goods, where the ingredient states how
  //    many servings come in one package.
  const perPack = Number(ing.servingsPerPurchase);
  if (perPack > 0) {
    return {
      amount: Math.ceil(servings / perPack),
      unit: ing.purchaseLabel || ing.purchaseUnit || 'pack',
      whole: true,
    };
  }

  // 3. No honest answer. The caller shows the raw serving quantity instead.
  return null;
}

/**
 * @param {Map<string, object>|Record<string, object>} source
 * @returns {(id: string) => object|undefined}
 */
function asLookup(source) {
  if (source instanceof Map) return (id) => source.get(id);
  return (id) => (source ? source[id] : undefined);
}
