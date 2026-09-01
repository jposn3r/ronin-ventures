/* ========================================
   Meal Planner — Units
   ----------------------------------------
   Pure. No DOM, no storage.

   Conversion is only ever attempted WITHIN a
   dimension. Going from cup to oz needs the
   density of the specific food, which varies
   per ingredient, so this module refuses that
   conversion rather than inventing a number.
   The shopping list falls back to the
   ingredient's servingsPerPurchase when the
   dimensions don't line up.
   ======================================== */

/** @typedef {'g'|'oz'|'lb'|'tsp'|'tbsp'|'cup'|'ml'|'each'|'slice'|'dozen'} Unit */
/** @typedef {'mass'|'volume'|'count'} Dimension */

/**
 * Every unit, its dimension, and its size in that dimension's base unit
 * (grams for mass, millilitres for volume, items for count).
 * @type {Record<Unit, {dimension: Dimension, base: number, label: string, plural: string}>}
 */
export const UNITS = {
  g:     { dimension: 'mass',   base: 1,       label: 'g',     plural: 'g' },
  oz:    { dimension: 'mass',   base: 28.3495, label: 'oz',    plural: 'oz' },
  lb:    { dimension: 'mass',   base: 453.592, label: 'lb',    plural: 'lb' },
  tsp:   { dimension: 'volume', base: 4.92892, label: 'tsp',   plural: 'tsp' },
  tbsp:  { dimension: 'volume', base: 14.7868, label: 'tbsp',  plural: 'tbsp' },
  cup:   { dimension: 'volume', base: 236.588, label: 'cup',   plural: 'cups' },
  ml:    { dimension: 'volume', base: 1,       label: 'ml',    plural: 'ml' },
  each:  { dimension: 'count',  base: 1,       label: '',      plural: '' },
  slice: { dimension: 'count',  base: 1,       label: 'slice', plural: 'slices' },
  dozen: { dimension: 'count',  base: 12,      label: 'dozen', plural: 'dozen' },
};

/** @type {Unit[]} Ordered for pickers — most-used first within each dimension. */
export const UNIT_LIST = ['g', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'ml', 'each', 'slice', 'dozen'];

/**
 * @param {Unit} unit
 * @returns {Dimension|null}
 */
export function dimensionOf(unit) {
  return UNITS[unit] ? UNITS[unit].dimension : null;
}

/**
 * @param {Unit} a
 * @param {Unit} b
 * @returns {boolean} True when a value in `a` can be expressed in `b`.
 */
export function sameDimension(a, b) {
  const da = dimensionOf(a);
  return da !== null && da === dimensionOf(b);
}

/**
 * Convert a quantity between two units of the same dimension.
 * @param {number} value
 * @param {Unit} from
 * @param {Unit} to
 * @returns {number|null} Converted value, or null when the units are not
 *   comparable (different dimensions, or an unknown unit). Null is the signal
 *   for callers to fall back — never coerce it to 0.
 */
export function convert(value, from, to) {
  if (!UNITS[from] || !UNITS[to]) return null;
  if (!sameDimension(from, to)) return null;
  if (from === to) return value;
  return (value * UNITS[from].base) / UNITS[to].base;
}

/**
 * Format a quantity for display. Trims trailing zeros and pluralises the
 * count units, which are the only ones where "2 slice" reads wrong.
 * @param {number} value
 * @param {Unit} unit
 * @param {{maxDecimals?: number}} [opts]
 * @returns {string}
 */
export function formatQuantity(value, unit, opts = {}) {
  const maxDecimals = opts.maxDecimals ?? 2;
  const rounded = roundTo(value, maxDecimals);
  const num = String(rounded);
  const meta = UNITS[unit];
  if (!meta) return num;
  const word = rounded === 1 ? meta.label : meta.plural;
  return word ? `${num} ${word}` : num;
}

/**
 * Round to a fixed number of decimals without the float noise of toFixed
 * round-tripping. Display-only — never round intermediate macro math.
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
export function roundTo(value, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}
