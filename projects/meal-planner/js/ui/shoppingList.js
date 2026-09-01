/* ========================================
   Meal Planner — Shopping list view
   ----------------------------------------
   The week's planned slots, summed to one line
   per ingredient and grouped in aisle order.

   Each line shows both numbers: what to buy, and
   the underlying quantity it came from. The
   rollup is an estimate built on package sizes,
   so showing "10 bags" without "28 cups" hides
   the one number you can actually sanity-check
   in the aisle.

   Ticks live on the week record, so they survive
   a reload and do not follow you into next week.
   ======================================== */

import { h, render, fmt } from './el.js';
import { buildShoppingList } from '../core/shopping.js';
import { formatQuantity } from '../core/units.js';
import { formatWeekRange } from '../core/dates.js';
import { toast } from './toast.js';

/**
 * @param {HTMLElement} bodyNode
 * @param {HTMLElement} subNode
 * @param {object} ctx
 */
export function renderShoppingList(bodyNode, subNode, ctx) {
  const list = buildShoppingList(ctx.week, ctx.mealsById, ctx.ingredientsById);
  const checked = ctx.week.shoppingChecked || {};
  const tickedCount = list.groups
    .flatMap((g) => g.lines)
    .filter((l) => checked[l.ingredientId]).length;

  subNode.textContent = list.lineCount
    ? `${formatWeekRange(ctx.weekStart)} · ${list.lineCount} items · ${tickedCount} ticked`
    : formatWeekRange(ctx.weekStart);

  if (!list.lineCount) {
    render(
      bodyNode,
      h('p.empty-note', { text: 'Nothing planned this week yet. Fill some plates and the list builds itself.' })
    );
    return;
  }

  render(
    bodyNode,
    list.unresolved.length
      ? h('p.warn-note', {
          text: `${list.unresolved.length} planned ${list.unresolved.length === 1 ? 'item refers' : 'items refer'} to a meal or ingredient that no longer exists. Those are not counted below.`,
        })
      : null,
    ...list.groups.map((group) =>
      h(
        'section.shop-group',
        h(
          'div.section-head',
          h('span.section-title', { text: group.label }),
          h('span.section-count', { text: `${group.lines.length}` })
        ),
        h('div.shop-lines', ...group.lines.map((line) => ShoppingLine({ line, checked, ctx })))
      )
    )
  );
}

/**
 * @param {object} params
 * @returns {HTMLElement}
 */
function ShoppingLine({ line, checked, ctx }) {
  const isTicked = Boolean(checked[line.ingredientId]);
  const raw = formatQuantity(line.quantity, line.unit);

  const box = h('input.shop-check', {
    type: 'checkbox',
    checked: isTicked,
    'aria-label': line.name,
    onChange: (e) => ctx.toggleShoppingCheck(line.ingredientId, e.target.checked),
  });

  return h(
    'label.shop-line',
    { class: isTicked ? 'is-ticked' : '' },
    box,
    h(
      'span.shop-main',
      h('span.shop-name', { text: line.name }),
      line.usedIn.length
        ? h('span.shop-used', { text: line.usedIn.join(', ') })
        : null,
      line.notes ? h('span.shop-notes', { text: line.notes }) : null
    ),
    h(
      'span.shop-amounts',
      line.purchase
        ? h('span.shop-buy.mono', {
            text: `${fmt(line.purchase.amount, line.purchase.whole ? 0 : 2)} ${pluralise(line.purchase.unit, line.purchase.amount)}`,
          })
        : h('span.shop-buy.mono', { text: raw }),
      // The raw quantity is the cross-check on the package maths. Only
      // redundant when the rollup did nothing.
      line.purchase ? h('span.shop-raw.mono', { text: raw }) : null
    )
  );
}

/**
 * @param {string} unit
 * @param {number} amount
 * @returns {string}
 */
function pluralise(unit, amount) {
  if (amount === 1) return unit;
  if (/^(lb|oz|g|ml|dozen)$/.test(unit)) return unit;
  return unit.endsWith('s') ? unit : `${unit}s`;
}

/**
 * Flatten the list into text for a phone's notes app.
 * @param {object} ctx
 * @returns {string}
 */
export function shoppingListAsText(ctx) {
  const list = buildShoppingList(ctx.week, ctx.mealsById, ctx.ingredientsById);
  const lines = [`Shopping — ${formatWeekRange(ctx.weekStart)}`, ''];
  for (const group of list.groups) {
    lines.push(group.label.toUpperCase());
    for (const line of group.lines) {
      const amount = line.purchase
        ? `${fmt(line.purchase.amount, line.purchase.whole ? 0 : 2)} ${pluralise(line.purchase.unit, line.purchase.amount)}`
        : formatQuantity(line.quantity, line.unit);
      lines.push(`  ${line.name} — ${amount}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/**
 * @param {object} ctx
 */
export async function copyShoppingList(ctx) {
  const text = shoppingListAsText(ctx);
  if (!text) {
    toast('Nothing planned to copy.', 'bad');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Shopping list copied.');
  } catch {
    // Clipboard access needs a secure context and can be refused outright.
    // Falling back to a selectable prompt beats a dead button.
    window.prompt('Copy the list:', text);
  }
}
