/* ========================================
   Meal Planner — Seed ingredients
   ----------------------------------------
   Jake's portion cheat sheet, plus the sauces and
   sides the dishes reference.

   Macros are PER SERVING, and a serving is the
   amount in the `size`/`unit` columns. Cooked
   weight unless the notes say otherwise.

   The `buy` block drives the shopping list only.
   It never affects macros. Two forms:
     { unit, size }        a real unit conversion
                           (6 oz servings roll up
                           into pounds)
     { label, per }        a package holding `per`
                           servings, for anything
                           units cannot bridge (a
                           32 oz carton of whites
                           is 4 cups, and no unit
                           table can derive that)

   Seeded once on first load. After that this file
   is inert -- edit ingredients in the Pantry, not
   here, or your changes will not appear.
   ======================================== */

/**
 * @param {string} name
 * @param {string} category
 * @param {number} size
 * @param {string} unit
 * @param {[number, number, number, number]} macros [cal, protein, carbs, fat]
 * @param {{unit?: string, size?: number, label?: string, per?: number}|null} buy
 * @param {string} [notes]
 */
function ing(name, category, size, unit, macros, buy, notes = '') {
  const [calories, protein, carbs, fat] = macros;
  return {
    id: 'ing_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    name,
    category,
    servingSize: size,
    servingUnit: unit,
    calories,
    protein,
    carbs,
    fat,
    purchaseUnit: (buy && buy.unit) || null,
    purchaseSize: (buy && buy.size) || null,
    purchaseLabel: (buy && buy.label) || null,
    servingsPerPurchase: (buy && buy.per) || null,
    notes,
    archived: false,
  };
}

/* ---- The portion cheat sheet ---- */

