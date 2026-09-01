/* ========================================
   Meal Planner — Settings
   ----------------------------------------
   Day-type targets, the default slot template,
   the on-target tolerance, and the data escape
   hatches.

   Export exists so the plan is not hostage to one
   browser's localStorage. It is also the
   migration path into a real database later: the
   export IS the schema.
   ======================================== */

import { h, render, fmt } from './el.js';
import { openModal, closeModal, confirmModal } from './modal.js';
import { MACRO_KEYS } from '../core/macros.js';
import { MAX_SLOTS } from '../data/schema.js';
import { toast } from './toast.js';

const SHORT = { calories: 'cal', protein: 'g protein', carbs: 'g carbs', fat: 'g fat' };

/**
 * @param {HTMLElement} bodyNode
 * @param {object} ctx
 */
export function renderSettings(bodyNode, ctx) {
  const settings = ctx.settings;
  const dayTypes = ctx.allDayTypes(true);
  const templates = ctx.slotTemplates;

  render(
    bodyNode,

    /* ---- Day types ---- */
    h(
      'section.settings-block',
      h(
        'div.section-head',
        h('span.section-title', { text: 'Day types' }),
        h('button.btn-ghost', { type: 'button', text: 'New day type', onClick: () => openDayTypeForm({ dayType: null, ctx }) })
      ),
      h('p.field-hint', { text: 'Each day in the grid is measured against one of these.' }),
      h(
        'div.card-list',
        ...dayTypes.map((type) =>
          h(
            'button.card.card-button',
            {
              type: 'button',
              class: type.archived ? 'is-archived' : '',
              onClick: () => openDayTypeForm({ dayType: type, ctx }),
            },
            h(
              'div.card-head',
              h('span.card-name', { text: type.name }),
              h('span.swatch', { style: { background: type.color } })
            ),
            h(
              'div.card-macros.mono',
              ...MACRO_KEYS.map((k) => h('span', { text: `${fmt(type.targets[k])}${k === 'calories' ? '' : 'g'}` }))
            ),
            h('div.card-sub', {
              text: [
                settings.defaultDayTypeId === type.id ? 'Default for new days' : '',
                type.archived ? 'Archived' : '',
              ].filter(Boolean).join(' · ') || 'Calories, protein, carbs, fat',
            })
          )
        )
      )
    ),

    /* ---- Defaults ---- */
    h(
      'section.settings-block',
      h('div.section-head', h('span.section-title', { text: 'Defaults for new weeks' })),
      h(
        'div.form-row',
        h(
          'label.field',
          h('span.field-label', { text: 'Day type' }),
          h(
            'select.select',
            { onChange: (e) => ctx.saveSettings({ defaultDayTypeId: e.target.value || null }) },
            h('option', { value: '', text: 'None', selected: !settings.defaultDayTypeId }),
            ...ctx.allDayTypes(false).map((t) =>
              h('option', { value: t.id, text: t.name, selected: t.id === settings.defaultDayTypeId })
            )
          )
        ),
        h(
          'label.field',
          h('span.field-label', { text: 'Slot template' }),
          h(
            'select.select',
            { onChange: (e) => ctx.saveSettings({ defaultSlotTemplateId: e.target.value || null }) },
            ...templates.map((t) =>
              h('option', {
                value: t.id,
                text: `${t.name} (${t.slots.length})`,
                selected: t.id === settings.defaultSlotTemplateId,
              })
            )
          )
        )
      ),
      h('p.field-hint', {
        text: 'Changing these affects weeks you have not opened yet. Weeks already planned keep their own slots.',
      }),
      ...templates.map((template) =>
        h(
          'div.template-row',
          h('span.template-name', { text: template.name }),
          h('span.template-slots', { text: template.slots.map((s) => s.label).join(' · ') }),
          h('button.link-btn', { type: 'button', text: 'Edit', onClick: () => openTemplateForm({ template, ctx }) })
        )
      )
    ),

    /* ---- Tolerance ---- */
    h(
      'section.settings-block',
      h('div.section-head', h('span.section-title', { text: 'On-target tolerance' })),
      h('p.field-hint', {
        text: 'How far from a target still counts as on plan. Too tight and every day reads red, which trains you to ignore the colour.',
      }),
      (() => {
        const readout = h('span.tolerance-readout.mono', { text: `± ${fmt(settings.targetTolerance * 100)}%` });
        const slider = h('input.slider', {
          type: 'range',
          min: '1',
          max: '15',
          step: '1',
          value: String(Math.round(settings.targetTolerance * 100)),
          onInput: (e) => {
            readout.textContent = `± ${e.target.value}%`;
          },
          onChange: (e) => ctx.saveSettings({ targetTolerance: Number(e.target.value) / 100 }),
        });
        return h('div.tolerance-row', slider, readout);
      })()
    ),

    /* ---- Data ---- */
    h(
      'section.settings-block',
      h('div.section-head', h('span.section-title', { text: 'Your data' })),
      h('p.field-hint', {
        text: 'Everything lives in this browser only. Export to move it to another browser, or to keep a backup before a big edit.',
      }),
      h(
        'div.data-actions',
        h('button.btn-primary', { type: 'button', text: 'Export JSON', onClick: () => exportData(ctx) }),
        h('button.btn-ghost', { type: 'button', text: 'Import JSON', onClick: () => openImport(ctx) }),
        h('button.btn-danger', { type: 'button', text: 'Reset to seed', onClick: () => resetData(ctx) })
      )
    )
  );
}

