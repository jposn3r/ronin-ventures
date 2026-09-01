/* ========================================
   Meal Planner — Pantry
   ----------------------------------------
   The ingredient library, grouped by category.
   Named for what it becomes in the kitchen pass:
   the shelf everything else is built from.
   ======================================== */

import { h, render, fmt } from './el.js';
import { CATEGORIES } from '../core/categories.js';
import { formatQuantity } from '../core/units.js';
import { openIngredientForm } from './ingredientForm.js';

/**
 * @param {HTMLElement} bodyNode
 * @param {HTMLElement} subNode
 * @param {object} ctx
 * @param {{query?: string, showArchived?: boolean}} view
 */
export function renderPantry(bodyNode, subNode, ctx, view = {}) {
  const query = (view.query || '').trim().toLowerCase();
  const all = ctx.allIngredients(Boolean(view.showArchived));
  const matches = query
    ? all.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          i.notes.toLowerCase().includes(query) ||
          i.category.includes(query)
      )
    : all;

  const archivedCount = ctx.allIngredients(true).filter((i) => i.archived).length;
  subNode.textContent = `${matches.length} of ${all.length} ingredients${
    archivedCount ? ` · ${archivedCount} archived` : ''
  }`;

  if (!matches.length) {
    render(bodyNode, h('p.empty-note', { text: query ? 'No ingredients match that search.' : 'The pantry is empty.' }));
    return;
  }

  const archiveToggle = h(
    'label.inline-check',
    h('input', {
      type: 'checkbox',
      checked: Boolean(view.showArchived),
      onChange: (e) => ctx.setPantryView({ showArchived: e.target.checked }),
    }),
    h('span', { text: `Show archived${archivedCount ? ` (${archivedCount})` : ''}` })
  );

  render(
    bodyNode,
    archiveToggle,
    ...CATEGORIES.map((cat) => {
      const lines = matches.filter((i) => i.category === cat.id);
      if (!lines.length) return null;
      return h(
        'section',
        h(
          'div.section-head',
          h('span.section-title', { text: cat.label }),
          h('span.section-count', { text: `${lines.length}` })
        ),
        h('div.card-list', ...lines.map((ing) => IngredientCard({ ing, ctx })))
      );
    }).filter(Boolean)
  );
}

function IngredientCard({ ing, ctx }) {
  const usedBy = ctx.mealsUsingIngredient(ing.id).length;

  return h(
    'button.card.card-button',
    {
      type: 'button',
      class: ing.archived ? 'is-archived' : '',
      onClick: () => openIngredientForm({ ingredient: ing, ctx }),
    },
    h(
      'div.card-head',
      h('span.card-name', { text: ing.name }),
      h('span.card-serving.mono', { text: formatQuantity(ing.servingSize, ing.servingUnit) })
    ),
    h(
      'div.card-macros.mono',
      h('span', { text: `${fmt(ing.calories)} cal` }),
      h('span', { text: `${fmt(ing.protein)}P` }),
      h('span', { text: `${fmt(ing.carbs)}C` }),
      h('span', { text: `${fmt(ing.fat)}F` })
    ),
    h('div.card-sub', {
      text: [
        usedBy ? `Used by ${usedBy} ${usedBy === 1 ? 'meal' : 'meals'}` : 'Not used yet',
        ing.archived ? 'Archived' : '',
        ing.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  );
}
