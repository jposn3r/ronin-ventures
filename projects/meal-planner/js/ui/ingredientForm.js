/* ========================================
   Meal Planner — Ingredient form
   ----------------------------------------
   Create and edit one ingredient.

   The 4/4/9 cross-check under the macro row is
   the point of this dialog: a typo in an
   ingredient's numbers propagates into every meal
   that uses it and every day those meals land on.
   Catching it at entry costs one line of maths.
   ======================================== */

import { h, fmt } from './el.js';
import { openModal, closeModal, confirmModal } from './modal.js';
import { CATEGORIES } from '../core/categories.js';
import { UNIT_LIST, UNITS } from '../core/units.js';
import { caloriesFromMacros } from '../core/macros.js';
import { toast } from './toast.js';

/**
 * @param {object} params
 * @param {object|null} params.ingredient Null to create.
 * @param {object} params.ctx
 */
export function openIngredientForm({ ingredient, ctx }) {
  const editing = Boolean(ingredient);
  const value = ingredient || {
    name: '',
    category: 'protein',
    servingSize: 1,
    servingUnit: 'oz',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    purchaseUnit: null,
    purchaseSize: null,
    purchaseLabel: null,
    servingsPerPurchase: null,
    notes: '',
  };

  const f = {
    name: input({ value: value.name, placeholder: 'Chicken breast' }),
    category: select(CATEGORIES.map((c) => ({ value: c.id, label: c.label })), value.category),
    servingSize: numberInput(value.servingSize, { min: '0', step: 'any' }),
    servingUnit: select(UNIT_LIST.map((u) => ({ value: u, label: unitLabel(u) })), value.servingUnit),
    calories: numberInput(value.calories, { min: '0', step: 'any' }),
    protein: numberInput(value.protein, { min: '0', step: 'any' }),
    carbs: numberInput(value.carbs, { min: '0', step: 'any' }),
    fat: numberInput(value.fat, { min: '0', step: 'any' }),
    purchaseUnit: select(
      [{ value: '', label: 'None' }, ...UNIT_LIST.map((u) => ({ value: u, label: unitLabel(u) }))],
      value.purchaseUnit || ''
    ),
    purchaseSize: numberInput(value.purchaseSize ?? '', { min: '0', step: 'any', placeholder: '1' }),
    purchaseLabel: input({ value: value.purchaseLabel || '', placeholder: 'carton, loaf, bag' }),
    servingsPerPurchase: numberInput(value.servingsPerPurchase ?? '', { min: '0', step: 'any', placeholder: '4' }),
    notes: input({ value: value.notes, placeholder: 'Cooked weight' }),
  };

  const crossCheck = h('p.field-hint.cross-check');

  function refreshCrossCheck() {
    const macros = {
      protein: Number(f.protein.value) || 0,
      carbs: Number(f.carbs.value) || 0,
      fat: Number(f.fat.value) || 0,
    };
    const implied = caloriesFromMacros(macros);
    const stated = Number(f.calories.value) || 0;
    // Positive gap means the entered calorie figure is HIGHER than the macros
    // account for, so the implied number is the smaller one. The sentence
    // below is written from the implied value's side; getting that direction
    // backwards makes the one check meant to catch typos misreport them.
    const gap = stated - implied;
    // Label calories are rounded and fibre is not counted at 4, so a small
    // gap is normal. Only flag one big enough to be a typo.
    const off = stated > 0 && Math.abs(gap) > Math.max(30, stated * 0.15);

    let comparison = '';
    if (stated > 0) {
      if (gap === 0) comparison = `, exactly the ${fmt(stated)} entered`;
      else comparison = `, ${fmt(Math.abs(gap))} ${gap > 0 ? 'fewer' : 'more'} than the ${fmt(stated)} entered`;
    }
    crossCheck.textContent = `Macros imply ${fmt(implied)} cal at 4/4/9${comparison}`;
    crossCheck.classList.toggle('is-off', off);
  }

  for (const key of ['calories', 'protein', 'carbs', 'fat']) {
    f[key].addEventListener('input', refreshCrossCheck);
  }
  refreshCrossCheck();

  async function save() {
    const name = f.name.value.trim();
    if (!name) {
      toast('Give the ingredient a name.', 'bad');
      f.name.focus();
      return;
    }
    const servingSize = Number(f.servingSize.value);
    if (!(servingSize > 0)) {
      toast('Serving size has to be greater than zero.', 'bad');
      f.servingSize.focus();
      return;
    }

    await ctx.saveIngredient({
      ...(ingredient || {}),
      name,
      category: f.category.value,
      servingSize,
      servingUnit: f.servingUnit.value,
      calories: Number(f.calories.value) || 0,
      protein: Number(f.protein.value) || 0,
      carbs: Number(f.carbs.value) || 0,
      fat: Number(f.fat.value) || 0,
      purchaseUnit: f.purchaseUnit.value || null,
      purchaseSize: f.purchaseSize.value === '' ? null : Number(f.purchaseSize.value),
      purchaseLabel: f.purchaseLabel.value.trim() || null,
      servingsPerPurchase: f.servingsPerPurchase.value === '' ? null : Number(f.servingsPerPurchase.value),
      notes: f.notes.value.trim(),
    });
    toast(editing ? 'Ingredient updated.' : 'Ingredient added.');
    closeModal();
  }

  const usedBy = editing ? ctx.mealsUsingIngredient(ingredient.id) : [];

  openModal({
    title: editing ? ingredient.name : 'New ingredient',
    size: 'wide',
    body: [
      h('div.form-row',
        field('Name', f.name),
        field('Category', f.category)),

      h('div.form-row',
        field('Serving size', f.servingSize),
        field('Unit', f.servingUnit)),

      h('span.field-label.form-section', { text: 'Macros per serving' }),
      h('div.form-row.form-row-4',
        field('Calories', f.calories),
        field('Protein g', f.protein),
        field('Carbs g', f.carbs),
        field('Fat g', f.fat)),
      crossCheck,

      h('span.field-label.form-section', { text: 'How you buy it' }),
      h('p.field-hint', {
        text: 'Shopping list only — never affects macros. Use the unit when it converts from the serving unit (6 oz servings roll into pounds). Use servings per package when it cannot (a 32 oz carton is 4 cups).',
      }),
      h('div.form-row',
        field('Purchase unit', f.purchaseUnit),
        field('Units per package', f.purchaseSize)),
      h('div.form-row',
        field('Package name', f.purchaseLabel),
        field('Servings per package', f.servingsPerPurchase)),

      field('Notes', f.notes),

      usedBy.length
        ? h('p.field-hint', { text: `Used by ${usedBy.length} ${usedBy.length === 1 ? 'meal' : 'meals'}: ${usedBy.map((m) => m.name).join(', ')}` })
        : null,
    ],
    actions: [
      editing
        ? h('button.btn-danger', {
            type: 'button',
            text: ingredient.archived ? 'Restore' : 'Archive',
            onClick: async () => {
              if (!ingredient.archived && usedBy.length) {
                const go = await confirmModal({
                  title: `Archive ${ingredient.name}?`,
                  message: `${usedBy.length} ${usedBy.length === 1 ? 'meal uses' : 'meals use'} it: ${usedBy.map((m) => m.name).join(', ')}. Archiving hides it from pickers but keeps those meals computing correctly.`,
                  confirmLabel: 'Archive',
                  danger: true,
                });
                if (!go) return;
              }
              await ctx.setArchived('ingredients', ingredient.id, !ingredient.archived);
              toast(ingredient.archived ? 'Restored.' : 'Archived.');
              closeModal();
            },
          })
        : null,
      h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal }),
      h('button.btn-primary', { type: 'button', text: 'Save', onClick: save }),
    ].filter(Boolean),
  });
}

/* ---- small form primitives ---- */

function input({ value = '', placeholder = '' } = {}) {
  return h('input.input', { type: 'text', value, placeholder, autocomplete: 'off' });
}

function numberInput(value, attrs = {}) {
  return h('input.input', { type: 'number', value: value === '' ? '' : String(value), ...attrs });
}

function select(options, current) {
  return h(
    'select.select',
    ...options.map((o) =>
      h('option', { value: o.value, text: o.label, selected: o.value === current })
    )
  );
}

function field(label, control) {
  return h('label.field', h('span.field-label', { text: label }), control);
}

function unitLabel(u) {
  const meta = UNITS[u];
  return u === 'each' ? 'each' : `${u} (${meta.dimension})`;
}
