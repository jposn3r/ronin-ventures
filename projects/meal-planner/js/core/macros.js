/* ========================================
   Meal Planner — Macro math
   ----------------------------------------
   Pure. No DOM, no storage. Every number the UI
   shows about calories or macros comes from here.

   Two rules hold throughout:

   1. Macros are COMPUTED, never stored. A meal's
      totals are derived from its ingredients on
      every read, so editing an ingredient's macros
      corrects every meal that uses it at once.

   2. Nothing rounds until display. A day is four
      meals of six ingredients each; rounding at
      the ingredient level compounds into a
      visibly wrong daily total.
   ======================================== */

/** @typedef {import('./units.js').Unit} Unit */
/** @typedef {{calories: number, protein: number, carbs: number, fat: number}} Macros */

/** @type {Macros} */
export const EMPTY_MACROS = Object.freeze({ calories: 0, protein: 0, carbs: 0, fat: 0 });

/** @type {(keyof Macros)[]} Canonical display order. */
export const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'];

/**
 * @param {...Macros} parts
 * @returns {Macros}
 */
export function addMacros(...parts) {
  return parts.reduce(
    (sum, m) => ({
      calories: sum.calories + (m?.calories || 0),
      protein: sum.protein + (m?.protein || 0),
      carbs: sum.carbs + (m?.carbs || 0),
      fat: sum.fat + (m?.fat || 0),
    }),
    { ...EMPTY_MACROS }
  );
}

/**
 * @param {Macros} m
 * @param {number} factor
 * @returns {Macros}
 */
export function scaleMacros(m, factor) {
  const f = Number(factor) || 0;
  return {
    calories: (m?.calories || 0) * f,
    protein: (m?.protein || 0) * f,
    carbs: (m?.carbs || 0) * f,
    fat: (m?.fat || 0) * f,
  };
}

/**
 * Macros for a quantity of one ingredient.
 * @param {object} ingredient
 * @param {number} quantity Number of SERVINGS, not grams. An ingredient whose
 *   serving is "6 oz cooked" at quantity 1.5 is 9 oz.
 * @returns {Macros}
 */
export function ingredientMacros(ingredient, quantity) {
  if (!ingredient) return { ...EMPTY_MACROS };
  return scaleMacros(
    {
      calories: ingredient.calories,
      protein: ingredient.protein,
      carbs: ingredient.carbs,
      fat: ingredient.fat,
    },
    quantity
  );
}

/**
 * Macros for one preset meal at 1x.
 * An ingredient that has been deleted outright resolves to nothing and
 * contributes zero — which is why ingredients archive rather than delete.
 * @param {object} meal
 * @param {Map<string, object>|Record<string, object>} ingredientsById
 * @returns {Macros}
 */
export function mealMacros(meal, ingredientsById) {
  if (!meal || !Array.isArray(meal.ingredients)) return { ...EMPTY_MACROS };
  const lookup = asLookup(ingredientsById);
  return addMacros(
    ...meal.ingredients.map((line) => ingredientMacros(lookup(line.ingredientId), line.quantity))
  );
}

/**
 * Macros for a filled slot, honouring its quantityMultiplier.
 * @param {object} slot
 * @param {Map<string, object>|Record<string, object>} mealsById
 * @param {Map<string, object>|Record<string, object>} ingredientsById
 * @returns {Macros}
 */
export function slotMacros(slot, mealsById, ingredientsById) {
  if (!slot || !slot.mealId) return { ...EMPTY_MACROS };
  const meal = asLookup(mealsById)(slot.mealId);
  if (!meal) return { ...EMPTY_MACROS };
  const multiplier = slot.quantityMultiplier == null ? 1 : slot.quantityMultiplier;
  return scaleMacros(mealMacros(meal, ingredientsById), multiplier);
}

/**
 * @param {object} day
 * @param {Map<string, object>|Record<string, object>} mealsById
 * @param {Map<string, object>|Record<string, object>} ingredientsById
 * @returns {Macros}
 */
export function dayTotals(day, mealsById, ingredientsById) {
  if (!day || !Array.isArray(day.slots)) return { ...EMPTY_MACROS };
  return addMacros(...day.slots.map((slot) => slotMacros(slot, mealsById, ingredientsById)));
}

/**
 * @param {object} week
 * @param {Map<string, object>|Record<string, object>} mealsById
 * @param {Map<string, object>|Record<string, object>} ingredientsById
 * @returns {{total: Macros, perDay: Macros[], average: Macros}}
 */
export function weekTotals(week, mealsById, ingredientsById) {
  const days = week && Array.isArray(week.days) ? week.days : [];
  const perDay = days.map((day) => dayTotals(day, mealsById, ingredientsById));
  const total = addMacros(...perDay);
  const average = perDay.length ? scaleMacros(total, 1 / perDay.length) : { ...EMPTY_MACROS };
  return { total, perDay, average };
}

/** @typedef {'under'|'on'|'over'} TargetState */
/** @typedef {{actual: number, target: number, delta: number, pct: number, state: TargetState}} MacroComparison */

/**
 * Compare a set of totals against a day type's targets.
 *
 * `tolerance` is a fraction of the target that still counts as on-plan. Hitting
 * 2,550 calories to the calorie is not a real goal, and a UI that shows red for
 * being 12 calories over trains you to ignore it.
 *
 * @param {Macros} totals
 * @param {Macros} target
 * @param {number} [tolerance] Default 0.05 (±5%).
 * @returns {Record<keyof Macros, MacroComparison>}
 */
export function compareToTarget(totals, target, tolerance = 0.05) {
  /** @type {any} */
  const out = {};
  for (const key of MACRO_KEYS) {
    const actual = totals?.[key] || 0;
    const goal = target?.[key] || 0;
    const delta = actual - goal;
    const band = goal * tolerance;
    /** @type {TargetState} */
    let state = 'on';
    if (goal > 0) {
      if (delta > band) state = 'over';
      else if (delta < -band) state = 'under';
    } else if (actual > 0) {
      state = 'over';
    }
    out[key] = {
      actual,
      target: goal,
      delta,
      pct: goal > 0 ? actual / goal : 0,
      state,
    };
  }
  return out;
}

/**
 * Calories implied by the macro split, at 4/4/9 per gram.
 * The meal builder shows this beside the entered calories so a typo in an
 * ingredient's numbers is visible at entry time rather than three weeks later.
 * @param {Macros} m
 * @returns {number}
 */
export function caloriesFromMacros(m) {
  return (m?.protein || 0) * 4 + (m?.carbs || 0) * 4 + (m?.fat || 0) * 9;
}

/**
 * Accept either a Map or a plain object as a lookup table.
 * @param {Map<string, object>|Record<string, object>} source
 * @returns {(id: string) => object|undefined}
 */
function asLookup(source) {
  if (source instanceof Map) return (id) => source.get(id);
  return (id) => (source ? source[id] : undefined);
}
