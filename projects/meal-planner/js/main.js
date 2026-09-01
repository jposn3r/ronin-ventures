/* ========================================
   Meal Planner — Entry point
   ----------------------------------------
   Boots the store, wires the chrome, and owns the
   one piece of view state that is not persisted:
   which week you are looking at and which tab is
   open.

   Rendering is a full repaint of the active view.
   A week is seven columns of four or five plates,
   so diffing would cost more to maintain than it
   could ever save.
   ======================================== */

import * as store from './store.js';
import { $, h, render } from './ui/el.js';
import { initModal } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { renderWeekGrid, renderWeekLabel } from './ui/weekGrid.js';
import { openMealPicker } from './ui/mealPicker.js';
import { openSlotEditor, openDayCopy } from './ui/slotEditor.js';
import { renderShoppingList, copyShoppingList } from './ui/shoppingList.js';
import { renderPantry } from './ui/pantry.js';
import { openMealBuilder } from './ui/mealBuilder.js';
import { renderScene } from './ui/scene.js';
import { openIngredientForm } from './ui/ingredientForm.js';
import { renderSettings } from './ui/settings.js';
import { setDayType, copyWeek, isWeekEmpty } from './core/week.js';
import { addDays, mondayOf, today } from './core/dates.js';

/** @type {string} Monday of the week on screen. */
let weekStart = mondayOf(today());

/** @type {string} */
let activeView = 'plan';

/** Per-view UI state that is intentionally not persisted. */
const viewState = {
  pantry: { query: '', showArchived: false },
  meals: { query: '', showArchived: false },
  // Which dish is centred in the scene, and whether the chrome is dismissed.
  scene: { index: 0, immersive: false },
};

/* ============ Context handed to every component ============ */

function buildContext() {
  const dayTypes = store.get.dayTypes();

  const ctx = {
    // A getter, not a snapshot. A dialog stays open across several edits — set
    // a portion, then swap the dish — and each one must build on the last.
    // Closing over the week as it was when the dialog opened silently reverts
    // the edit before it.
    get week() {
      return store.get.week(weekStart);
    },
    weekStart,
    meals: store.get.meals(),
    mealsById: store.get.mealsById(),
    ingredientsById: store.get.ingredientsById(),
    dayTypes,
    dayTypesById: new Map(dayTypes.map((t) => [t.id, t])),
    settings: store.get.settings(),

    /** Persist a new week object and repaint. */
    update(nextWeek) {
      store.saveWeek(nextWeek).catch((err) => toast(err.message, 'bad'));
    },

    setDayType(dayIndex, dayTypeId) {
      ctx.update(setDayType(ctx.week, dayIndex, dayTypeId));
    },

    openPicker(dayIndex, slot) {
      openMealPicker({ dayIndex, slot, ctx: buildContext() });
    },

    openSlotEditor(dayIndex, slot) {
      openSlotEditor({ dayIndex, slot, ctx: buildContext() });
    },

    openDayCopy(dayIndex) {
      openDayCopy({ dayIndex, ctx: buildContext() });
    },

    /* ---- Library reads, including archived when asked ---- */
    allIngredients: (includeArchived) => store.get.ingredients(includeArchived),
    allMeals: (includeArchived) => store.get.meals(includeArchived),
    allDayTypes: (includeArchived) => store.get.dayTypes(includeArchived),
    slotTemplates: store.get.slotTemplates(),
    mealsUsingIngredient: (id) => store.get.mealsUsingIngredient(id),
    slotsUsingMeal: (id) => store.get.slotsUsingMeal(id),

    /* ---- Writes. Every one repaints through the store subscription. ---- */
    saveIngredient: (record) => store.saveIngredient(record),
    saveMeal: (record) => store.saveMeal(record),
    saveDayType: (record) => store.saveDayType(record),
    saveSlotTemplate: (record) => store.saveSlotTemplate(record),
    saveSettings: (patch) => store.saveSettings(patch),
    setArchived: (entity, id, archived) => store.setArchived(entity, id, archived),
    exportAll: () => store.exportAll(),
    importAll: (payload, opts) => store.importAll(payload, opts),
    resetToSeed: () => store.resetToSeed(),

    toggleShoppingCheck(ingredientId, isChecked) {
      const week = ctx.week;
      const next = { ...week, shoppingChecked: { ...week.shoppingChecked } };
      if (isChecked) next.shoppingChecked[ingredientId] = true;
      else delete next.shoppingChecked[ingredientId];
      ctx.update(next);
    },

    clearShoppingChecks() {
      ctx.update({ ...ctx.week, shoppingChecked: {} });
    },

    setPantryView(patch) {
      Object.assign(viewState.pantry, patch);
      renderActiveView();
    },

    setMealsView(patch) {
      Object.assign(viewState.meals, patch);
      renderActiveView();
    },

    get sceneIndex() {
      return viewState.scene.index;
    },

    setSceneIndex(index) {
      viewState.scene.index = index;
      renderActiveView();
    },

    setSceneImmersive(on) {
      viewState.scene.immersive = Boolean(on);
      document.body.classList.toggle('is-immersive', viewState.scene.immersive);
      renderActiveView();
    },

    toast,
  };

  return ctx;
}

/* ============ Rendering ============ */