/* ============ Day type form ============ */

function openDayTypeForm({ dayType, ctx }) {
  const editing = Boolean(dayType);
  const value = dayType || {
    name: '',
    targets: { calories: 2400, protein: 200, carbs: 220, fat: 72 },
    color: '#b45309',
  };

  const nameInput = h('input.input', { type: 'text', value: value.name, placeholder: 'Training', autocomplete: 'off' });
  const colorInput = h('input.color-input', { type: 'color', value: value.color });
  const targets = {};
  for (const key of MACRO_KEYS) {
    targets[key] = h('input.input', {
      type: 'number',
      min: '0',
      step: 'any',
      value: String(value.targets[key]),
    });
  }

  openModal({
    title: editing ? dayType.name : 'New day type',
    body: [
      h('div.form-row', h('label.field', h('span.field-label', { text: 'Name' }), nameInput),
        h('label.field', h('span.field-label', { text: 'Colour' }), colorInput)),
      h('span.field-label.form-section', { text: 'Daily targets' }),
      h('div.form-row.form-row-4',
        ...MACRO_KEYS.map((key) =>
          h('label.field', h('span.field-label', { text: SHORT[key] }), targets[key])
        )),
    ],
    actions: [
      editing
        ? h('button.btn-danger', {
            type: 'button',
            text: dayType.archived ? 'Restore' : 'Archive',
            onClick: async () => {
              await ctx.setArchived('dayTypes', dayType.id, !dayType.archived);
              toast(dayType.archived ? 'Restored.' : 'Archived.');
              closeModal();
            },
          })
        : null,
      h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal }),
      h('button.btn-primary', {
        type: 'button',
        text: 'Save',
        onClick: async () => {
          const name = nameInput.value.trim();
          if (!name) {
            toast('Give the day type a name.', 'bad');
            return;
          }
          await ctx.saveDayType({
            ...(dayType || {}),
            name,
            color: colorInput.value,
            targets: Object.fromEntries(MACRO_KEYS.map((k) => [k, Number(targets[k].value) || 0])),
          });
          toast('Saved.');
          closeModal();
        },
      }),
    ].filter(Boolean),
  });
}

/* ============ Slot template form ============ */

