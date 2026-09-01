/* ========================================
   Meal Planner — Slot and day-copy dialogs
   ----------------------------------------
   Structural edits, kept away from the tap that
   fills a plate: renaming a slot, reordering it,
   removing it, and copying one day onto another.
   ======================================== */

import { h } from './el.js';
import { openModal, closeModal } from './modal.js';
import { renameSlot, moveSlot, removeSlot, copyDay } from '../core/week.js';
import { DAY_NAMES } from '../core/dates.js';
import { toast } from './toast.js';

/**
 * @param {object} params
 * @param {number} params.dayIndex
 * @param {object} params.slot
 * @param {object} params.ctx
 */
export function openSlotEditor({ dayIndex, slot, ctx }) {
  const day = ctx.week.days[dayIndex];
  const position = day.slots.findIndex((s) => s.id === slot.id);
  const isOnly = day.slots.length <= 1;

  const labelInput = h('input.input', {
    type: 'text',
    value: slot.label,
    maxlength: '40',
    onKeydown: (e) => {
      if (e.key === 'Enter') save();
    },
  });

  function save() {
    const label = labelInput.value.trim();
    if (label && label !== slot.label) {
      ctx.update(renameSlot(ctx.week, dayIndex, slot.id, label));
    }
    closeModal();
  }

  function move(delta) {
    ctx.update(moveSlot(ctx.week, dayIndex, slot.id, delta));
    closeModal();
  }

  return openModal({
    title: `${DAY_NAMES[dayIndex]} — ${slot.label}`,
    body: [
      h('div.field', h('label.field-label', { text: 'Slot name' }), labelInput,
        h('p.field-hint', { text: 'Renaming affects this day only, not the template or other weeks.' })),
      h(
        'div.field',
        h('span.field-label', { text: 'Position' }),
        h(
          'div.row-buttons',
          h('button.btn-ghost', {
            type: 'button',
            text: '↑ Move up',
            disabled: position <= 0,
            onClick: () => move(-1),
          }),
          h('button.btn-ghost', {
            type: 'button',
            text: '↓ Move down',
            disabled: position >= day.slots.length - 1,
            onClick: () => move(1),
          })
        )
      ),
    ],
    actions: [
      h('button.btn-danger', {
        type: 'button',
        text: 'Remove slot',
        disabled: isOnly,
        title: isOnly ? 'A day needs at least one slot' : 'Remove this slot from this day',
        onClick: () => {
          ctx.update(removeSlot(ctx.week, dayIndex, slot.id));
          closeModal();
        },
      }),
      h('button.btn-primary', { type: 'button', text: 'Save', onClick: save }),
    ],
  });
}

/**
 * Copy one day's plan onto another day in the same week.
 * @param {object} params
 * @param {number} params.dayIndex
 * @param {object} params.ctx
 */
export function openDayCopy({ dayIndex, ctx }) {
  const source = ctx.week.days[dayIndex];
  const filled = source.slots.filter((s) => s.mealId).length;

  if (!filled) {
    toast('That day is empty — nothing to copy.', 'bad');
    return;
  }

  /** @type {Set<number>} */
  const chosen = new Set();

  const targets = h(
    'div.copy-targets',
    ...ctx.week.days.map((day, i) =>
      i === dayIndex
        ? null
        : h('button.copy-target', {
            type: 'button',
            dataset: { index: String(i) },
            onClick: (e) => {
              const btn = e.currentTarget;
              if (chosen.has(i)) chosen.delete(i);
              else chosen.add(i);
              btn.classList.toggle('is-chosen', chosen.has(i));
            },
            text: DAY_NAMES[i],
          })
    ).filter(Boolean)
  );

  openModal({
    title: `Copy ${DAY_NAMES[dayIndex]}`,
    body: [
      h('p.modal-text', {
        text: `${filled} planned ${filled === 1 ? 'meal' : 'meals'}. Pick the days to overwrite.`,
      }),
      targets,
    ],
    actions: [
      h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal }),
      h('button.btn-primary', {
        type: 'button',
        text: 'Copy',
        onClick: () => {
          if (!chosen.size) {
            toast('Pick at least one day to copy onto.', 'bad');
            return;
          }
          let next = ctx.week;
          for (const target of chosen) next = copyDay(next, dayIndex, target);
          ctx.update(next);
          toast(`Copied ${DAY_NAMES[dayIndex]} onto ${chosen.size} ${chosen.size === 1 ? 'day' : 'days'}.`);
          closeModal();
        },
      }),
    ],
  });
}
