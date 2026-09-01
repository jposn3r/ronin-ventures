/* ========================================
   Meal Planner — Seed meals
   ----------------------------------------
   The twenty interchangeable dishes, four slots
   plus the training-day add-ons.

   Quantities are SERVINGS of the ingredient, not
   grams. Chicken breast is a 6 oz serving, so
   quantity 1 is 6 oz and 0.67 is 4 oz.

   Tags are hints for the meal picker's filter,
   not rules. Nothing stops steak and eggs going
   in the dinner slot.

   The computed macros will differ by a gram or
   two from the totals written in the source doc,
   which were rounded by hand. Computed wins:
   correcting an ingredient corrects every dish
   that uses it.
   ======================================== */

import { ingredientId } from './ingredients.js';

/**
 * @param {string} name
 * @param {string} tag
 * @param {string} description
 * @param {Array<[string, number]>} lines [ingredient name, servings]
 */
function meal(name, tag, description, lines) {
  return {
    id: 'meal_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    name,
    description,
    tags: [tag],
    ingredients: lines.map(([ingName, quantity]) => ({
      ingredientId: ingredientId(ingName),
      quantity,
    })),
    archived: false,
  };
}

export const SEED_MEALS = [
  /* ---- M1 Breakfast — target 50g protein ---- */
  meal('Scramble and toast', 'breakfast', 'Three eggs and a cup of whites scrambled, two slices of sourdough, a cup of berries.', [
    ['Whole egg', 3],
    ['Liquid egg whites', 1],
    ['Sourdough', 2],
    ['Berries', 1],
  ]),
  meal('Egg white oats', 'breakfast', 'Cook the oats, then stir the whites in while hot — it sets into a thick custard with no egg taste. Two whole eggs on the side.', [
    ['Oats', 1],
    ['Liquid egg whites', 1],
    ['Whole egg', 2],
    ['Banana', 1],
  ]),
  meal('Breakfast burrito bowl', 'breakfast', 'Eggs and whites over rice, salsa and hot sauce.', [
    ['Whole egg', 3],
    ['Liquid egg whites', 1],
    ['White or jasmine rice', 1],
    ['Salsa', 1],
    ['Hot sauce', 1],
  ]),
  meal('Steak and eggs', 'breakfast', 'Weekend breakfast. Four ounces of steak, two eggs, a cup of whites, one slice of sourdough.', [
    ['Steak sirloin or flank', 0.67],
    ['Whole egg', 2],
    ['Liquid egg whites', 1],
    ['Sourdough', 1],
  ]),

  /* ---- M2 Lunch — target 55g protein ---- */
  meal('Chicken and rice', 'lunch', 'Six ounces of chicken, a cup of rice, two cups of veg, hot sauce.', [
    ['Chicken breast', 1],
    ['White or jasmine rice', 1],
    ['Mixed vegetables', 1],
    ['Hot sauce', 1],
  ]),
  meal('Chicken pasta', 'lunch', 'The old lunch, corrected: the chicken portion is what makes it work.', [
    ['Chicken breast', 1],
    ['Pasta', 1],
    ['Marinara', 1],
    ['Mixed vegetables', 1],
  ]),
  meal('Chicken sweet potato bowl', 'lunch', 'Chicken, a medium sweet potato, two cups of veg, sugar-free BBQ.', [
    ['Chicken breast', 1],
    ['Sweet potato', 1],
    ['Mixed vegetables', 1],
    ['BBQ sauce sugar-free', 1],
  ]),
  meal('Chicken tacos', 'lunch', 'Three corn tortillas, salsa, a quarter avocado, shredded cabbage.', [
    ['Chicken breast', 1],
    ['Corn tortilla', 3],
    ['Salsa', 1],
    ['Avocado', 0.5],
    ['Shredded cabbage', 1],
  ]),

  /* ---- M3 Afternoon — target 50g protein ---- */
  meal('Beef and sweet potato', 'afternoon', 'Eight ounces raw of 93/7 browned with taco seasoning, one medium sweet potato.', [
    ['Ground beef 93/7', 1],
    ['Sweet potato', 1],
    ['Taco seasoning', 1],
  ]),
  meal('Turkey meatballs', 'afternoon', 'Eight ounces raw of ground turkey as meatballs, marinara, a cup of rice.', [
    ['Ground turkey 93/7', 1],
    ['Marinara', 1],
    ['White or jasmine rice', 1],
  ]),
  meal('Steak and rice', 'afternoon', 'Six ounces of steak, a cup of rice, hot sauce or chimichurri.', [
    ['Steak sirloin or flank', 1],
    ['White or jasmine rice', 1],
    ['Hot sauce', 1],
    ['Olive oil', 0.33],
  ]),
  meal('Chicken round two', 'afternoon', 'The lighter option. Chicken, a sweet potato, mustard or hot sauce.', [
    ['Chicken breast', 1],
    ['Sweet potato', 1],
    ['Mustard', 1],
  ]),

  /* ---- M4 Dinner — target 50g protein ---- */
  meal('Salmon rice bowl', 'dinner', 'Seven ounces of salmon, a cup of rice, two cups of veg, teriyaki.', [
    ['Salmon', 1],
    ['White or jasmine rice', 1],
    ['Mixed vegetables', 1],
    ['Teriyaki or soy sauce', 1],
  ]),
  meal('Burgers, no bun', 'dinner', 'Two patties from eight ounces raw, a sweet potato, side salad, mustard and pickles.', [
    ['Ground beef 93/7', 1],
    ['Sweet potato', 1],
    ['Salad greens', 1],
    ['Olive oil', 0.33],
    ['Mustard', 1],
    ['Pickles', 1],
  ]),
  meal('Steak dinner', 'dinner', 'Six ounces of steak, rice or a large sweet potato, two cups of green beans or broccoli.', [
    ['Steak sirloin or flank', 1],
    ['White or jasmine rice', 1],
    ['Mixed vegetables', 1],
  ]),
  meal('Beef bolognese', 'dinner', 'Eight ounces raw browned into marinara, over a cup of pasta.', [
    ['Ground beef 93/7', 1],
    ['Marinara', 1],
    ['Pasta', 1],
    ['Mixed vegetables', 1],
  ]),
  meal('Salmon and potato', 'dinner', 'Salmon, a sweet potato, asparagus, lemon.', [
    ['Salmon', 1],
    ['Sweet potato', 1],
    ['Asparagus', 1],
    ['Lemon', 1],
  ]),

  /* ---- Training-day add-ons ----
     The one difference between a training day and a rest day is roughly 250
     extra calories of carbohydrate. Modelled as their own dishes so the add-on
     drops into a fifth slot on training days and the shopping list counts it,
     rather than living as an untracked note. */
  meal('Add-on: rice', 'addon', 'Training day only. One extra cup of rice, usually on M3.', [
    ['White or jasmine rice', 1],
  ]),
  meal('Add-on: banana and toast', 'addon', 'Training day only. A banana and a slice of sourdough.', [
    ['Banana', 1],
    ['Sourdough', 1],
  ]),
  meal("Add-on: Nelly's bar", 'addon', 'Training day only, up to three times a week. A planned dessert now, not breakfast.', [
    ["Nelly's bar", 1],
  ]),
];

/** Tags used by the meal picker filter, in slot order. */
export const MEAL_TAGS = ['breakfast', 'lunch', 'afternoon', 'dinner', 'addon'];
