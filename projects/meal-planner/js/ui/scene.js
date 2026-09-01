/* ========================================
   Meal Planner — Scene
   ----------------------------------------
   The immersive view. Dishes sit on a counter in
   a dark kitchen and slide along it.

   Three things carry this file.

   STAGE COORDINATES. The background is a fixed 4:3
   photograph sized to cover, so on a wide viewport
   it crops top and bottom and the counter's edge
   moves relative to the window. Anything that has
   to sit ON the counter is positioned against the
   stage, not the window.

   PERSISTENT DOM. Every other view here repaints
   wholesale, which is right when nothing animates.
   The scene cannot: destroying and rebuilding a
   dish means the replacement is born at its final
   position with nothing to transition from, so the
   move is instant no matter what CSS says. This
   module builds once and then only updates
   positions.

   MOTION FOLLOWS THE COUNTER. Dishes travel up and
   to the right as the island recedes, rather than
   sliding across a flat plane. See COUNTER_RISE for
   why that angle is chosen rather than measured.
   ======================================== */

import { h, render, clear, fmt } from './el.js';
import { mealMacros, MACRO_KEYS } from '../core/macros.js';
import { dishImage, mealsWithImages } from '../data/dishImages.js';

const SHORT = { calories: 'cal', protein: 'P', carbs: 'C', fat: 'F' };

/* ---- Geometry ----
   Dish centres are spaced 1.235 dish-widths apart. Expressing the gap in the
   dish's OWN width keeps the slide a pure percentage, so it needs no pixel
   measurement and survives a resize untouched.

   COUNTER_RISE is the one number here that is chosen rather than measured.
   The photograph's back edge rises 2.36 degrees and its near edge is flat, so
   a literally-correct slope moves a dish about twenty pixels across the whole
   gap — true, and invisible. The counter READS as flowing up and to the right
   much more strongly than that, because the island recedes. This is set to
   roughly 8 degrees to match what the eye reads, and combined with the scale
   falloff it lands as dishes receding along the counter rather than sliding
   across a flat plane. Turn it down if it ever reads as a hill. */
const COUNTER_RISE = 0.14;
const DISH_ASPECT = 0.661;             // cutout height / width
const GAP_IN_WIDTHS = 1.235;
const SLIDE_X_PCT = GAP_IN_WIDTHS * 100;
/* translateY resolves against the element's HEIGHT, so the rise converts out
   of widths and into heights on the way. */
const SLIDE_Y_PCT = -(GAP_IN_WIDTHS * COUNTER_RISE / DISH_ASPECT) * 100;

/* With only a couple of photographs the rail is too short to show a dish
   entering or leaving frame, so the set is tiled until there are enough to
   animate against. Tiling repeats real dishes; it never invents one. */
const MIN_RAIL_LENGTH = 8;

/**
 * @param {object[]} meals
 * @returns {object[]} The rail, long enough that dishes travel off screen.
 */
function tileForRail(meals) {
  if (!meals.length) return [];
  const out = [];
  while (out.length < MIN_RAIL_LENGTH) out.push(...meals);
  return out;
}

/** @type {{host: HTMLElement, root: HTMLElement, key: string, els: object, ctx: object, index: number}|null} */
let mounted = null;

/**
 * @param {HTMLElement} node
 * @param {object} ctx
 * @param {{index: number, immersive: boolean}} view
 */
export function renderScene(node, ctx, view) {
  const meals = mealsWithImages(ctx.allMeals(false));

  if (!meals.length) {
    mounted = null;
    render(node, h('div.scene.is-empty', h('p.empty-note', {
      text: 'No dishes have photographs yet. Add one to js/data/dishImages.js and drop the file in assets/dishes/.',
    })));
    return;
  }

  const rail = tileForRail(meals);
  const key = rail.map((m) => m.id).join('|');
  // Rebuild only when the cast changes, or when something else has taken the
  // host over. Otherwise reuse, so transforms have a previous value to move
  // from and the CSS transition actually runs.
  if (!mounted || mounted.host !== node || mounted.key !== key || !node.contains(mounted.root)) {
    build(node, rail, ctx, key);
  }

  updateScene(rail, meals.length, ctx, view);
}

/* ============ Build (once) ============ */

function build(node, meals, ctx, key) {
  const dishEls = meals.map((meal) =>
    h(
      'div.dish',
      { dataset: { mealId: meal.id } },
      h('div.dish-shadow'),
      h('img.dish-img', {
        src: dishImage(meal.id),
        alt: meal.name,
        decoding: 'async',
        draggable: 'false',
      })
    )
  );

  // Clicking a dish that is not centred brings it to centre.
  dishEls.forEach((el, i) => {
    el.addEventListener('click', () => {
      if (i !== mounted.index) mounted.ctx.setSceneIndex(i);
    });
  });

  const name = h('h2.scene-dish-name');
  const desc = h('p.scene-dish-desc');
  const macroEls = {};
  const macros = h(
    'div.scene-macros',
    ...MACRO_KEYS.map((k) => {
      const value = h('span.scene-macro-value.mono');
      macroEls[k] = value;
      return h('div.scene-macro', value, h('span.scene-macro-key', { text: SHORT[k] }));
    })
  );

  const counter = h('span.mono');
  const remaining = h('span.scene-counter-total');
  const toggle = h('button.scene-toggle', { type: 'button' });
  toggle.addEventListener('click', () => mounted.ctx.setSceneImmersive(!mounted.immersive));

  const prev = h('button.scene-arrow', { type: 'button', 'aria-label': 'Previous dish', text: '‹' });
  const next = h('button.scene-arrow', { type: 'button', 'aria-label': 'Next dish', text: '›' });
  prev.addEventListener('click', () => mounted.ctx.setSceneIndex(mounted.index - 1));
  next.addEventListener('click', () => mounted.ctx.setSceneIndex(mounted.index + 1));

  const root = h(
    'div.scene',
    // The stage is now purely a coordinate space: the kitchen it aligns to is
    // the body's single persistent layer, so drawing it again here would be a
    // second copy to keep in sync and a second layer to paint.
    h('div.scene-stage', h('div.dish-rail', ...dishEls)),
    h(
      'div.scene-ui',
      h('div.scene-caption', name, desc, macros),
      h('div.scene-nav', prev, h('div.scene-counter', counter, remaining), next)
    ),
    toggle
  );

  clear(node);
  node.appendChild(root);

  mounted = {
    host: node,
    root,
    key,
    index: 0,
    immersive: false,
    ctx,
    els: { dishEls, name, desc, macroEls, counter, remaining, toggle },
  };
}