function renderActiveView() {
  const ctx = buildContext();

  switch (activeView) {
    case 'plan':
      renderWeekLabel($('week-range'), $('week-sub'), weekStart);
      renderWeekGrid($('week-grid'), $('week-summary'), ctx);
      break;
    case 'shopping':
      renderShoppingList($('shopping-body'), $('shopping-sub'), ctx);
      break;
    case 'pantry':
      renderPantry($('pantry-body'), $('pantry-sub'), ctx, viewState.pantry);
      break;
    case 'meals':
      renderScene($('meals-body'), ctx, viewState.scene);
      break;
    case 'settings':
      renderSettings($('settings-body'), ctx);
      break;
  }
}

/** Mirrors the view-out duration in base.css. */
const FADE_OUT_MS = 220;

/** Lets a second tab click cancel the previous cleanup. */
let viewTransition = null;

function setView(view) {
  if (view === activeView) return;

  const outgoing = document.getElementById(`view-${activeView}`);
  const incoming = document.getElementById(`view-${view}`);
  activeView = view;

  for (const tab of $('view-tabs').children) {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  }

  // The swap happens NOW rather than after the fade. The outgoing view is
  // taken out of flow and fades on top of the incoming one, so the two
  // overlap and the screen is never empty. Waiting for the fade to finish
  // before swapping is what produced the flash, and it also put the new view
  // a fifth of a second behind the click for no benefit.
  if (viewTransition) clearTimeout(viewTransition);
  if (outgoing) {
    outgoing.classList.remove('is-active');
    outgoing.classList.add('is-leaving');
    viewTransition = setTimeout(() => {
      outgoing.classList.remove('is-leaving');
      viewTransition = null;
    }, FADE_OUT_MS);
  }

  for (const section of document.querySelectorAll('.view')) {
    if (section !== incoming && section !== outgoing) {
      section.classList.remove('is-active', 'is-leaving');
    }
  }
  incoming.classList.remove('is-leaving');
  incoming.classList.add('is-active');

  // The scene is a fixed, full-height stage. Letting the page scroll behind it
  // exposes a strip of counter-coloured nothing under the photograph.
  document.body.classList.toggle('is-scene', view === 'meals');
  if (view !== 'meals' && viewState.scene.immersive) {
    viewState.scene.immersive = false;
    document.body.classList.remove('is-immersive');
  }

  renderActiveView();
  // Open each tab at its top. Carrying the previous offset drops you into the
  // middle of the new view, and a shorter view silently clamps it to zero
  // anyway. Deliberately NOT in renderActiveView(), which the store calls on
  // every save; scrolling to the top on each edit would be worse than the jump.
  window.scrollTo(0, 0);
}

/* ============ Week navigation ============ */

function goToWeek(nextStart) {
  weekStart = nextStart;
  renderActiveView();
}

function copyPreviousWeek() {
  const previous = store.get.week(addDays(weekStart, -7));
  if (isWeekEmpty(previous)) {
    toast('Last week is empty — nothing to copy.', 'bad');
    return;
  }
  const current = store.get.week(weekStart);
  const proceed =
    isWeekEmpty(current) ||
    window.confirm('This week already has meals planned. Copying last week will overwrite them.');
  if (!proceed) return;

  store
    .saveWeek(copyWeek(previous, weekStart))
    .then(() => toast('Copied last week.'))
    .catch((err) => toast(err.message, 'bad'));
}

/* ============ Boot ============ */

async function boot() {
  initModal();

  $('view-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) setView(tab.dataset.view);
  });

  $('week-prev').addEventListener('click', () => goToWeek(addDays(weekStart, -7)));
  $('week-next').addEventListener('click', () => goToWeek(addDays(weekStart, 7)));
  $('week-today').addEventListener('click', () => goToWeek(mondayOf(today())));
  $('week-copy-prev').addEventListener('click', copyPreviousWeek);

  $('shopping-copy').addEventListener('click', () => copyShoppingList(buildContext()));
  $('shopping-uncheck').addEventListener('click', () => buildContext().clearShoppingChecks());

  $('ingredient-new').addEventListener('click', () =>
    openIngredientForm({ ingredient: null, ctx: buildContext() })
  );

  $('pantry-search').addEventListener('input', (e) => {
    viewState.pantry.query = e.target.value;
    renderActiveView();
  });

  // Arrow keys mean different things per view: paging weeks on the plan,
  // moving along the counter in the scene. Never while a dialog or a text
  // field has focus, where they already mean something.
  document.addEventListener('keydown', (e) => {
    if (!$('modal').hidden) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (activeView === 'plan') {
      if (e.key === 'ArrowLeft') goToWeek(addDays(weekStart, -7));
      if (e.key === 'ArrowRight') goToWeek(addDays(weekStart, 7));
      return;
    }

    if (activeView === 'meals') {
      const ctx = buildContext();
      if (e.key === 'ArrowLeft') ctx.setSceneIndex(viewState.scene.index - 1);
      if (e.key === 'ArrowRight') ctx.setSceneIndex(viewState.scene.index + 1);
      // Escape leaves immersive mode before it does anything else, so the
      // dismissed chrome is always one familiar key away.
      if (e.key === 'Escape' && viewState.scene.immersive) ctx.setSceneImmersive(false);
    }
  });

  try {
    await store.init();
  } catch (err) {
    console.error(err);
    render(
      $('week-grid'),
      h('p.empty-note', { text: `Could not load your data: ${err.message}` })
    );
    return;
  }

  store.subscribe(renderActiveView);
  renderActiveView();
}

boot();
