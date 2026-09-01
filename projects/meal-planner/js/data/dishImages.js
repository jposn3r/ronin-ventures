/* ========================================
   Meal Planner — Dish photography manifest
   ----------------------------------------
   Which meals have a plated photograph.

   Explicit rather than probed by convention:
   guessing a filename and handling onerror
   produces a 404 per missing dish on every load,
   and the scene needs to know up front which
   dishes it can show.

   Add a line here when art lands. This is also
   the file the local image-generation path will
   write into later.
   ======================================== */

export const DISH_IMAGE_BASE = '/projects/meal-planner/assets/dishes/';

/**
 * mealId -> filename. Every file is a transparent WebP, cropped tight to the
 * plate so the image's bottom edge IS the plate's contact point, and
 * normalised to the same plate width so dishes sit at one scale on the
 * counter. See the asset pipeline notes in the scene styles.
 * @type {Record<string, string>}
 */
export const DISH_IMAGES = {
  meal_chicken_pasta: 'meal_chicken_pasta.webp',
  meal_steak_dinner: 'meal_steak_dinner.webp',
};

/**
 * @param {string} mealId
 * @returns {string|null} Full path, or null when the dish has no photograph.
 */
export function dishImage(mealId) {
  const file = DISH_IMAGES[mealId];
  return file ? DISH_IMAGE_BASE + file : null;
}

/**
 * @param {object[]} meals
 * @returns {object[]} Only the meals that can actually be shown in the scene.
 */
export function mealsWithImages(meals) {
  return meals.filter((m) => Boolean(DISH_IMAGES[m.id]));
}

export const SCENE_BACKGROUND = '/projects/meal-planner/assets/scene/counter-desktop.webp';