function openTemplateForm({ template, ctx }) {
  let slots = template.slots.map((s) => ({ ...s }));
  const listNode = h('div.template-editor');

  function paint() {
    render(
      listNode,
      ...slots.map((slot, index) =>
        h(
          'div.template-slot',
          h('input.input', {
            type: 'text',
            value: slot.label,
            'aria-label': `Slot ${index + 1} name`,
            onInput: (e) => {
              slot.label = e.target.value;
            },
          }),
          h('button.icon-btn', {
            type: 'button',
            text: '↑',
            'aria-label': 'Move up',
            disabled: index === 0,
            onClick: () => {
              [slots[index - 1], slots[index]] = [slots[index], slots[index - 1]];
              paint();
            },
          }),
          h('button.icon-btn', {
            type: 'button',
            text: '×',
            'aria-label': 'Remove slot',
            disabled: slots.length <= 1,
            onClick: () => {
              slots.splice(index, 1);
              paint();
            },
          })
        )
      ),
      slots.length < MAX_SLOTS
        ? h('button.add-slot', {
            type: 'button',
            text: '+ add slot',
            onClick: () => {
              slots.push({ id: `slot${slots.length + 1}`, label: `Slot ${slots.length + 1}` });
              paint();
            },
          })
        : h('p.field-hint', { text: `${MAX_SLOTS} slots is the maximum.` })
    );
  }
  paint();

  openModal({
    title: template.name,
    body: [
      h('p.field-hint', {
        text: 'The starting slots for weeks you have not opened yet. Existing weeks keep their own.',
      }),
      listNode,
    ],
    actions: [
      h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal }),
      h('button.btn-primary', {
        type: 'button',
        text: 'Save',
        onClick: async () => {
          const cleaned = slots
            .map((s, i) => ({ id: s.id || `slot${i + 1}`, label: s.label.trim() }))
            .filter((s) => s.label);
          if (!cleaned.length) {
            toast('Keep at least one named slot.', 'bad');
            return;
          }
          await ctx.saveSlotTemplate({ ...template, slots: cleaned });
          toast('Template saved.');
          closeModal();
        },
      }),
    ],
  });
}

/* ============ Data ============ */

async function exportData(ctx) {
  try {
    const payload = await ctx.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = payload.exportedAt.slice(0, 10);
    const link = h('a', { href: url, download: `meal-planner-${stamp}.json` });
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Exported.');
  } catch (err) {
    toast(err.message, 'bad');
  }
}

function openImport(ctx) {
  const fileInput = h('input.input', { type: 'file', accept: 'application/json,.json' });
  const modeReplace = h('input', { type: 'radio', name: 'import-mode', value: 'replace', checked: true });
  const modeMerge = h('input', { type: 'radio', name: 'import-mode', value: 'merge' });

  openModal({
    title: 'Import JSON',
    body: [
      h('p.modal-text', { text: 'Pick a file exported from Meal Planner.' }),
      fileInput,
      h('label.inline-check', modeReplace, h('span', { text: 'Replace — wipe what is here first' })),
      h('label.inline-check', modeMerge, h('span', { text: 'Merge — keep what is here, overwrite matching ids' })),
    ],
    actions: [
      h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: closeModal }),
      h('button.btn-primary', {
        type: 'button',
        text: 'Import',
        onClick: async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) {
            toast('Choose a file first.', 'bad');
            return;
          }
          try {
            const payload = JSON.parse(await file.text());
            await ctx.importAll(payload, { mode: modeReplace.checked ? 'replace' : 'merge' });
            toast('Imported.');
            closeModal();
          } catch (err) {
            toast(err.message || 'That file could not be read.', 'bad');
          }
        },
      }),
    ],
  });
}

async function resetData(ctx) {
  const go = await confirmModal({
    title: 'Reset everything?',
    message:
      'This deletes every ingredient, meal and planned week in this browser, then reloads the original seed. Export first if you want a copy.',
    confirmLabel: 'Reset',
    danger: true,
  });
  if (!go) return;
  try {
    await ctx.resetToSeed();
    toast('Reset to the seed data.');
  } catch (err) {
    toast(err.message, 'bad');
  }
}
