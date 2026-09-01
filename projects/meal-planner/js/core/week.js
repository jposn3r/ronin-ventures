/* ========================================
   Meal Planner — Week construction
   ----------------------------------------
   Pure. No DOM, no storage.

   Every mutation returns a NEW week rather than
   editing in place. The store can then treat "did
   this change?" as an identity check, and undo or
   optimistic-update behaviour stays available
   later without rewriting any of this.
   ======================================== */

import { weekDates } from './dates.js';
import { makeId } from './ids.js';

const MAX_SLOTS = 10;
const MIN_SLOTS = 1;

/**
 * Build an empty week from a slot template.
 * @param {string} weekStart Monday, ISO.
 * @param {{slots: {id: string, label: string}[]}} slotTemplate
 * @param {string|null} defaultDayTypeId
 * @returns {object}
 */
export function createWeek(weekStart, slotTemplate, defaultDayTypeId) {
  const labels = (slotTemplate && slotTemplate.slots) || [];
  return {
    id: weekStart,
    weekStart,
    days: weekDates(weekStart).map((date) => ({
      date,
      dayTypeId: defaultDayTypeId || null,
      // Slot ids are per-day and freshly generated. Sharing template ids across
      // days would make "remove Tuesday's third slot" ambiguous.
      slots: labels.map((s) => newSlot(s.label)),
    })),
    shoppingChecked: {},
  };
}

/**
 * @param {string} label
 * @returns {object}
 */
export function newSlot(label) {
  return { id: makeId('slot'), label: label || 'Slot', mealId: null, quantityMultiplier: 1 };
}

/**
 * True when nothing has been planned. Used to decide whether a week is worth
 * persisting — browsing ten weeks ahead should not write ten empty records.
 * @param {object} week
 * @returns {boolean}
 */
export function isWeekEmpty(week) {
  if (!week || !Array.isArray(week.days)) return true;
  return week.days.every((day) => (day.slots || []).every((slot) => !slot.mealId));
}

/**
 * Replace one day inside a week, returning a new week.
 * @param {object} week
 * @param {number} dayIndex
 * @param {(day: object) => object} fn
 * @returns {object}
 */
export function updateDay(week, dayIndex, fn) {
  return {
    ...week,
    days: week.days.map((day, i) => (i === dayIndex ? fn(day) : day)),
  };
}

/**
 * @param {object} week
 * @param {number} dayIndex
 * @param {string} slotId
 * @param {(slot: object) => object} fn
 * @returns {object}
 */
export function updateSlot(week, dayIndex, slotId, fn) {
  return updateDay(week, dayIndex, (day) => ({
    ...day,
    slots: day.slots.map((slot) => (slot.id === slotId ? fn(slot) : slot)),
  }));
}

/**
 * @param {object} week
 * @param {number} dayIndex
 * @param {string} slotId
 * @param {string|null} mealId
 * @param {number} [multiplier]
 * @returns {object}
 */
export function setSlotMeal(week, dayIndex, slotId, mealId, multiplier = 1) {
  return updateSlot(week, dayIndex, slotId, (slot) => ({
    ...slot,
    mealId: mealId || null,
    // Clearing a slot resets the multiplier. Leaving 1.5x behind on an empty
    // plate is a trap the next meal silently inherits.
    quantityMultiplier: mealId ? multiplier : 1,
  }));
}

/**
 * @param {object} week
 * @param {number} dayIndex
 * @param {string|null} dayTypeId
 * @returns {object}
 */
export function setDayType(week, dayIndex, dayTypeId) {
  return updateDay(week, dayIndex, (day) => ({ ...day, dayTypeId: dayTypeId || null }));
}

/**
 * @param {object} week
 * @param {number} dayIndex
 * @param {string} [label]
 * @returns {object}
 */
export function addSlot(week, dayIndex, label) {
  return updateDay(week, dayIndex, (day) => {
    if (day.slots.length >= MAX_SLOTS) return day;
    return { ...day, slots: [...day.slots, newSlot(label || `Slot ${day.slots.length + 1}`)] };
  });
}

/**
 * @param {object} week
 * @param {number} dayIndex
 * @param {string} slotId
 * @returns {object}
 */
export function removeSlot(week, dayIndex, slotId) {
  return updateDay(week, dayIndex, (day) => {
    if (day.slots.length <= MIN_SLOTS) return day;
    return { ...day, slots: day.slots.filter((s) => s.id !== slotId) };
  });
}

/**
 * @param {object} week
 * @param {number} dayIndex
 * @param {string} slotId
 * @param {string} label
 * @returns {object}
 */
export function renameSlot(week, dayIndex, slotId, label) {
  return updateSlot(week, dayIndex, slotId, (slot) => ({ ...slot, label: label || slot.label }));
}

/**
 * Move a slot up or down within its day.
 * @param {object} week
 * @param {number} dayIndex
 * @param {string} slotId
 * @param {number} delta -1 for up, 1 for down.
 * @returns {object}
 */
export function moveSlot(week, dayIndex, slotId, delta) {
  return updateDay(week, dayIndex, (day) => {
    const from = day.slots.findIndex((s) => s.id === slotId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= day.slots.length) return day;
    const slots = [...day.slots];
    [slots[from], slots[to]] = [slots[to], slots[from]];
    return { ...day, slots };
  });
}

/**
 * Copy one day's plan onto another day in the same week.
 * The destination keeps its own date; everything else is replaced.
 * @param {object} week
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {object}
 */
export function copyDay(week, fromIndex, toIndex) {
  if (fromIndex === toIndex) return week;
  const source = week.days[fromIndex];
  if (!source) return week;
  return updateDay(week, toIndex, (day) => ({
    date: day.date,
    dayTypeId: source.dayTypeId,
    // Fresh slot ids so the two days stay independently editable.
    slots: source.slots.map((slot) => ({ ...slot, id: makeId('slot') })),
  }));
}

/**
 * Copy an entire week's plan onto a different week start.
 * Shopping checkboxes are deliberately NOT copied — last week's ticked
 * boxes are not a claim about this week's shopping.
 * @param {object} source
 * @param {string} targetWeekStart
 * @returns {object}
 */
export function copyWeek(source, targetWeekStart) {
  const dates = weekDates(targetWeekStart);
  return {
    id: targetWeekStart,
    weekStart: targetWeekStart,
    days: dates.map((date, i) => {
      const from = source.days[i];
      return {
        date,
        dayTypeId: from ? from.dayTypeId : null,
        slots: from ? from.slots.map((slot) => ({ ...slot, id: makeId('slot') })) : [],
      };
    }),
    shoppingChecked: {},
  };
}

/**
 * Apply a slot template to every day, preserving meals where the slot count
 * allows. Used when the default template changes and the week is still empty.
 * @param {object} week
 * @param {{slots: {label: string}[]}} slotTemplate
 * @returns {object}
 */
export function applyTemplate(week, slotTemplate) {
  const labels = (slotTemplate && slotTemplate.slots) || [];
  return {
    ...week,
    days: week.days.map((day) => ({
      ...day,
      slots: labels.map((s, i) => {
        const existing = day.slots[i];
        return existing ? { ...existing, label: s.label } : newSlot(s.label);
      }),
    })),
  };
}
