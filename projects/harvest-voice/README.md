# HarvestVoice

Voice-driven harvest weight logging for cannabis cultivation. Speak the batch once, then rapid-fire the weights — every entry lands in a table you can watch, and syncs to Google Sheets behind the UI.

Static, client-side only. No build step, no server, no `npm install`. Open `index.html` in Chrome and it runs.

**Built mobile-first.** The target is a phone held one-handed in a drying room, so the layout is designed around a thumb, not a cursor.

## The workflow it models

Harvest weight logging, per-plant, rolling up to a batch:

1. **Open the batch** (once, conversational) — "Starting Gelato 41 out of Flower Room 3, hanging in Dry Room B, grams." Claude extracts the fields, you confirm, the batch opens.
2. **Capture loop** (hundreds of reps) — hold the button, say the weight. Strain, room, unit, destination, and employee are inherited from the session, so the only thing spoken per plant is a number. "Scratch that" undoes.
3. **Close the batch** — read-back of plant count and total wet weight, confirm, the batch row writes.

Two tabs get written: `Plants` (append-only, one row per plant) and `Batches` (the session header, with count and total). The batch record is derived, not separately captured.

4. **Review and correct it** — closed batches stay on the setup screen under **Recent batches**, and they are fully editable.

Individual rows are retained on the closed batch, not just the aggregate. Sheets is frequently not connected, and a count and a total are not a chain of custody. The local archive is capped at the last 20 batches (`MAX_ARCHIVED_BATCHES`); that ceiling disappears once Postgres is behind it.

## Editing a closed batch

| Action | How |
|---|---|
| Correct a weight, tag, or note | Tap the row |
| Delete a plant | Tap the row → Delete |
| Change strain / room / drying room / notes | Edit inline in the batch sheet — saves on change |
| Add more plants by voice | **Reopen & add plants** — the batch becomes the live session again |
| Delete the whole batch | Bottom of the batch sheet, with confirmation |
| Push corrections upstream | **Sync to Sheets** |

**Every edit is stamped.** Changes record `editedAt` and `editedBy` and increment the batch `revision`, so a corrected weight in a regulated record is traceable rather than silently different. Any edit flips the batch and its touched rows back to `pending`, so the sheet can't quietly drift out of date.

**Reopening keeps the same batch id.** It re-archives as a new revision of itself, not a copy — so adding plants an hour later doesn't fracture the record into two batches.

### Why syncing edits needs more than append

A sheet that only ever grows can't represent a correction — appending a fixed row just leaves two contradictory records. So each row remembers where it landed (`sheetRange`, parsed from the append response), and a resync performs three distinct operations:

- rows already in the sheet are **updated in place**
- rows that have never synced are **appended**, capturing their new range
- rows deleted locally are **voided** — their sheet row is overwritten with `VOIDED — was 950g` rather than erased, so the audit trail survives

The batch header row is updated in place too, since count and total change with every edit.

Note that deleting a batch locally does **not** remove rows already written to Sheets — the confirmation says so.

### Summary-only batches

Batches closed before row retention existed have a header but no rows — `closeSession()` discarded them at the time. They're labelled **summary only** in the history list and in the batch sheet, and **reopening them is blocked**: restoring zero rows and re-closing would overwrite the one record that survived. The total and plant count are still accurate; the individual weights are unrecoverable.

Nothing new can enter this state.

## Running it

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/projects/harvest-voice/` from the repo root. Chrome only — speech recognition uses the Web Speech API.

**It works with zero credentials.** Without an API key it falls back to local string matching for batch setup; without Google connected, rows stay queued locally and the table still updates. Everything is testable before you configure anything.

### Optional: Claude for batch setup

Settings (⚙) → paste an Anthropic API key. Stored in `localStorage` only. This improves batch-setup extraction from messy speech — "gelato forty one outta room three" resolves correctly where the local matcher gives up.

The key is sent from the browser directly to `api.anthropic.com`. That's acceptable for a local prototype and wrong for production, where this call moves behind a server.

### Optional: Google Sheets

1. Google Cloud Console → new project → enable the **Google Sheets API**
2. Credentials → **OAuth client ID** → Web application
3. Add `http://localhost:8000` as an authorized JavaScript origin
4. Create a blank spreadsheet, copy its ID from the URL
5. Settings → paste both → **Connect Google**

The app creates the `Plants` and `Batches` tabs with headers on first connect.

## Design system

Styled after the **SpaceX** design language ([reference](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md/spacex)): pure black `#000000`, spectral near-white `#f0f0fa`, industrial DIN-heritage type (Share Tech / Share Tech Mono standing in for D-DIN), universal uppercase with positive tracking, a single ghost interactive surface, **zero shadows**, and a two-value radius scale — 4px for utility, 32px for buttons.

The batch read-back reads like a mission briefing, which is the right register for a record someone signs off on.

Two deliberate departures, both marked `DEVIATION` in [styles.css](projects/harvest-voice/styles.css):

