/* ========================================
   Meal Planner — Totals readouts
   ----------------------------------------
   Two shapes over the same comparison: a compact
   block under each day, and a wide row for the
   week.

   Every number carries a signed delta next to it,
   so over and under are legible without relying
   on colour alone.
   ======================================== */

import { h, fmt, fmtDelta } from './el.js';
import { compareToTarget, MACRO_KEYS } from '../core/macros.js';

const SHORT = { calories: 'cal', protein: 'P', carbs: 'C', fat: 'F' };

/**
 * The block beneath one day column.
 * @param {object} params
 * @param {import('../core/macros.js').Macros} params.totals
 * @param {object|null} params.dayType
 * @param {number} params.tolerance
 * @returns {HTMLElement}
 */
export function DayTotals({ totals, dayType, tolerance }) {
  if (!dayType) {
    return h(
      'div.day-totals.is-untargeted',
      h('div.total-line', h('span.total-value.mono', { text: fmt(totals.calories) }), h('span.total-unit', { text: 'cal' })),
      h('div.total-macros.mono', {
        text: MACRO_KEYS.slice(1).map((k) => `${fmt(totals[k])}${SHORT[k]}`).join('  '),
      }),
      h('div.total-hint', { text: 'No day type' })
    );
  }

  const cmp = compareToTarget(totals, dayType.targets, tolerance);

  return h(
    'div.day-totals',
    h(
      'div.total-line',
      h('span.total-value.mono', { class: `state-${cmp.calories.state}`, text: fmt(totals.calories) }),
      h('span.total-unit', { text: 'cal' }),
      h('span.total-delta.mono', {
        class: `state-${cmp.calories.state}`,
        text: fmtDelta(cmp.calories.delta),
      })
    ),
    h('div.total-bar', h('div.total-bar-fill', {
      class: `state-${cmp.calories.state}`,
      // Capped so a wildly over day does not paint outside its track.
      style: { width: `${Math.min(100, Math.max(0, cmp.calories.pct * 100))}%` },
    })),
    h(
      'div.total-macros',
      ...MACRO_KEYS.slice(1).map((key) =>
        h(
          'span.macro-chip',
          { class: `state-${cmp[key].state}`, title: `${SHORT[key]}: ${fmt(totals[key])} of ${fmt(dayType.targets[key])}g` },
          h('span.mono', { text: fmt(totals[key]) }),
          h('span.macro-key', { text: SHORT[key] })
        )
      )
    )
  );
}

/**
 * The wide row under the grid: week totals and the daily average against a
 * blended target, since the week mixes training and rest days.
 * @param {object} params
 * @param {{total: import('../core/macros.js').Macros, perDay: import('../core/macros.js').Macros[], average: import('../core/macros.js').Macros}} params.week
 * @param {import('../core/macros.js').Macros} params.targetTotal
 * @param {number} params.plannedDays
 * @param {number} params.tolerance
 * @returns {HTMLElement}
 */
export function WeekSummary({ week, targetTotal, plannedDays, tolerance }) {
  const cmp = compareToTarget(week.total, targetTotal, tolerance);

  return h(
    'div.summary-inner',
    h(
      'div.summary-head',
      h('span.summary-title', { text: 'Week' }),
      h('span.summary-sub', {
        text: plannedDays === 7 ? 'all 7 days planned' : `${plannedDays} of 7 days planned`,
      })
    ),
    h(
      'div.summary-stats',
      ...MACRO_KEYS.map((key) =>
        h(
          'div.summary-stat',
          h('div.summary-key', { text: key === 'calories' ? 'Calories' : key[0].toUpperCase() + key.slice(1) }),
          h(
            'div.summary-value.mono',
            { class: `state-${cmp[key].state}` },
            fmt(week.total[key]),
            h('span.summary-target', { text: ` / ${fmt(targetTotal[key])}` })
          ),
          h('div.summary-delta.mono', {
            class: `state-${cmp[key].state}`,
            text: `${fmtDelta(cmp[key].delta)} for the week`,
          })
        )
      )
    ),
    h(
      'div.summary-avg',
      h('span.summary-avg-label', { text: 'Daily average' }),
      h('span.summary-avg-value.mono', {
        text: MACRO_KEYS.map((k) => `${fmt(week.average[k])}${k === 'calories' ? ' cal' : SHORT[k]}`).join('   '),
      })
    )
  );
}
