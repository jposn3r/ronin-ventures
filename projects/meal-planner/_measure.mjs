import { SEED_INGREDIENTS } from './js/data/seed/ingredients.js';
import { SEED_MEALS } from './js/data/seed/meals.js';
import { SEED_DAY_TYPES, SEED_SLOT_TEMPLATES, SEED_SETTINGS } from './js/data/seed/defaults.js';
import { normalize, SCHEMA_VERSION, emptyData } from './js/data/schema.js';
import { createWeek } from './js/core/week.js';

const APP_ID = 'roninventures.meal-planner';
const data = emptyData();
const now = new Date().toISOString();

function writeOne(entity, record) {
  const clean = normalize(entity, record);
  if ('createdAt' in clean) { clean.createdAt = clean.createdAt || now; clean.updatedAt = now; }
  data[entity][clean.id] = clean;
}

SEED_INGREDIENTS.forEach(r => writeOne('ingredients', r));
SEED_MEALS.forEach(r => writeOne('meals', r));
SEED_DAY_TYPES.forEach(r => writeOne('dayTypes', r));
SEED_SLOT_TEMPLATES.forEach(r => writeOne('slotTemplates', r));
writeOne('settings', SEED_SETTINGS);

const tpl = SEED_SLOT_TEMPLATES[0];
const mealIds = Object.keys(data.meals);

function bytes(o){ return Buffer.byteLength(JSON.stringify(o), 'utf8'); }
function payload(){ return { schemaVersion: SCHEMA_VERSION, app: APP_ID, data }; }

const libOnly = bytes(payload());
console.log('ingredients count', Object.keys(data.ingredients).length);
console.log('meals count', Object.keys(data.meals).length);
console.log('--- library only (no weeks) ---');
console.log('JSON bytes (utf8):', libOnly, '=', (libOnly/1024).toFixed(2), 'KiB');
console.log('  ingredients subtree:', bytes(data.ingredients), 'avg/rec', Math.round(bytes(data.ingredients)/32));
console.log('  meals subtree:', bytes(data.meals), 'avg/rec', Math.round(bytes(data.meals)/20));
console.log('  dayTypes:', bytes(data.dayTypes), ' slotTemplates:', bytes(data.slotTemplates), ' settings:', bytes(data.settings));

// add filled weeks
let prev = libOnly;
const starts = ['2026-08-31','2026-09-07','2026-09-14','2026-09-21'];
starts.forEach((ws, i) => {
  const w = createWeek(ws, tpl, 'daytype_rest');
  // fill every slot with a meal, and tick some shopping boxes
  w.days.forEach((d, di) => d.slots.forEach((s, si) => { s.mealId = mealIds[(di*4+si) % mealIds.length]; }));
  for (let k=0;k<40;k++) w.shoppingChecked['ing_'+k] = true;
  writeOne('weeks', w);
  const nowB = bytes(payload());
  console.log(`+ week ${ws}: total ${nowB} B (${(nowB/1024).toFixed(2)} KiB), delta ${nowB-prev} B`);
  prev = nowB;
});

const oneWeek = bytes(Object.values(data.weeks)[0]);
console.log('single normalized week record bytes:', oneWeek);
console.log('UTF-16 code units (what browsers meter):', JSON.stringify(payload()).length);