/* ============ Update (every change) ============ */

function updateScene(rail, realCount, ctx, view) {
  const m = mounted;
  m.ctx = ctx;

  const meals = rail;
  const index = ((view.index % meals.length) + meals.length) % meals.length;
  m.index = index;
  m.immersive = view.immersive;

  const active = meals[index];
  const macros = mealMacros(active, ctx.ingredientsById);
  const { dishEls, name, desc, macroEls, counter, remaining, toggle } = m.els;

  dishEls.forEach((el, i) => {
    const offset = i - index;
    const distance = Math.abs(offset);
    /* Depth is DIRECTIONAL, not symmetric. The counter recedes up and to the
       right, so a dish on the right is further away — smaller and higher — and
       one on the left is nearer, which means it must NOT shrink the way the
       right one does. Falling back to |offset| made the left dish small (reads
       as distant) and low (reads as close) at the same time, which is why it
       looked wrong rather than merely misplaced. */
    const scale =
      offset === 0 ? 1
      : offset > 0 ? Math.max(0.44, 1 - offset * 0.22)
      : Math.max(0.88, 1 + offset * 0.06);

    /* Same asymmetry for the vertical. Receding to the right earns the full
       rise; coming forward to the left drops only a fraction of it, or the
       near dish slides off the front edge of the counter. */
    const riseFactor = offset > 0 ? 1 : 0.4;

    // Written as a complete transform rather than assembled in CSS from custom
    // properties. A var() standing in for a term inside a calc() percentage
    // did not resolve here — the declaration parsed, the property computed to
    // the right number, and the second term still evaluated to nothing. An
    // explicit string is unambiguous and transitions reliably.
    el.style.transform =
      `translateX(${(-50 + offset * SLIDE_X_PCT).toFixed(3)}%) ` +
      `translateY(${(offset * SLIDE_Y_PCT * riseFactor).toFixed(3)}%) ` +
      `scale(${scale.toFixed(3)})`;

    // Darkening is a filter on the IMAGE, never an overlay element: a div
    // painted over a cutout darkens its bounding box, leaving a visible
    // rectangle of shaded counter around the plate.
    const brightness =
      offset === 0 ? 1
      : offset > 0 ? Math.max(0.34, 1 - offset * 0.3)
      : Math.max(0.55, 1 + offset * 0.18);
    const img0 = el.querySelector('.dish-img');
    if (img0) img0.style.filter = `drop-shadow(0 2px 6px rgba(0,0,0,0.45)) brightness(${brightness.toFixed(3)})`;
    const shadow = el.querySelector('.dish-shadow');
    if (shadow) shadow.style.opacity = distance === 0 ? '1' : String(Math.max(0.15, 0.5 - distance * 0.15));

    el.style.zIndex = String(100 - distance);
    // Far dishes are off screen; keep them out of the hit-testing and the
    // compositor entirely.
    el.style.visibility = distance > 3 ? 'hidden' : '';
    el.classList.toggle('is-active', distance === 0);
    // Only the centre dish and its immediate neighbours are worth decoding.
    const img = el.querySelector('.dish-img');
    if (img) img.loading = distance <= 1 ? 'eager' : 'lazy';
  });

  name.textContent = active.name;
  desc.textContent = active.description || '';
  desc.style.display = active.description ? '' : 'none';
  for (const k of MACRO_KEYS) macroEls[k].textContent = fmt(macros[k]);

  // Position within the REAL set, not the tiled rail — "3 / 8" would be a lie
  // when only two dishes have photographs.
  counter.textContent = `${(index % realCount) + 1} / ${realCount}`;
  const without = ctx.allMeals(false).length - realCount;
  remaining.textContent = without ? `${without} more without photos` : '';

  toggle.textContent = view.immersive ? '☷' : '⛶';
  toggle.setAttribute('aria-label', view.immersive ? 'Show controls' : 'Hide controls for full view');
  toggle.title = view.immersive ? 'Show controls' : 'Hide controls';

  m.root.classList.toggle('is-immersive', Boolean(view.immersive));
}

/** Exposed so the stylesheet and this module cannot drift apart. */
export const SCENE_GEOMETRY = { SLIDE_X_PCT, SLIDE_Y_PCT, COUNTER_RISE };
