/* ========================================
   Meal Planner — Meals list and builder
   ----------------------------------------
   The builder recomputes on every keystroke and
   every quantity change. Composing a dish IS a
   macro exercise -- you add chicken until the
   protein number is right -- so the totals sit at
   the top of the dialog and never go stale.
   ======================================== */

import { h, render, fmt } from './el.js';
import { openModal, closeModal, confirmModal } from './modal.js';
import { mealMacros, MACRO_KEYS } from '../core/macros.js';
import { formatQuantity } from '../core/units.js';
import { toast } from './toast.js';

const SHORT = { calories: 'cal', protein: 'P', carbs: 'C', fat: 'F' };

/**
 * @param {HTMLElement} bodyNode
 * @param {HTMLElement} subNode
 * @param {object} ctx
 * @param {{query?: string, showArchived?: boolean}} view
 */
export function renderMeals(bodyNode, subNode, ctx, view = {}) {
  const query = (view.query || '').trim().toLowerCase();
  const all = ctx.allMeals(Boolean(view.showArchived));
  const matches = query
    ? all.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.tags.some((t) => t.includes(query))
      )
    : all;

  const archivedCount = ctx.allMeals(true).filter((m) => m.archived).length;
  subNode.textContent = `${matches.length} of ${all.length} meals${archivedCount ? ` · ${archivedCount} archived` : ''}`;

  if (!matches.length) {
    render(bodyNode, h('p.empty-note', { text: query ? 'No meals match that search.' : 'No meals yet.' }));
    return;
  }

  const tags = [...new Set(all.flatMap((m) => m.tags))].sort();

  render(
    bodyNode,
    h(
      'label.inline-check',
      h('input', {
        type: 'checkbox',
        checked: Boolean(view.showArchived),
        onChange: (e) => ctx.setMealsView({ showArchived: e.target.checked }),
      }),
      h('span', { text: `Show archived${archivedCount ? ` (${archivedCount})` : ''}` })
    ),
    ...tags
      .map((tag) => {
        const lines = matches.filter((m) => m.tags.includes(tag));
        if (!lines.length) return null;
        return h(
          'section',
          h(
            'div.section-head',
            h('span.section-title', { text: tag }),
            h('span.section-count', { text: `${lines.length}` })
          ),
          h('div.card-list', ...lines.map((meal) => MealCard({ meal, ctx })))
        );
      })
      .filter(Boolean),
    (() => {
      const untagged = matches.filter((m) => !m.tags.length);
      return untagged.length
        ? h(
            'section',
            h('div.section-head', h('span.section-title', { text: 'Untagged' })),
            h('div.card-list', ...untagged.map((meal) => MealCard({ meal, ctx })))
          )
        : null;
    })()
  );
}

