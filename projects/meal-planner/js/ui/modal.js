/* ========================================
   Meal Planner — Modal host
   ----------------------------------------
   One overlay reused by every dialog. Restores
   focus to whatever opened it, so keyboard use
   does not dump you back at the top of the page
   after picking a meal.
   ======================================== */

import { $, render, h } from './el.js';

let lastFocused = null;
let onCloseHook = null;

/**
 * @param {object} params
 * @param {string} params.title
 * @param {Node|Node[]} params.body
 * @param {Node[]} [params.actions]
 * @param {() => void} [params.onClose]
 * @param {string} [params.size] 'wide' widens the dialog for form-heavy views.
 *   'picker' also fixes its height, so a filtered list scrolls inside a dialog
 *   that does not change size as you type.
 */
export function openModal({ title, body, actions = [], onClose, size }) {
  const overlay = $('modal');
  lastFocused = document.activeElement;
  onCloseHook = onClose || null;

  $('modal-title').textContent = title;
  render($('modal-body'), body);
  render($('modal-actions'), actions);
  $('modal-actions').style.display = actions.length ? '' : 'none';

  const dialog = overlay.querySelector('.modal');
  dialog.classList.toggle('is-wide', size === 'wide' || size === 'picker');
  dialog.classList.toggle('is-picker', size === 'picker');
  overlay.hidden = false;

  // Focus the first real control so the dialog is usable from the keyboard
  // immediately. Search inputs win, since that is what a picker is for.
  const target =
    overlay.querySelector('input, select, textarea, button:not(#modal-close)') || $('modal-close');
  /** @type {HTMLElement} */ (target).focus();
}

export function closeModal() {
  const overlay = $('modal');
  if (overlay.hidden) return;
  overlay.hidden = true;
  render($('modal-body'));
  render($('modal-actions'));
  const hook = onCloseHook;
  onCloseHook = null;
  if (lastFocused && document.contains(lastFocused)) {
    /** @type {HTMLElement} */ (lastFocused).focus();
  }
  lastFocused = null;
  if (hook) hook();
}

/**
 * @returns {boolean}
 */
export function isModalOpen() {
  return !$('modal').hidden;
}

/**
 * Convenience for a confirm dialog. Resolves true when confirmed.
 * @param {object} params
 * @param {string} params.title
 * @param {string|Node} params.message
 * @param {string} [params.confirmLabel]
 * @param {boolean} [params.danger]
 * @returns {Promise<boolean>}
 */
export function confirmModal({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    openModal({
      title,
      body: typeof message === 'string' ? h('p.modal-text', { text: message }) : message,
      actions: [
        h('button.btn-ghost', { type: 'button', text: 'Cancel', onClick: () => { finish(false); closeModal(); } }),
        h('button', {
          class: danger ? 'btn-danger' : 'btn-primary',
          type: 'button',
          text: confirmLabel,
          onClick: () => { finish(true); closeModal(); },
        }),
      ],
      // Dismissing by Escape or the backdrop is a "no", not a hang.
      onClose: () => finish(false),
    });
  });
}

/** Wire the close affordances once at boot. */
export function initModal() {
  const overlay = $('modal');
  $('modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isModalOpen()) closeModal();
  });
}