**1. Semantic colour.** The source system is strictly achromatic. This app writes to a regulated record, so an out-of-range weight and a failed sync have to be distinguishable at a glance in a drying room. Error red (`#ff4444`) is already sanctioned by the source for form errors; amber for "flagged, review this" is an addition. Everything else — success, sync-complete, active state — is spectral white, as the source intends.

**2. A primary button.** SpaceX ships exactly one variant, the ghost. This app needs unmistakable affordance on *Open batch* and *Confirm & close*, so the primary inverts the palette: solid spectral fill, black text. Still two colours, still no shadow, still the 32px pill.

Everything genuinely read rather than scanned — transcripts, feedback messages, hints, the diagnostics log — opts out of uppercase, matching the reference preview's own treatment of body copy.

Note that form controls don't inherit `text-transform` from `body`, so buttons and selects state it explicitly. That's the one gotcha in applying this system.

## Mobile UX rules

**The app never scrolls as a whole.** Header, batch context, running totals, and the action bar are fixed; only the plant list scrolls. Sized with `dvh` so nothing jumps when mobile browser chrome collapses.

**Frequency of use decides placement.** The mic is a 76px pill at the very bottom — the easiest reach on a one-handed phone — flanked by undo and the keypad toggle. "Close batch" happens once a shift, so it sits at the *top*, small and visually quiet, where it can't be hit by accident. "Open batch" is likewise pinned to the thumb zone rather than buried at the bottom of a form the worker would have to scroll to find.

**Every target is at least 44px, most are 56px.** Assume nitrile gloves and a wet screen. `touch-action: manipulation` kills the 300ms tap delay; inputs are 17px so iOS doesn't zoom the page on focus; `touch-action: none` on the mic button stops a hold from scrolling the page.

**Toasts drop from the top, not the bottom.** Anchoring them to the bottom put transient text directly over the mic — the one control that must never be obscured mid-shift.

Safe-area insets are respected for the iPhone home indicator, and a landscape/short-screen breakpoint reclaims vertical space. Above 700px the same layout just centers and widens — the thumb zone stays.

## Voice interaction

**Hold to talk, or tap once for hands-free.** Holding a button while handling a wet plant is awkward, so a press under 400ms latches: it keeps listening until the next tap. Pointer capture means a thumb that drifts off the button edge doesn't cancel the take.

Three things the speech layer has to survive, all of which broke a naive implementation:

| Failure | Handling |
|---|---|
| Chrome ends recognition without ever marking a result `isFinal` | Keep the last interim text and use it — otherwise short utterances vanish silently |
| Chrome auto-ends on its own silence detection mid-take | Restart while the worker is still holding or latched (bounded at 10 restarts) |
| Thumb drifts a few pixels off the button | `setPointerCapture`, and no `pointerleave` cancel |

Releasing the button waits 220ms before stopping, because letting go is faster than finishing a word.

## Diagnostics

**Tap the mic chip in the header** to open an on-screen log. It's on-screen rather than console-only because the target device is a phone with no devtools attached.

Every console line is prefixed `[HV]` so it's findable amid browser-extension noise. The panel has **Test mic**, which is the fastest way to answer "why is nothing happening":

1. Reports secure context, `SpeechRecognition` availability, and online status
2. Queries the microphone permission state
3. Opens the mic and names the actual input device
4. **Samples the signal for 3 seconds and reports a peak input level**

Step 4 is the one that matters. A granted permission with a flat signal — wrong input device, hardware mute, OS-level block — is indistinguishable from a broken app until you measure it. If peak level reads under 2%, the mic is open and hearing nothing, and no amount of app debugging will help.

**Every take logs its own peak input level**, so a dead microphone is self-evident without running a separate test. The mic button also shows a live level bar while listening — a bar that never moves is the fastest possible read on "open but hearing nothing."

Common causes of a silent recording, in order:

| Log line | Cause | Fix |
|---|---|---|
| `looks like a VIRTUAL audio device` | A virtual device (Oculus, VB-Audio, OBS, NVIDIA Broadcast) has stolen the system default and records perfect silence | Windows → Settings → System → Sound → Input → pick the real mic, then reload |
| `engine onerror {"error":"not-allowed"}` | Permission denied | Mic icon in the address bar → Allow → reload |
| `input peak during take 0%` | Wrong or muted input device | OS sound settings |
| `engine onerror {"error":"network"}` | No internet | Chrome's Web Speech API sends audio to Google to transcribe; it does not work offline |
| `take produced no transcript` | Released before speaking | Tap once to latch instead of holding |

**Device selection has two layers, and both can be wrong.** `SpeechRecognition` exposes no device API at all (unlike `getUserMedia`, which takes a `deviceId`), so the choice is entirely Chrome's — and **Chrome pins a capture device per site**, remembered from the first permission grant. Changing the Windows default afterwards does nothing for a site that already has a pinned device. Fixing it takes both:

