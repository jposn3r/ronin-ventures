/* ========================================
   HarvestVoice — Facility configuration
   ----------------------------------------
   SYNTHETIC DATA. Replace every list in this
   file with the operator's real values. This
   is the only file that should need to change
   when onboarding a new facility.
   ======================================== */

const CONFIG = {
  facility: {
    name: 'Ronin Cultivation — Building 2',
    // Lock the unit facility-wide. The parser refuses any weight it cannot
    // attribute to this unit unless the worker says the unit explicitly.
    defaultUnit: 'g',
    allowedUnits: ['g', 'lb'],
    // Sanity bounds for a single plant's WET weight. Anything outside these is
    // still logged, but flagged for supervisor review rather than trusted.
    // SYNTHETIC — set these from the operator's actual harvest history.
    plausibleWeight: { g: { min: 50, max: 8000 }, lb: { min: 0.1, max: 18 } },
  },

  // SYNTHETIC — the #1 thing to replace with the operator's real cultivar list.
  // These strings are also what gets loaded into the STT vocabulary later.
  strains: [
    'Blue Dream',
    'Gelato 41',
    'Wedding Cake',
    'Sour Diesel',
    'Girl Scout Cookies',
    'OG Kush',
    'Granddaddy Purple',
    'Jack Herer',
    'Northern Lights',
    'Pineapple Express',
    'Runtz',
    'Zkittlez',
    'Do-Si-Dos',
    'MAC 1',
    'Gorilla Glue #4',
    'Purple Punch',
    'Strawberry Cough',
    'White Widow',
    'Chemdawg',
    'Tangie',
  ],

  // SYNTHETIC — grow rooms the plants come out of.
  rooms: [
    'Flower Room 1',
    'Flower Room 2',
    'Flower Room 3',
    'Flower Room 4',
    'Veg Room 1',
    'Veg Room 2',
    'Mother Room',
  ],

  // SYNTHETIC — where the wet plants get hung.
  dryingRooms: ['Dry Room A', 'Dry Room B', 'Dry Room C'],

  // SYNTHETIC — stands in for PIN-based auth in Phase 2.
  employees: [
    { id: 'E-101', name: 'Marisol Reyes', pin: '1234' },
    { id: 'E-114', name: 'Dev Okafor', pin: '2345' },
    { id: 'E-127', name: 'Sam Whitfield', pin: '3456' },
    { id: 'E-140', name: 'Priya Raman', pin: '4567' },
  ],

  // The Plants sheet header row. Order here IS the column order written to
  // Google Sheets — keep the two in sync.
  plantColumns: [
    'timestamp',
    'batch_id',
    'plant_tag',
    'strain',
    'room',
    'wet_weight',
    'unit',
    'destination_room',
    'employee',
    'notes',
  ],

  // The Batches sheet header row.
  batchColumns: [
    'batch_id',
    'opened_at',
    'closed_at',
    'strain',
    'room',
    'destination_room',
    'unit',
    'employee',
    'plant_count',
    'total_wet_weight',
    'notes',
  ],
};

// Spoken command vocabulary for the rapid-fire loop. Everything here is
// matched locally — no network round trip, because latency kills the loop.
const COMMANDS = {
  undo: ['undo', 'undo last', 'scratch that', 'scratch it', 'delete last', 'cancel that'],
  close: ['close batch', 'end batch', 'finish batch', 'close the batch', 'that\'s it'],
  repeat: ['repeat', 'say again', 'what was that', 'read back'],
};
