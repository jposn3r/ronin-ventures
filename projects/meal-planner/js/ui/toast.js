/* ========================================
   Meal Planner — Toasts
   ======================================== */

import { $, h } from './el.js';

/**
 * @param {string} message
 * @param {'ok'|'bad'} [kind]
 */
export function toast(message, kind = 'ok') {
  const node = h('div.toast', { class: kind === 'bad' ? 'is-bad' : '', text: message });
  $('toasts').appendChild(node);
  // Errors linger; confirmations get out of the way.
  setTimeout(() => node.remove(), kind === 'bad' ? 5000 : 2600);
}
