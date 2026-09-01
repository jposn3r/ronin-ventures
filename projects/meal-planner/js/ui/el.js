/* ========================================
   Meal Planner — DOM helper
   ----------------------------------------
   A hyperscript small enough to read in one
   sitting. Enough to build the whole UI without
   template strings, which is what keeps user
   text (ingredient names, meal notes) from ever
   being parsed as markup.
   ======================================== */

/**
 * @param {string} tag Tag name, optionally with classes: 'div.plate.is-empty'
 * @param {object|null} [props] Attributes. `class`, `text`, `html`, `dataset`,
 *   `style` and `on*` handlers are treated specially.
 * @param {...(Node|string|number|null|undefined|false|Array)} children
 * @returns {HTMLElement}
 */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.classList.add(...classes);

  // The props argument is optional. Anything that is not a plain object is a
  // child, so h('div', childNode) reads the same as h('div', {}, childNode).
  // Without this test a node passed here is treated as an attribute bag,
  // iterates to nothing, and vanishes silently.
  if (isChild(props)) {
    children.unshift(props);
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      node.classList.add(...String(value).split(/\s+/).filter(Boolean));
    } else if (key === 'text') {
      node.textContent = String(value);
    } else if (key === 'html') {
      node.innerHTML = String(value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') {
      /** @type {any} */ (node).value = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  append(node, children);
  return node;
}

/**
 * Is this value a child to render, rather than an attribute bag?
 * @param {any} value
 * @returns {boolean}
 */
function isChild(value) {
  if (value == null) return false;
  if (value instanceof Node) return true;
  if (Array.isArray(value)) return true;
  return typeof value !== 'object';
}

/**
 * @param {Node} parent
 * @param {any} children
 */
export function append(parent, children) {
  for (const child of [].concat(children)) {
    if (child == null || child === false || child === '') continue;
    if (Array.isArray(child)) append(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
export function $(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

/**
 * @param {Element} node
 * @returns {Element}
 */
export function clear(node) {
  node.replaceChildren();
  return node;
}

/**
 * Replace a node's children in one operation.
 * @param {Element} node
 * @param {...any} children
 */
export function render(node, ...children) {
  clear(node);
  append(node, children);
  return node;
}

/**
 * Round for display. Macros are carried at full precision everywhere else.
 * @param {number} n
 * @param {number} [decimals]
 * @returns {string}
 */
export function fmt(n, decimals = 0) {
  const value = Number(n) || 0;
  const f = Math.pow(10, decimals);
  const rounded = Math.round((value + Number.EPSILON) * f) / f;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/**
 * Signed delta, for "+120" / "-40" readouts.
 * @param {number} n
 * @returns {string}
 */
export function fmtDelta(n) {
  const value = Math.round(Number(n) || 0);
  return value > 0 ? `+${fmt(value)}` : fmt(value);
}
