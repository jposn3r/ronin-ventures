/* ========================================
   Meal Planner — Seed day types and slots
   ----------------------------------------
   Targets are the midpoints of the ranges in the
   plan. Training and rest differ by one carb
   serving, about 250 calories; protein and the
   slot structure are identical.
   ======================================== */

import { SETTINGS_ID } from '../schema.js';

export const SEED_DAY_TYPES = [
  {
    id: 'daytype_training',
    name: 'Training',
    targets: { calories: 2550, protein: 200, carbs: 250, fat: 75 },
    color: '#c2410c',
    archived: false,
  },
  {
    id: 'daytype_rest',
    name: 'Rest',
    targets: { calories: 2300, protein: 200, carbs: 190, fat: 70 },
    color: '#3f6212',
    archived: false,
  },
];

export const SEED_SLOT_TEMPLATES = [
  {
    id: 'slottpl_default',
    name: 'Four meals',
    slots: [
      { id: 'slot_breakfast', label: 'Breakfast' },
      { id: 'slot_lunch', label: 'Lunch' },
      { id: 'slot_afternoon', label: 'Afternoon' },
      { id: 'slot_dinner', label: 'Dinner' },
    ],
  },
];

export const SEED_SETTINGS = {
  id: SETTINGS_ID,
  defaultSlotTemplateId: 'slottpl_default',
  defaultDayTypeId: 'daytype_rest',
  targetTolerance: 0.05,
  seeded: true,
};
