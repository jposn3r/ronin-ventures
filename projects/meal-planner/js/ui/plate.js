/* ========================================
   Meal Planner — Plate
   ----------------------------------------
   One slot in one day. Named for what it becomes
   in the kitchen pass: an empty plate you put a
   dish on.

   Clicking the body picks or swaps the dish.
   The corner button edits the slot itself —
   rename, reorder, remove — which is a different
   kind of change and should not be reachable by
   the same tap that fills lunch.
   ======================================== */

import { h, fmt } from './el.js';
import { slotMacros } from '../core/macros.js';

/**
 * @param {object} params
 * @param {object} params.slot
 * @param {number} params.dayIndex
 * @param {object} params.ctx
 * @returns {HTMLElement}
 */
export function Plate({ slot, dayIndex, ctx }) {
  const meal = slot.mealId ? ctx.mealsById.get(slot.mealId) : null;
  const filled = Boolean(meal);
  const macros = filled ? slotMacros(slot, ctx.mealsById, ctx.ingredientsById) : null;

  // A meal that was archived after being planned still renders, with its name
  // struck through. Silently blanking the plate would look like data loss.
  const archived = meal && meal.archived;
  // A meal deleted outright leaves a dangling reference. Say so rather than
  // showing an empty plate that invites a double-booking.
  const dangling = Boolean(slot.mealId) && !meal;

  const body = h(
    'button.plate-body',
    {
      type: 'button',
      onClick: () => ctx.openPicker(dayIndex, slot),
      title: filled ? `${meal.name} — click to swap or adjust` : 'Click to add a meal',
    },
    h('span.plate-label', { text: slot.label }),
    dangling
      ? h('span.plate-meal.is-missing', { text: 'Meal no longer exists' })
      : filled
        ? h(
            'span.plate-meal',
            { class: archived ? 'is-archived' : '' },
            meal.name,
            slot.quantityMultiplier !== 1
              ? h('span.plate-mult', { text: `${fmt(slot.quantityMultiplier, 2)}x` })
              : null
          )
        : h('span.plate-empty-hint', { text: '+' }),
    macros
      ? h(
          'span.plate-macros.mono',
          h('span', { text: `${fmt(macros.calories)}` }),
          h('span.plate-macros-sep', { text: '·' }),
          h('span', { text: `${fmt(macros.protein)}P` })
        )
      : null
  );

  return h(
    'div.plate',
    { class: filled ? 'is-filled' : 'is-empty', dataset: { slotId: slot.id } },
    body,
    h('button.plate-menu', {
      type: 'button',
      'aria-label': `Edit the ${slot.label} slot`,
      title: 'Edit this slot',
      onClick: (e) => {
        e.stopPropagation();
        ctx.openSlotEditor(dayIndex, slot);
      },
      text: '⋯',
    })
  );
}