function MealCard({ meal, ctx }) {
  const macros = mealMacros(meal, ctx.ingredientsById);
  const missing = meal.ingredients.filter((l) => !ctx.ingredientsById.get(l.ingredientId)).length;

  return h(
    'button.card.card-button',
    {
      type: 'button',
      class: meal.archived ? 'is-archived' : '',
      onClick: () => openMealBuilder({ meal, ctx }),
    },
    h(
      'div.card-head',
      h('span.card-name', { text: meal.name }),
      h('span.card-serving.mono', { text: `${fmt(macros.calories)} cal` })
    ),
    h(
      'div.card-macros.mono',
      ...MACRO_KEYS.slice(1).map((k) => h('span', { text: `${fmt(macros[k])}${SHORT[k]}` }))
    ),
    h('div.card-sub', {
      text: [
        `${meal.ingredients.length} ${meal.ingredients.length === 1 ? 'ingredient' : 'ingredients'}`,
        missing ? `${missing} missing` : '',
        meal.archived ? 'Archived' : '',
        meal.description,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  );
}

/**
 * @param {object} params
 * @param {object|null} params.meal Null to create.
 * @param {object} params.ctx
 */
export function openMealBuilder({ meal, ctx }) {
  const editing = Boolean(meal);
  /** Working copy. Nothing is written until Save. */
  let lines = meal ? meal.ingredients.map((l) => ({ ...l })) : [];

  const nameInput = h('input.input', {
    type: 'text',
    value: meal ? meal.name : '',
    placeholder: 'Chicken and rice',
    autocomplete: 'off',
  });
  const descInput = h('textarea.input.textarea', {
    rows: '2',
    placeholder: 'How it goes together',
    text: meal ? meal.description : '',
  });
  const tagsInput = h('input.input', {
    type: 'text',
    value: meal ? meal.tags.join(', ') : '',
    placeholder: 'lunch, dinner',
    autocomplete: 'off',
  });

  const totalsNode = h('div.builder-totals');
  const linesNode = h('div.builder-lines');

  const ingredientOptions = ctx.allIngredients(false);

  const addSelect = h(
    'select.select',
    h('option', { value: '', text: '+ Add ingredient' }),
    ...ingredientOptions.map((i) =>
      h('option', { value: i.id, text: `${i.name} — ${formatQuantity(i.servingSize, i.servingUnit)}` })
    )
  );
  addSelect.addEventListener('change', () => {
    const id = addSelect.value;
    if (!id) return;
    addSelect.value = '';
    if (lines.some((l) => l.ingredientId === id)) {
      toast('Already in this meal — change its quantity instead.', 'bad');
      return;
    }
    lines.push({ ingredientId: id, quantity: 1 });
    paint();
  });

  function paint() {
    const draft = { ingredients: lines };
    const macros = mealMacros(draft, ctx.ingredientsById);

    render(
      totalsNode,
      ...MACRO_KEYS.map((key) =>
        h(
          'div.builder-total',
          h('span.builder-total-key', { text: key === 'calories' ? 'Calories' : key[0].toUpperCase() + key.slice(1) }),
          h('span.builder-total-value.mono', { text: fmt(macros[key]) })
        )
      )
    );

    render(
      linesNode,
      lines.length
        ? lines.map((line, index) => {
            const ing = ctx.ingredientsById.get(line.ingredientId);
            if (!ing) {
              return h(
                'div.builder-line.is-missing',
                h('span.builder-name', { text: 'Ingredient no longer exists' }),
                h('button.link-btn', {
                  type: 'button',
                  text: 'Remove',
                  onClick: () => {
                    lines.splice(index, 1);
                    paint();
                  },
                })
              );
            }
            const lineMacros = {
              calories: ing.calories * line.quantity,
              protein: ing.protein * line.quantity,
            };
            const qty = h('input.input.qty-input', {
              type: 'number',
              min: '0',
              // Quarter servings. A finer step makes the spinner arrows
              // useless without making any real portion easier to reach —
              // any value can still be typed.
              step: '0.25',
              value: String(line.quantity),
              'aria-label': `Servings of ${ing.name}`,
              onInput: (e) => {
                line.quantity = Number(e.target.value) || 0;
                paint();
              },
            });
            return h(
              'div.builder-line',
              { class: ing.archived ? 'is-archived' : '' },
              h(
                'div.builder-line-main',
                h('span.builder-name', { text: ing.name }),
                h('span.builder-serving', {
                  // The serving is what a quantity of 1 means, so it has to be
                  // visible while typing the quantity.
                  text: `${formatQuantity(ing.servingSize * line.quantity, ing.servingUnit)} · ${fmt(lineMacros.calories)} cal · ${fmt(lineMacros.protein)}P`,
                })
              ),
              qty,
              h('button.icon-btn.builder-remove', {
                type: 'button',
                'aria-label': `Remove ${ing.name}`,
                text: '×',
                onClick: () => {
                  lines.splice(index, 1);
                  paint();
                },
              })
            );
          })
        : h('p.field-hint', { text: 'No ingredients yet. Add one below.' })
    );
  }

  paint();

  async function save() {
    const name = nameInput.value.trim();
    if (!name) {
      toast('Give the meal a name.', 'bad');
      nameInput.focus();
      return;
    }
    if (!lines.length) {
      toast('A meal needs at least one ingredient.', 'bad');
      return;
    }
    await ctx.saveMeal({
      ...(meal || {}),
      name,
      description: descInput.value.trim(),
      tags: tagsInput.value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      ingredients: lines.filter((l) => l.quantity > 0),
    });
    toast(editing ? 'Meal updated.' : 'Meal created.');
    closeModal();
  }

  const plannedIn = editing ? ctx.slotsUsingMeal(meal.id) : [];

  openModal({
    title: editing ? meal.name : 'New meal',
    size: 'wide',
    body: [
      h('div.builder-totals-wrap', totalsNode),
      h('label.field', h('span.field-label', { text: 'Name' }), nameInput),
      h('label.field', h('span.field-label', { text: 'Description' }), descInput),
      h('label.field', h('span.field-label', { text: 'Tags' }), tagsInput,
        h('span.field-hint', { text: 'Comma separated. Used to pre-filter the picker by slot.' })),
      h('span.field-label.form-section', { text: 'Ingredients' }),
      linesNode,
      addSelect,
      plannedIn.length
        ? h('p.field-hint', { text: `Planned in ${plannedIn.length} ${plannedIn.length === 1 ? 'slot' : 'slots'} across your saved weeks.` })
        : null,
    ],
    actions: [
      editing
        ? h('button.btn-danger', {
            type: 'button',
            text: meal.archived ? 'Restore' : 'Archive',
            onClick: async () => {
              if (!meal.archived && plannedIn.length) {
                const go = await confirmModal({
                  title: `Archive ${meal.name}?`,
                  message: `It is planned in ${plannedIn.length} ${plannedIn.length === 1 ? 'slot' : 'slots'}. Archiving hides it from the picker; those days keep their macros and show the name struck through.`,
                  confirmLabel: 'Archive',
                  danger: true,
                });
                if (!go) return;
              }
              await ctx.setArchived('meals', meal.id, !meal.archived);
              toast(meal.archived ? 'Restored.' : 'Archived.');
              closeModal();
            },
          })
        : null,
      h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal }),
      h('button.btn-primary', { type: 'button', text: 'Save', onClick: save }),
    ].filter(Boolean),
  });
}
