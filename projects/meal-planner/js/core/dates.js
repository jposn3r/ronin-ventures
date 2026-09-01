/* ========================================
   Meal Planner — Dates
   ----------------------------------------
   Pure. No DOM, no storage.

   Everything is an ISO date string (YYYY-MM-DD)
   in LOCAL time. Date objects are built with the
   3-arg constructor and read with getFullYear /
   getMonth / getDate, never toISOString(), which
   shifts to UTC and lands the whole week on the
   wrong day for anyone west of Greenwich.
   ======================================== */

/** @typedef {string} ISODate YYYY-MM-DD */

const MS_PER_DAY = 86400000;

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @param {Date} date
 * @returns {ISODate}
 */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {ISODate} iso
 * @returns {Date} Local midnight on that date.
 */
export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * @param {ISODate} iso
 * @param {number} days May be negative.
 * @returns {ISODate}
 */
export function addDays(iso, days) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * The Monday on or before the given date. Weeks are Monday-based throughout;
 * this is the function that defines a week's identity.
 * @param {ISODate} iso
 * @returns {ISODate}
 */
export function mondayOf(iso) {
  const d = fromISODate(iso);
  // getDay(): 0=Sunday..6=Saturday. Shift so Monday is 0 and Sunday is 6.
  const offset = (d.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

/**
 * @param {ISODate} weekStart
 * @returns {ISODate[]} Seven dates, Monday through Sunday.
 */
export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * @returns {ISODate} Today, in local time.
 */
export function today() {
  return toISODate(new Date());
}

/**
 * @param {ISODate} iso
 * @returns {number} 0 for Monday through 6 for Sunday.
 */
export function weekdayIndex(iso) {
  return (fromISODate(iso).getDay() + 6) % 7;
}

/**
 * @param {ISODate} iso
 * @returns {string} e.g. "Aug 31"
 */
export function formatShort(iso) {
  const d = fromISODate(iso);
  return `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Human label for a week, collapsing the month when it doesn't change.
 * @param {ISODate} weekStart
 * @returns {string} e.g. "Aug 31 – Sep 6" or "Sep 7 – 13"
 */
export function formatWeekRange(weekStart) {
  const start = fromISODate(weekStart);
  const end = fromISODate(addDays(weekStart, 6));
  const sameMonth = start.getMonth() === end.getMonth();
  const left = `${MONTH_ABBR[start.getMonth()]} ${start.getDate()}`;
  const right = sameMonth ? String(end.getDate()) : `${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`;
  return `${left} – ${right}`;
}

/**
 * Whole weeks between two week-start dates. Positive when `b` is later.
 * @param {ISODate} a
 * @param {ISODate} b
 * @returns {number}
 */
export function weeksBetween(a, b) {
  // Both are local midnights, so DST shifts can leave a 23- or 25-hour day in
  // the span. Rounding absorbs that; the true gap is always a whole number.
  return Math.round((fromISODate(b) - fromISODate(a)) / (MS_PER_DAY * 7));
}
