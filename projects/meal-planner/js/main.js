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
import { setDayType, copyWeek, isWeekEmpty } from './core/week.js';
import { addDays, mondayOf, today } from './core/dates.js';

/** @type {string} Monday of the week on screen. */
let weekStart = mondayOf(today());

/** @type {string} */
let activeView = 'plan';

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

    toast,
  };

  return ctx;
}

/* ============ Rendering ============ */

function renderActiveView() {
  const ctx = buildContext();

  if (activeView === 'plan') {
    renderWeekLabel($('week-range'), $('week-sub'), weekStart);
    renderWeekGrid($('week-grid'), $('week-summary'), ctx);
    return;
  }

  // The remaining sections land in the next increment.
  const host = { shopping: 'shopping-body', meals: 'meals-body', pantry: 'pantry-body', settings: 'settings-body' }[activeView];
  if (host) {
    render($(host), h('p.empty-note', { text: 'Coming in the next increment.' }));
  }
}

function setView(view) {
  activeView = view;
  for (const tab of $('view-tabs').children) {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  }
  for (const section of document.querySelectorAll('.view')) {
    section.classList.toggle('is-active', section.id === `view-${view}`);
  }
  renderActiveView();
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

  // Left and right arrows page the week, but not while a dialog or a text
  // field has focus — arrow keys mean something else there.
  document.addEventListener('keydown', (e) => {
    if (activeView !== 'plan') return;
    if (!$('modal').hidden) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') goToWeek(addDays(weekStart, -7));
    if (e.key === 'ArrowRight') goToWeek(addDays(weekStart, 7));
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
