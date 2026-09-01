/* ========================================
   Meal Planner — Week grid
   ----------------------------------------
   The main view. Seven day columns, plates
   stacked inside each, totals underneath.

   One week at a time, by design. There is no
   month view and no calendar.
   ======================================== */

import { h, render, fmt } from './el.js';
import { DayColumn } from './dayColumn.js';
import { WeekSummary } from './totals.js';
import { weekTotals, EMPTY_MACROS, addMacros } from '../core/macros.js';
import { formatWeekRange, weeksBetween, today, mondayOf } from '../core/dates.js';

/**
 * @param {HTMLElement} gridNode
 * @param {HTMLElement} summaryNode
 * @param {object} ctx
 */
export function renderWeekGrid(gridNode, summaryNode, ctx) {
  render(gridNode, ...ctx.week.days.map((day, dayIndex) => DayColumn({ day, dayIndex, ctx })));

  const totals = weekTotals(ctx.week, ctx.mealsById, ctx.ingredientsById);

  // The week's target is the sum of each day's own target, so a week of five
  // training days and two rest days is measured against what it actually was
  // rather than against a notional average day.
  const targetTotal = ctx.week.days.reduce((sum, day) => {
    const type = day.dayTypeId ? ctx.dayTypesById.get(day.dayTypeId) : null;
    return type ? addMacros(sum, type.targets) : sum;
  }, { ...EMPTY_MACROS });

  const plannedDays = ctx.week.days.filter((day) => day.slots.some((s) => s.mealId)).length;

  render(summaryNode, WeekSummary({
    week: totals,
    targetTotal,
    plannedDays,
    tolerance: ctx.settings.targetTolerance,
  }));
}

/**
 * The label and sub-label above the grid.
 * @param {HTMLElement} rangeNode
 * @param {HTMLElement} subNode
 * @param {string} weekStart
 */
export function renderWeekLabel(rangeNode, subNode, weekStart) {
  rangeNode.textContent = formatWeekRange(weekStart);

  const offset = weeksBetween(mondayOf(today()), weekStart);
  let sub;
  if (offset === 0) sub = 'This week';
  else if (offset === 1) sub = 'Next week';
  else if (offset === -1) sub = 'Last week';
  else if (offset > 0) sub = `${fmt(offset)} weeks ahead`;
  else sub = `${fmt(Math.abs(offset))} weeks ago`;

  subNode.textContent = sub;
  subNode.classList.toggle('is-current', offset === 0);
}