export const SEED_INGREDIENTS = [
  // Protein
  ing('Chicken breast', 'protein', 6, 'oz', [280, 53, 0, 6], { unit: 'lb', size: 1 }, 'Cooked weight. Buy precooked — zero cooking.'),
  ing('Ground beef 93/7', 'protein', 8, 'oz', [345, 48, 0, 16], { unit: 'lb', size: 1 }, 'Raw weight, about 6 oz cooked. Cook 2.5–3 lb Sunday.'),
  ing('Ground turkey 93/7', 'protein', 8, 'oz', [340, 43, 0, 18], { unit: 'lb', size: 1 }, 'Raw weight.'),
  ing('Steak sirloin or flank', 'protein', 6, 'oz', [340, 51, 0, 14], { unit: 'lb', size: 1 }, 'Cooked weight. Cook two at once, slice, refrigerate.'),
  ing('Salmon', 'protein', 7, 'oz', [410, 44, 0, 24], { unit: 'lb', size: 1 }, 'Cooked weight. Air fryer 12 min at 400F. Cook fresh — reheated salmon is not great.'),
  ing('Whole egg', 'protein', 1, 'each', [70, 6, 0, 5], { unit: 'dozen', size: 1 }, 'Large. Five minutes daily, non-negotiable.'),
  ing('Liquid egg whites', 'protein', 1, 'cup', [125, 26, 2, 0], { label: 'carton', per: 4 }, 'A 32 oz carton is about 4 cups.'),

  // Carbs
  ing('White or jasmine rice', 'carb', 1, 'cup', [205, 4, 45, 0], { label: 'lb dry', per: 6.75 }, 'Cooked. Rice cooker, 4 cups dry twice a week.'),
  ing('Sweet potato', 'carb', 1, 'each', [130, 2, 30, 0], { unit: 'each', size: 1 }, 'Medium, about 5 oz. Microwave 6–7 minutes.'),
  ing('Pasta', 'carb', 1, 'cup', [200, 7, 42, 1], { label: 'box', per: 8 }, 'Cooked, from 2 oz dry.'),
  ing('Oats', 'carb', 0.5, 'cup', [150, 5, 27, 3], { label: 'container', per: 18 }, 'Dry measure.'),
  ing('Sourdough', 'carb', 1, 'slice', [100, 4, 18, 1], { label: 'loaf', per: 16 }, ''),
  ing('Corn tortilla', 'carb', 1, 'each', [50, 1, 11, 1], { label: 'pack', per: 30 }, 'Estimated — check your brand.'),

  // Vegetables and fruit
  ing('Mixed vegetables', 'veg', 2, 'cup', [50, 3, 10, 0], { label: 'bag (1 lb)', per: 1.5 }, 'Broccoli, green beans, peppers, zucchini. Frozen is fine.'),
  ing('Berries', 'veg', 1, 'cup', [80, 1, 20, 0], { label: 'bag', per: 4 }, 'Frozen is fine.'),
  ing('Banana', 'veg', 1, 'each', [105, 1, 27, 0], { unit: 'each', size: 1 }, 'Medium.'),
  ing('Shredded cabbage', 'veg', 1, 'cup', [20, 1, 4, 0], { label: 'bag', per: 6 }, 'Estimated.'),
  ing('Asparagus', 'veg', 1, 'cup', [27, 3, 5, 0], { label: 'bunch', per: 4 }, 'Estimated.'),
  ing('Salad greens', 'veg', 2, 'cup', [15, 1, 3, 0], { label: 'clamshell', per: 5 }, 'Estimated.'),

  // Fats
  ing('Olive oil', 'fat', 1, 'tbsp', [120, 0, 0, 14], { label: 'bottle', per: 32 }, ''),
  ing('Avocado', 'fat', 0.5, 'each', [120, 1, 6, 11], { unit: 'each', size: 1 }, 'Half an avocado per serving.'),

  // Sauces and seasoning. Near-zero-calorie ones are how the same five
  // proteins stay interesting, so they are real ingredients rather than
  // an untracked "add sauce" note.
  ing('Salsa', 'sauce', 2, 'tbsp', [10, 0, 2, 0], { label: 'jar', per: 16 }, 'Estimated.'),
  ing('Hot sauce', 'sauce', 1, 'tsp', [0, 0, 0, 0], { label: 'bottle', per: 60 }, 'Effectively free.'),
  ing('Marinara', 'sauce', 0.5, 'cup', [70, 2, 10, 2], { label: 'jar', per: 6 }, 'Estimated.'),
  ing('Pesto', 'sauce', 1, 'tbsp', [80, 1, 1, 8], { label: 'jar', per: 12 }, 'Estimated.'),
  ing('BBQ sauce sugar-free', 'sauce', 2, 'tbsp', [15, 0, 4, 0], { label: 'bottle', per: 16 }, 'G Hughes. Estimated.'),
  ing('Teriyaki or soy sauce', 'sauce', 1, 'tbsp', [15, 1, 3, 0], { label: 'bottle', per: 30 }, 'Estimated.'),
  ing('Mustard', 'sauce', 1, 'tsp', [0, 0, 0, 0], { label: 'bottle', per: 60 }, 'Effectively free.'),
  ing('Pickles', 'sauce', 1, 'oz', [5, 0, 1, 0], { label: 'jar', per: 24 }, 'Estimated.'),
  ing('Taco seasoning', 'sauce', 1, 'tbsp', [20, 0, 4, 0], { label: 'packet', per: 4 }, 'Estimated.'),

  // Other
  ing('Lemon', 'other', 1, 'each', [5, 0, 2, 0], { unit: 'each', size: 1 }, ''),
  ing("Nelly's bar", 'other', 1, 'each', [270, 10, 25, 16], { label: 'box', per: 12 }, 'Macros ESTIMATED beyond the 270 cal / 16F on the label — correct these in the Pantry. Planned dessert, max 3x per week.'),
];

/** @type {Record<string, object>} Convenience lookup for the seed meals. */
export const SEED_INGREDIENTS_BY_NAME = Object.fromEntries(
  SEED_INGREDIENTS.map((i) => [i.name, i])
);

/**
 * @param {string} name
 * @returns {string} The seeded id for an ingredient name.
 */
export function ingredientId(name) {
  const found = SEED_INGREDIENTS_BY_NAME[name];
  if (!found) throw new Error(`Seed error: no ingredient named "${name}"`);
  return found.id;
}
