/* ========================================
   HarvestVoice — Deterministic grammar parser
   ----------------------------------------
   This runs the rapid-fire per-plant loop. It is
   intentionally NOT an LLM call: a 1-2s round trip
   per plant would make the loop slower than typing.
   Claude handles the conversational batch setup;
   this handles the 300 utterances that follow.
   ======================================== */

const UNIT_DIGITS = {
  zero: 0, oh: 0, o: 0, one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4,
  five: 5, six: 6, seven: 7, eight: 8, ate: 8, nine: 9,
};

const TENS_WORDS = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const UNIT_WORDS = {
  g: ['gram', 'grams', 'g', 'gs'],
  lb: ['pound', 'pounds', 'lb', 'lbs'],
};

/**
 * Turn spoken number words into digits.
 *
 * Two different things get spoken as digit sequences and they need different
 * handling, which is where a naive word-to-digit map goes wrong:
 *   - tag digits are CONCATENATED  — "eight eight four two" -> 8842
 *   - quantities are SUMMED        — "eight hundred forty two" -> 842
 *
 * The rule that separates them: a unit digit (0-9) following another unit
 * digit concatenates; a unit digit following a tens word or a multiplier adds.
 */
function normalizeNumbers(text) {
  const tokens = String(text).toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];

  let total = 0;        // accumulated thousands
  let partial = 0;      // current group
  let hasNumber = false;
  let lastKind = null;  // 'unit' | 'tens' | 'mult'
  let decimals = null;  // string of digits after "point"

  const flush = () => {
    if (!hasNumber) return;
    const value = total + partial;
    out.push(decimals !== null ? `${value}.${decimals || '0'}` : String(value));
    total = 0; partial = 0; hasNumber = false; lastKind = null; decimals = null;
  };

  for (const raw of tokens) {
    const t = raw.replace(/[^\w.]/g, '');
    if (!t) continue;

    if (t === 'and') continue;

    if (t === 'point' || t === 'decimal') {
      if (hasNumber && decimals === null) decimals = '';
      else { flush(); out.push('point'); }
      continue;
    }

    // A literal number in the transcript ("412", "4.2") — Chrome usually
    // returns these already digitized. Pass through untouched.
    if (/^\d+(\.\d+)?$/.test(t)) {
      if (decimals !== null && !t.includes('.')) { decimals += t; continue; }
      flush();
      out.push(t);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(UNIT_DIGITS, t)) {
      const n = UNIT_DIGITS[t];
      if (decimals !== null) { decimals += String(n); continue; }
      if (lastKind === 'unit') partial = partial * 10 + n;  // digit sequence
      else partial += n;                                     // quantity
      hasNumber = true; lastKind = 'unit';
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(TENS_WORDS, t)) {
      if (decimals !== null) { flush(); }
      partial += TENS_WORDS[t];
      hasNumber = true; lastKind = 'tens';
      continue;
    }

    if (t === 'hundred') {
      partial = (partial || 1) * 100;
      hasNumber = true; lastKind = 'mult';
      continue;
    }

    if (t === 'thousand') {
      total += (partial || 1) * 1000;
      partial = 0;
      hasNumber = true; lastKind = 'mult';
      continue;
    }

    flush();
    out.push(t);
  }
  flush();

  // Re-join a decimal that survived as separate tokens: "4 . 2" -> "4.2"
  return out.join(' ').replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
}

function matchesCommand(text, list) {
  const t = text.toLowerCase().trim().replace(/[.!?]+$/, '');
  return list.some((phrase) => t === phrase || t.startsWith(phrase + ' ') || t.endsWith(' ' + phrase));
}

function detectUnit(text) {
  const t = ' ' + String(text).toLowerCase() + ' ';
  for (const [unit, words] of Object.entries(UNIT_WORDS)) {
    if (words.some((w) => t.includes(' ' + w + ' '))) return unit;
  }
  return null;
}

/**
 * Parse one utterance from the capture loop.
 * Returns a discriminated result — the caller never has to guess.
 */
function parsePlantUtterance(transcript, session) {
  const raw = (transcript || '').trim();
  if (!raw) return { kind: 'empty' };

  if (matchesCommand(raw, COMMANDS.undo)) return { kind: 'undo' };
  if (matchesCommand(raw, COMMANDS.close)) return { kind: 'close' };
  if (matchesCommand(raw, COMMANDS.repeat)) return { kind: 'repeat' };

  const normalized = normalizeNumbers(raw);

  // An utterance can carry two numbers — "plant 4 is 408 grams" — so picking
  // the first one is wrong. Resolve in priority order, and refuse rather than
  // guess when nothing disambiguates them.
  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?/g)];

  // Identifier. STT reliably clips "plant" to "plan", so match loosely.
  // Three or more digits is a real plant tag; one or two is an ordinal —
  // the worker counting out loud, which is a different thing entirely.
  let plantTag = null;
  let ordinal = null;
  let idAt = -1;
  const idMatch = normalized.match(/\b(?:plants?|plan|tags?|numbers?|ids?)\s*#?\s*(\d+)(?![\d.])/i);
  if (idMatch) {
    idAt = normalized.indexOf(idMatch[1], idMatch.index);
    if (idMatch[1].length >= 3) plantTag = idMatch[1];
    else ordinal = parseInt(idMatch[1], 10);
  }

  // Rule 1 — a number attached to a unit is unambiguously the weight.
  let weight = null;
  let rule = null;
  const withUnit = normalized.match(/(\d+(?:\.\d+)?)\s*(grams?|gs?|pounds?|lbs?)\b/i);
  if (withUnit) {
    weight = parseFloat(withUnit[1]);
    rule = 'unit-adjacent';
  }

  // Rule 2 — whatever number is left once the identifier is accounted for.
  if (weight === null) {
    const pool = numbers
      .map((m) => ({ value: parseFloat(m[0]), at: m.index }))
      .filter((n) => n.at !== idAt);

    if (pool.length === 1) {
      weight = pool[0].value;
      rule = 'only-remaining-number';
    } else if (pool.length > 1) {
      // Two bare numbers and nothing to tell them apart. Guessing here writes
      // a wrong weight into a regulated record — refuse instead.
      return {
        kind: 'ambiguous',
        transcript: raw,
        normalized,
        candidates: pool.map((n) => n.value),
      };
    }
  }

  if (weight === null || Number.isNaN(weight)) {
    return { kind: 'unparsed', transcript: raw, reason: 'No weight found in that.' };
  }

  // Units are a 453x error waiting to happen. If the worker names a unit that
  // contradicts the session, we refuse rather than silently converting.
  const spokenUnit = detectUnit(raw);
  const unit = spokenUnit || session.unit;
  if (spokenUnit && spokenUnit !== session.unit) {
    return {
      kind: 'unit_conflict',
      transcript: raw,
      weight,
      spokenUnit,
      sessionUnit: session.unit,
    };
  }

  const bounds = CONFIG.facility.plausibleWeight[unit];
  const implausible = Boolean(bounds) && (weight < bounds.min || weight > bounds.max);

  return {
    kind: 'plant',
    transcript: raw,
    plantTag,
    ordinal,
    weight,
    unit,
    implausible,
    bounds,
    rule,
  };
}
