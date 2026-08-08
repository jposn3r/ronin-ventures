/* ========================================
   HarvestVoice — Batch setup extraction
   ----------------------------------------
   Claude runs here and ONLY here. The batch header
   is spoken once per harvest and is genuinely
   conversational ("starting Gelato 41 out of room
   three, hanging in Dry Room B") — worth an API
   round trip.

   The per-plant loop deliberately does not call
   this. See parser.js.

   The API key lives in localStorage and is sent
   directly from the browser. That is fine for a
   local prototype and wrong for production, where
   this call moves behind a server.
   ======================================== */

const CLAUDE_MODEL = 'claude-opus-5';

const BATCH_SCHEMA = {
  type: 'object',
  properties: {
    strain: { type: 'string', description: 'Exact strain name from the allowed list, or "" if not stated.' },
    room: { type: 'string', description: 'Exact grow room name from the allowed list, or "" if not stated.' },
    destination_room: { type: 'string', description: 'Exact drying room name from the allowed list, or "" if not stated.' },
    unit: { type: 'string', description: 'Weight unit: "g", "lb", or "" if not stated.' },
    notes: { type: 'string', description: 'Any free-text remark the speaker made that does not fit another field. "" if none.' },
  },
  required: ['strain', 'room', 'destination_room', 'unit', 'notes'],
  additionalProperties: false,
};

function buildSystemPrompt() {
  return [
    'You extract harvest batch setup fields from a cannabis cultivation worker\'s spoken sentence.',
    '',
    'Allowed strains (match exactly, case-sensitive):',
    CONFIG.strains.map((s) => `- ${s}`).join('\n'),
    '',
    'Allowed grow rooms (match exactly):',
    CONFIG.rooms.map((r) => `- ${r}`).join('\n'),
    '',
    'Allowed drying rooms (match exactly):',
    CONFIG.dryingRooms.map((r) => `- ${r}`).join('\n'),
    '',
    'Rules:',
    '- Speech-to-text mangles strain names. Map what you hear to the closest allowed strain only when the match is clear; otherwise return "".',
    '- "room three", "room 3", "flower 3" all mean "Flower Room 3". "dry room b", "b room" mean "Dry Room B".',
    '- Never invent a value that is not in the allowed lists. An empty string is always better than a guess.',
    '- Only return "g" or "lb" for unit if the speaker actually said a unit.',
  ].join('\n');
}

/**
 * Extract batch setup fields from a spoken sentence.
 * Falls back to local fuzzy matching when no API key is configured, so the
 * prototype is runnable with zero credentials.
 */
async function extractBatchSetup(transcript) {
  const apiKey = Store.state.settings.apiKey;
  if (!apiKey) return { ...localBatchMatch(transcript), source: 'local' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        // Thinking stays on (the default) but at low effort — this is a small
        // extraction and the batch-open interaction is the one place in the
        // workflow where a second of latency is acceptable.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: BATCH_SCHEMA },
        },
        messages: [{ role: 'user', content: transcript }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();

    // A refusal returns HTTP 200 with empty/partial content — check before reading.
    if (data.stop_reason === 'refusal') {
      return { ...localBatchMatch(transcript), source: 'local', warning: 'Model declined; used local matching.' };
    }

    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) throw new Error('No text block in response');
    const parsed = JSON.parse(textBlock.text);

    return {
      strain: validate(parsed.strain, CONFIG.strains),
      room: validate(parsed.room, CONFIG.rooms),
      destinationRoom: validate(parsed.destination_room, CONFIG.dryingRooms),
      unit: CONFIG.facility.allowedUnits.includes(parsed.unit) ? parsed.unit : '',
      notes: parsed.notes || '',
      source: 'claude',
    };
  } catch (err) {
    console.warn('Claude extraction failed, falling back to local matching:', err);
    return { ...localBatchMatch(transcript), source: 'local', warning: String(err.message || err) };
  }
}

/** Only accept values that exist in the facility config. Never free-text a strain. */
function validate(value, allowed) {
  if (!value) return '';
  const hit = allowed.find((a) => a.toLowerCase() === String(value).toLowerCase());
  return hit || '';
}

/**
 * Keyless fallback. Crude substring/number matching — good enough to demo the
 * flow, and it makes the "what if the network is down" path visible.
 */
function localBatchMatch(transcript) {
  const t = ' ' + normalizeNumbers(String(transcript).toLowerCase()) + ' ';

  const strain = CONFIG.strains.find((s) => t.includes(s.toLowerCase())) || '';

  let room = CONFIG.rooms.find((r) => t.includes(r.toLowerCase())) || '';
  if (!room) {
    const m = t.match(/(?:flower|grow)?\s*room\s*(\d)/);
    if (m) room = CONFIG.rooms.find((r) => r.endsWith(m[1]) && r.startsWith('Flower')) || '';
  }

  let destinationRoom = CONFIG.dryingRooms.find((r) => t.includes(r.toLowerCase())) || '';
  if (!destinationRoom) {
    const m = t.match(/dry(?:ing)?\s*room\s*([abc])/);
    if (m) destinationRoom = CONFIG.dryingRooms.find((r) => r.toLowerCase().endsWith(m[1])) || '';
  }

  const unit = detectUnit(t) || '';

  return { strain, room, destinationRoom, unit, notes: '' };
}