1. `chrome://settings/content/microphone` → select the real microphone
2. Click the icon left of the URL → **Reset permissions** → reload → allow again

`Test mic` enumerates every input, flags a virtual one, and names the real microphone available to switch to — because "your settings look correct and it still doesn't work" is otherwise a very long afternoon.

**Chrome's Web Speech API requires an internet connection.** Worth knowing before a drying-room test — this is one more reason the production path is a Deepgram relay, not the browser API.

## Architecture

```
speech ──► parser.js  (deterministic, instant)  ──┐
                                                  ├──► store.js ──► sinks
        └► claude.js  (batch setup only)      ────┘   (localStorage,   │
                                                       source of truth) │
                                                                        ├─ sheets.js
                                                                        └─ [POS adapter, later]
```

Three decisions carry the whole design:

**The per-plant loop never calls an LLM.** A 1–2 second round trip per plant would make voice slower than typing. `parser.js` is a deterministic grammar that resolves in microseconds. Claude runs once per batch, on the conversational part where latency is affordable.

**Sheets is a sink, not the table.** Every record lands in `localStorage` first; the UI renders from there immediately; the Sheets write fires behind it with a per-row sync indicator. A token refresh or a dropped connection never blocks capture. This is also what makes the eventual Dutchie/BioTrack adapter a *second sink* rather than a rewrite.

**Units are treated as a correctness problem.** The batch locks a unit. If a worker speaks a conflicting unit mid-loop, the entry is **refused**, not converted — a silent g/lb conversion is a 453× error in a regulated record. Weights outside a plausible range are logged but flagged.

### The number grammar

Spoken digits mean two different things and the parser separates them by rule: a unit digit following another unit digit **concatenates**, one following a tens word or a multiplier **adds**.

| Spoken | Parsed | Why |
|---|---|---|
| `eight eight four two` | `8842` | consecutive unit digits → tag-style concatenation |
| `eight hundred forty two` | `842` | multiplier then tens → quantity |
| `one thousand two hundred` | `1200` | |
| `fifty two point five` | `52.5` | |
| `plant 8842 nine hundred fifty` | tag `8842`, weight `950` | tag only matches after an explicit keyword |
| `one pound` (in a grams batch) | **refused** | unit conflict, never converted |

Known limitation: `twelve forty` parses as `52`, not `1240`. Chrome's speech API returns digits for that form in practice, so it hasn't bitten — but it's the shape to watch for in real audio.

### Two numbers in one utterance

"Plant four is forty one grams" carries two numbers, so first-number-wins is wrong. Resolution runs in priority order:

1. **A number attached to a unit is the weight.** `"408 g"` → 408. Strongest signal, checked first.
2. **An identifier keyword claims the number after it.** 3+ digits is a plant tag; 1–2 digits is an *ordinal* — the worker counting aloud. Whatever number remains is the weight.
3. **A single number is the weight.**
4. **Two bare numbers with nothing to separate them → refuse.** Guessing writes a wrong weight into a regulated record.

The keyword match is deliberately loose (`plant`/`plan`/`tag`/`number`/`id`) because STT reliably clips the *t* off "plant".

Spoken ordinals are **not stored** — the row number is already automatic. They're used as a checksum: say "plant 9" when the app is on row 5 and you get *"✓ 500g — but you said plant 9 and this is #5. Check the count."* One of you has lost track, and it's worth knowing which.

## What's synthetic

Everything in `js/config.js` — 20 strain names, 7 grow rooms, 3 drying rooms, 4 employees, and the column schema. Replace all of it with the operator's real values; nothing outside that file should need to change.

The plausible-weight bounds (50–8000 g per plant, wet) are a guess. Set them from the operator's actual harvest data — they're what decides which entries get flagged for supervisor review.

## What this deliberately isn't

- **No offline queue with retry/backoff.** Rows queue in `localStorage` and there's a manual "Sync now", but there's no service worker and no automatic reconnect flush.
- **No auth.** Worker selection is a dropdown, not a PIN. The `pin` field in config is a placeholder.
- **No barcode scanning.** Plant tags are spoken (`"plant 8842, four point two"`) or omitted. On a phone this should be camera-based scanning — nobody reads a 24-character tag aloud reliably.
- **Web Speech API, not Deepgram.** Fine on Chrome desktop, unreliable on iOS Safari, and no control over vocabulary — which is exactly where strain names fail. `speech.js` is the seam where a Deepgram relay swaps in.

## Files

| File | Role |
|---|---|
| `js/config.js` | Facility config — the only file to change per operator |
| `js/log.js` | Diagnostics — console + on-screen panel |
| `js/parser.js` | Deterministic grammar for the capture loop |
| `js/claude.js` | Batch-setup extraction (Claude, with keyless fallback) |
| `js/store.js` | State + `localStorage` persistence, idempotency keys |
| `js/speech.js` | Push-to-talk wrapper + screen wake lock |
| `js/sheets.js` | Google Sheets sink |
| `js/app.js` | UI wiring |
