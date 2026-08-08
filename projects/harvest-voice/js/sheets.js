/* ========================================
   HarvestVoice — Google Sheets sink
   ----------------------------------------
   Sheets is a SINK, not the table. The UI renders
   from local state the moment the worker finishes
   speaking; this writes behind it and reports a
   per-row sync state.

   Get that boundary wrong and every demo is hostage
   to a token refresh. Get it right and the eventual
   POS adapter slots in beside this file.

   Auth is browser OAuth (Google Identity Services) —
   no server, no service-account JSON to leak. In
   production a warehouse worker would never OAuth
   into Google; that becomes a service account behind
   a server. For v1 this is strictly better.
   ======================================== */

const Sheets = {
  tokenClient: null,
  accessToken: null,
  ready: false,

  init(clientId) {
    if (!clientId || !window.google?.accounts?.oauth2) return false;
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (response) => {
        if (response.access_token) {
          this.accessToken = response.access_token;
          this.ready = true;
          this._onAuth?.(true);
        }
      },
    });
    return true;
  },

  connect(onAuth) {
    this._onAuth = onAuth;
    if (!this.tokenClient) return false;
    this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    return true;
  },

  disconnect() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    this.ready = false;
  },

  async append(sheetName, rows) {
    if (!this.ready) throw new Error('Not connected to Google Sheets');
    const id = Store.state.settings.spreadsheetId;
    if (!id) throw new Error('No spreadsheet ID configured');

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}` +
      `/values/${encodeURIComponent(sheetName)}!A1:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    });

    if (res.status === 401) {
      this.ready = false;
      throw new Error('Google token expired — reconnect');
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  },

  /**
   * Overwrite an exact range. This is what makes edits possible — appending
   * a corrected row would just leave two contradictory records in the sheet.
   */
  async update(range, rows) {
    if (!this.ready) throw new Error('Not connected to Google Sheets');
    const id = Store.state.settings.spreadsheetId;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}` +
      `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    });
    if (res.status === 401) { this.ready = false; throw new Error('Google token expired — reconnect'); }
    if (!res.ok) throw new Error(`Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  },

  /** Ensure the two tabs exist with the right header rows. Safe to re-run. */
  async ensureTabs() {
    if (!this.ready) throw new Error('Not connected to Google Sheets');
    const id = Store.state.settings.spreadsheetId;
    const meta = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!meta.ok) throw new Error(`Could not read spreadsheet ${meta.status}`);
    const doc = await meta.json();
    const existing = new Set(doc.sheets.map((s) => s.properties.title));

    const requests = [];
    if (!existing.has('Plants')) requests.push({ addSheet: { properties: { title: 'Plants' } } });
    if (!existing.has('Batches')) requests.push({ addSheet: { properties: { title: 'Batches' } } });

    if (requests.length) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ requests }),
        },
      );
      await this.append('Plants', [CONFIG.plantColumns]);
      await this.append('Batches', [CONFIG.batchColumns]);
    }
    return true;
  },
};

/** Map a stored plant row into the Plants sheet column order. */
function plantToRow(p) {
  return [
    p.timestamp,
    p.batchId,
    p.plantTag,
    p.strain,
    p.room,
    p.weight,
    p.unit,
    p.destinationRoom,
    p.employee,
    p.notes + (p.flagged ? ' [FLAGGED: outside plausible range]' : ''),
  ];
}

/** Map a closed batch into the Batches sheet column order. */
function batchToRow(b) {
  return [
    b.batchId,
    b.openedAt,
    b.closedAt,
    b.strain,
    b.room,
    b.destinationRoom,
    b.unit,
    b.employee,
    b.plantCount,
    b.totalWeight,
    b.notes,
  ];
}

/**
 * Flush every pending plant row. Runs behind the UI — a failure here marks
 * rows 'failed' and leaves them queued; it never blocks capture.
 */
/**
 * Parse the range an append landed in ("Plants!A5:J7") and hand back the
 * per-row A1 ranges, so a later edit can overwrite exactly that row.
 */
function rangesFromAppend(response, tab, columnCount, rowCount) {
  const updated = response?.updates?.updatedRange;
  if (!updated) return [];
  const m = updated.match(/!([A-Z]+)(\d+)/);
  if (!m) return [];
  const firstRow = parseInt(m[2], 10);
  const lastCol = String.fromCharCode(64 + columnCount);
  return Array.from({ length: rowCount }, (_, i) => `${tab}!A${firstRow + i}:${lastCol}${firstRow + i}`);
}

/**
 * Push an already-closed batch, reflecting edits.
 *
 * Three distinct operations, because a spreadsheet that only ever grows can't
 * represent a correction:
 *   - rows already in the sheet are UPDATED in place
 *   - rows that have never synced are APPENDED (capturing their range)
 *   - rows deleted locally are VOIDED, not erased — the audit trail survives
 */
async function flushBatch(batch) {
  if (!Sheets.ready) return { skipped: true };
  const rows = batch.plants || [];
  const pending = rows.filter((p) => p.sync !== 'synced');
  const toUpdate = pending.filter((p) => p.sheetRange);
  const toAppend = pending.filter((p) => !p.sheetRange);
  const toVoid = batch.voided || [];

  try {
    for (const p of toUpdate) {
      await Sheets.update(p.sheetRange, [plantToRow(p)]);
    }

    if (toAppend.length) {
      const res = await Sheets.append('Plants', toAppend.map(plantToRow));
      const ranges = rangesFromAppend(res, 'Plants', CONFIG.plantColumns.length, toAppend.length);
      toAppend.forEach((p, i) => { if (ranges[i]) p.sheetRange = ranges[i]; });
    }

    for (const v of toVoid) {
      const blanked = CONFIG.plantColumns.map(() => '');
      blanked[0] = new Date().toISOString();
      blanked[blanked.length - 1] = `VOIDED — was ${v.weight}${v.unit}`;
      await Sheets.update(v.sheetRange, [blanked]);
    }
    batch.voided = [];

    pending.forEach((p) => { p.sync = 'synced'; });

    // The batch header row moves too — count and total change with every edit.
    if (batch.sheetRange) {
      await Sheets.update(batch.sheetRange, [batchToRow(batch)]);
    } else {
      const res = await Sheets.append('Batches', [batchToRow(batch)]);
      const ranges = rangesFromAppend(res, 'Batches', CONFIG.batchColumns.length, 1);
      if (ranges[0]) batch.sheetRange = ranges[0];
    }
    batch.sync = 'synced';

    Store.save();
    Log.info('batch synced', {
      batch: batch.batchId, updated: toUpdate.length, appended: toAppend.length, voided: toVoid.length,
    });
    return { updated: toUpdate.length, appended: toAppend.length, voided: toVoid.length };
  } catch (err) {
    pending.forEach((p) => { p.sync = 'failed'; });
    batch.sync = 'failed';
    Store.save();
    Log.error('batch sync failed', String(err.message || err));
    return { error: String(err.message || err) };
  }
}

async function flushPendingPlants() {
  if (!Sheets.ready) return { skipped: true };
  const pending = Store.state.plants.filter((p) => p.sync !== 'synced');
  if (!pending.length) return { synced: 0 };
  try {
    const res = await Sheets.append('Plants', pending.map(plantToRow));
    // Remember where each row landed so a later edit can update it in place.
    const ranges = rangesFromAppend(res, 'Plants', CONFIG.plantColumns.length, pending.length);
    pending.forEach((p, i) => { if (ranges[i]) p.sheetRange = ranges[i]; });
    Store.markSynced(pending.map((p) => p.id));
    return { synced: pending.length };
  } catch (err) {
    Store.markFailed(pending.map((p) => p.id));
    return { error: String(err.message || err) };
  }
}
