/* ========================================
   Meal Planner — Meal picker
   ----------------------------------------
   Opened by clicking a plate. Search and tag
   filter over the meal library, with the macros
   of each dish visible while choosing — picking
   dinner is a macro decision, so the numbers
   belong in the picker, not one screen later.

   When the plate is already filled, the multiplier
   and clear controls sit above the list.
   ======================================== */

import { h, render, fmt } from './el.js';
import { openModal, closeModal } from './modal.js';
import { mealMacros } from '../core/macros.js';
import { setSlotMeal } from '../core/week.js';

const MULTIPLIERS = [0.5, 1, 1.5, 2];

/**
 * @param {object} params
 * @param {number} params.dayIndex
 * @param {object} params.slot
 * @param {object} params.ctx
 */
export function openMealPicker({ dayIndex, slot, ctx }) {
  const meals = ctx.meals;
  const current = slot.mealId ? ctx.mealsById.get(slot.mealId) : null;

  const tags = [...new Set(meals.flatMap((m) => m.tags))].sort();
  // Pre-select the tag matching this slot's label, so clicking Lunch opens on
  // the lunch dishes. It stays a filter, not a rule — "All" is one click away.
  const guess = tags.find((t) => t.toLowerCase() === slot.label.trim().toLowerCase()) || '';

  let query = '';
  let activeTag = guess;
  let multiplier = slot.quantityMultiplier || 1;

  const listNode = h('div.picker-list');

  const search = h('input.input', {
    type: 'search',
    placeholder: 'Search meals',
    autocomplete: 'off',
    onInput: (e) => {
      query = e.target.value.trim().toLowerCase();
      paint();
    },
  });

  const tagBar = h(
    'div.picker-tags',
    ...['', ...tags].map((tag) =>
      h('button.tag-chip', {
        type: 'button',
        class: tag === activeTag ? 'is-active' : '',
        text: tag || 'All',
        dataset: { tag },
        onClick: () => {
          activeTag = tag;
          for (const chip of tagBar.children) {
            chip.classList.toggle('is-active', chip.dataset.tag === activeTag);
          }
          paint();
        },
      })
    )
  );

  function choose(mealId) {
    ctx.update(setSlotMeal(ctx.week, dayIndex, slot.id, mealId, multiplier));
    closeModal();
  }

  function paint() {
    const matches = meals.filter((m) => {
      if (activeTag && !m.tags.includes(activeTag)) return false;
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.tags.some((t) => t.includes(query))
      );
    });

    render(
      listNode,
      matches.length
        ? matches.map((meal) => {
            const macros = mealMacros(meal, ctx.ingredientsById);
            return h(
              'button.picker-row',
              {
                type: 'button',
                class: current && current.id === meal.id ? 'is-current' : '',
                onClick: () => choose(meal.id),
              },
              h(
                'div.picker-row-main',
                h('div.picker-name', { text: meal.name }),
                meal.description ? h('div.picker-desc', { text: meal.description }) : null
              ),
              h(
                'div.picker-macros.mono',
                h('span.picker-cal', { text: `${fmt(macros.calories * multiplier)} cal` }),
                h('span.picker-split', {
                  text: `${fmt(macros.protein * multiplier)}P  ${fmt(macros.carbs * multiplier)}C  ${fmt(macros.fat * multiplier)}F`,
                })
              )
            );
          })
        : h('p.empty-note', { text: 'No meals match. Try a different search, or clear the tag filter.' })
    );
  }

  const multiplierBar = h(
    'div.picker-mult',
    h('span.field-label', { text: 'Portion' }),
    h(
      'div.mult-chips',
      ...MULTIPLIERS.map((value) =>
        h('button.mult-chip', {
          type: 'button',
          class: value === multiplier ? 'is-active' : '',
          text: `${value}x`,
          dataset: { mult: String(value) },
          onClick: () => {
            multiplier = value;
            for (const chip of multiplierBar.querySelectorAll('.mult-chip')) {
              chip.classList.toggle('is-active', Number(chip.dataset.mult) === multiplier);
            }
            // Filled plate: applying a portion change on its own is the whole
            // interaction, so persist immediately rather than waiting for a
            // meal to be re-picked.
            if (current) ctx.update(setSlotMeal(ctx.week, dayIndex, slot.id, current.id, multiplier));
            paint();
          },
        })
      )
    )
  );

  paint();

  openModal({
    title: current ? `${slot.label} — ${current.name}` : `Add to ${slot.label}`,
    size: 'wide',
    body: [
      current ? multiplierBar : null,
      h('div.picker-controls', search, tagBar),
      listNode,
    ].filter(Boolean),
    actions: current
      ? [
          h('button.btn-danger', {
            type: 'button',
            text: 'Clear plate',
            onClick: () => {
              ctx.update(setSlotMeal(ctx.week, dayIndex, slot.id, null));
              closeModal();
            },
          }),
          h('button.btn-ghost', { type: 'button', text: 'Done', onClick: closeModal }),
        ]
      : [h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal })],
  });
}
