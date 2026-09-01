/* ========================================
   Meal Planner — Day column
   ----------------------------------------
   One day: its header and day-type toggle, its
   stack of plates, and its totals against target.
   ======================================== */

import { h } from './el.js';
import { Plate } from './plate.js';
import { DayTotals } from './totals.js';
import { dayTotals } from '../core/macros.js';
import { DAY_ABBR, formatShort, today, weekdayIndex } from '../core/dates.js';
import { addSlot } from '../core/week.js';

const MAX_SLOTS = 10;

/**
 * @param {object} params
 * @param {object} params.day
 * @param {number} params.dayIndex
 * @param {object} params.ctx
 * @returns {HTMLElement}
 */
export function DayColumn({ day, dayIndex, ctx }) {
  const isToday = day.date === today();
  const dayType = day.dayTypeId ? ctx.dayTypesById.get(day.dayTypeId) : null;
  const totals = dayTotals(day, ctx.mealsById, ctx.ingredientsById);

  const typeSelect = h(
    'select.daytype-select',
    {
      'aria-label': `Day type for ${DAY_ABBR[weekdayIndex(day.date)]}`,
      onChange: (e) => ctx.setDayType(dayIndex, e.target.value || null),
    },
    h('option', { value: '', text: 'No type', selected: !day.dayTypeId }),
    ...ctx.dayTypes.map((t) =>
      h('option', { value: t.id, text: t.name, selected: t.id === day.dayTypeId })
    )
  );
  if (dayType) typeSelect.style.setProperty('--type-color', dayType.color);

  return h(
    'div.day-col',
    { class: isToday ? 'is-today' : '', dataset: { dayIndex: String(dayIndex) } },

    h(
      'header.day-head',
      h(
        'div.day-head-top',
        h('span.day-name', { text: DAY_ABBR[weekdayIndex(day.date)] }),
        h('span.day-date', { text: formatShort(day.date) }),
        h('button.day-menu', {
          type: 'button',
          'aria-label': `Copy ${DAY_ABBR[weekdayIndex(day.date)]} to another day`,
          title: 'Copy this day',
          text: '⧉',
          onClick: () => ctx.openDayCopy(dayIndex),
        })
      ),
      typeSelect
    ),

    h(
      'div.plates',
      ...day.slots.map((slot) => Plate({ slot, dayIndex, ctx })),
      day.slots.length < MAX_SLOTS
        ? h('button.add-slot', {
            type: 'button',
            text: '+ slot',
            title: 'Add a slot to this day',
            onClick: () => ctx.update(addSlot(ctx.week, dayIndex)),
          })
        : null
    ),

    DayTotals({ totals, dayType, tolerance: ctx.settings.targetTolerance })
  );
}
