/**
 * Reading and writing the ledger.
 *
 * Four rules govern every function here. They come from the shape of the sheet,
 * not from taste, and breaking any of them corrupts a history that goes back
 * years. They are repeated in CLAUDE.md because they are easy to undo by
 * accident:
 *
 *   1. Never write a value or a formula string into the balance column. Copy
 *      the cell down from the row above.
 *   2. Never delete a row. Voiding clears the two amounts.
 *   3. Always append at the end. Never insert, never reorder.
 *   4. Which column holds the amount IS the payer. There is no payer field.
 */

/**
 * The last row that holds an entry.
 *
 * Deliberately not getLastRow(): the balance formula is often dragged past the
 * end of the data, and a stray note or a stale format anywhere below would make
 * getLastRow() point at an empty row. The date column is the one that is filled
 * for every real entry and for nothing else, so it defines where the ledger
 * ends.
 */
/**
 * Which row the window starts at: whichever reaches further back, a row count or
 * the first of January of last year.
 *
 * The count alone was the rule, and it made one number on screen wrong. The
 * totals over the list are computed from what the app holds, so a window of the
 * last few hundred rows turned "this year" into "since whenever row 1999 was" —
 * on a ledger with a couple of thousand rows, a few months. Reaching back to
 * last January makes the year a total rather than a floor, and last year with
 * it, for the price of one extra read of one column.
 *
 * The scan is linear from the top and that is deliberate: rows are appended in
 * the order they are entered, so the days are *nearly* sorted but a back-dated
 * expense sits later than its date. Taking the first row that is recent enough
 * cannot miss an older one, and a back-dated row further down is included
 * anyway — a binary search over almost-sorted data is the kind of clever that
 * silently drops a row.
 *
 * `TAIL_MAX_ROWS` is the ceiling, because one bootstrap is one JSON body on a
 * phone. When it bites, the year is a floor again — and the app says so on the
 * strip over the list rather than letting a floor pass for a total.
 */
function windowStart_(sheet, last, limit) {
  var byCount = Math.max(2, last - limit + 1);
  var ceiling = Math.max(2, last - TAIL_MAX_ROWS + 1);
  var cutoff = new Date(new Date().getFullYear() - 1, 0, 1);

  var dates = sheet.getRange(2, COL_DATE, last - 1, 1).getValues();
  var byDate = byCount;
  for (var i = 0; i < dates.length; i++) {
    var value = dates[i][0];
    if (value instanceof Date && value >= cutoff) {
      byDate = i + 2;
      break;
    }
  }

  return Math.max(Math.min(byCount, byDate), ceiling);
}

function lastDataRow_(sheet) {
  var bottom = sheet.getRange(sheet.getMaxRows(), COL_DATE);
  var row = bottom.getValue() === ''
    ? bottom.getNextDataCell(SpreadsheetApp.Direction.UP).getRow()
    : sheet.getMaxRows();
  return Math.max(row, 1);
}

function readTail_(config, limit) {
  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  if (last < 2) return { balance: 0, entries: [], lastRow: last };

  var first = windowStart_(sheet, last, limit);
  var values = sheet.getRange(first, 1, last - first + 1, COL_ID).getValues();

  var entries = values.map(function (row, i) {
    return rowToEntry_(config, row, first + i);
  });

  // The balance is read, never recomputed: the sheet's own formula is the
  // authority, so the app and the spreadsheet cannot drift apart.
  var balance = Number(sheet.getRange(last, COL_BALANCE).getValue()) || 0;

  return { balance: balance, entries: entries, lastRow: last };
}

function rowToEntry_(config, row, rowNumber) {
  var a = row[config.people[0].column - 1];
  var b = row[config.people[1].column - 1];
  var concept = String(row[COL_CONCEPT - 1] || '');
  var voided = concept.indexOf(VOID_MARK) === 0;

  var payer = null;
  var amount = 0;
  if (a !== '' && a != null) { payer = 0; amount = Number(a); }
  else if (b !== '' && b != null) { payer = 1; amount = Number(b); }

  return {
    row: rowNumber,
    id: String(row[COL_ID - 1] || ''),
    date: formatDate_(row[COL_DATE - 1]),
    concept: voided ? concept.substring(VOID_MARK.length) : concept,
    amount: amount,
    payer: payer,
    note: String(row[COL_NOTE - 1] || ''),
    voided: voided
  };
}

/* ── writes ───────────────────────────────────────────────────────────── */

/**
 * Appends one entry and returns it.
 *
 * Locked, because two phones saving at the same moment would both read the same
 * last row and the second write would land on top of the first. The queue in
 * the app makes that more likely than it sounds: reconnecting after a walk
 * around the supermarket can flush several entries at once from both handsets.
 *
 * Idempotent by id, because that queue retries. A retry that arrives after the
 * original succeeded must not produce a second row, so an id already present in
 * the sheet returns the existing entry instead of appending.
 */
function appendEntry_(config, payload, user) {
  var entry = validateEntry_(config, payload);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = ledgerSheet_(config);

    var existing = findRowById_(sheet, entry.id);
    if (existing) return rowToEntry_(config, readRow_(sheet, existing), existing);

    var last = lastDataRow_(sheet);
    var row = last + 1;

    // Formats first, values after. Copying the previous row's formatting is
    // what gives the new cells the euro format and the date format the sheet
    // has always used; writing raw values into a virgin row would leave it
    // looking foreign among six hundred siblings.
    sheet.getRange(last, 1, 1, COL_ID)
      .copyTo(sheet.getRange(row, 1, 1, COL_ID), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

    writeEntryCells_(sheet, config, row, entry);
    sheet.getRange(row, COL_ID).setValue(entry.id);

    // The balance column is the sheet's formula, copied down. Never generated
    // as text: Apps Script writes formulas in en-US notation while this sheet
    // displays SUMA with semicolons, and building the string by hand would both
    // invite a locale bug and silently discard any change the users make to
    // their own formula.
    sheet.getRange(last, COL_BALANCE).copyTo(sheet.getRange(row, COL_BALANCE));

    SpreadsheetApp.flush();
    return rowToEntry_(config, readRow_(sheet, row), row);
  } finally {
    lock.releaseLock();
  }
}

function updateEntry_(config, payload, user) {
  var entry = validateEntry_(config, payload);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = ledgerSheet_(config);
    var row = requireRowById_(sheet, entry.id);
    writeEntryCells_(sheet, config, row, entry);
    SpreadsheetApp.flush();
    return rowToEntry_(config, readRow_(sheet, row), row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Voids an entry by clearing both amounts and marking the concept.
 *
 * Not a deletion. Every row of the balance column sums the two amount columns
 * from the top, so an empty amount simply drops out of every sum below it and
 * the running total corrects itself. Removing the row would work too, but it
 * throws away what was voided and when — and one misplaced deleteRow on a
 * six-hundred-row history is not something you recover from a phone.
 */
function voidEntry_(config, payload, user) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = ledgerSheet_(config);
    var row = requireRowById_(sheet, String(payload.id || ''));

    var concept = String(sheet.getRange(row, COL_CONCEPT).getValue() || '');
    if (concept.indexOf(VOID_MARK) !== 0) {
      sheet.getRange(row, COL_CONCEPT).setValue(VOID_MARK + concept);
    }
    sheet.getRange(row, config.people[0].column).clearContent();
    sheet.getRange(row, config.people[1].column).clearContent();

    SpreadsheetApp.flush();
    return rowToEntry_(config, readRow_(sheet, row), row);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Gives an id to a row that has none.
 *
 * Those are the entries pasted by hand from a bank statement. They count
 * towards the balance like any other row, but the app refuses to edit them
 * until it can address them by something more stable than a row number — insert
 * one row above and every number below it shifts.
 */
function assignId_(config, payload, user) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = ledgerSheet_(config);
    var row = Number(payload.row);
    if (!(row >= 2 && row <= lastDataRow_(sheet))) {
      throw apiError_('NOT_FOUND', 'Row ' + payload.row + ' is outside the ledger');
    }

    var cell = sheet.getRange(row, COL_ID);
    var current = String(cell.getValue() || '');
    if (!current) {
      current = Utilities.getUuid();
      cell.setValue(current);
      SpreadsheetApp.flush();
    }
    return rowToEntry_(config, readRow_(sheet, row), row);
  } finally {
    lock.releaseLock();
  }
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function writeEntryCells_(sheet, config, row, entry) {
  sheet.getRange(row, COL_DATE).setValue(entry.date);
  sheet.getRange(row, COL_CONCEPT).setValue(entry.concept);

  // Clear both amount cells before writing one of them: an edit that changes
  // the payer has to vacate the old column, or the entry would be counted for
  // both people at once.
  sheet.getRange(row, config.people[0].column).clearContent();
  sheet.getRange(row, config.people[1].column).clearContent();
  sheet.getRange(row, config.people[entry.payer].column).setValue(entry.amount);

  if (entry.note !== null) sheet.getRange(row, COL_NOTE).setValue(entry.note);
}

function readRow_(sheet, row) {
  return sheet.getRange(row, 1, 1, COL_ID).getValues()[0];
}

function findRowById_(sheet, id) {
  if (!id) return 0;
  var last = lastDataRow_(sheet);
  if (last < 2) return 0;
  var ids = sheet.getRange(2, COL_ID, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return 0;
}

function requireRowById_(sheet, id) {
  var row = findRowById_(sheet, id);
  if (!row) throw apiError_('NOT_FOUND', 'No entry with id ' + id);
  return row;
}

function validateEntry_(config, payload) {
  var amount = Number(payload.amount);
  if (!(amount > 0)) throw apiError_('BAD_REQUEST', 'Amount must be a positive number');

  var payer = Number(payload.payer);
  if (payer !== 0 && payer !== 1) throw apiError_('BAD_REQUEST', 'Payer must be 0 or 1');

  var concept = String(payload.concept || '').trim();
  if (!concept) throw apiError_('BAD_REQUEST', 'Concept is required');

  return {
    id: String(payload.id || '') || Utilities.getUuid(),
    date: parseDate_(payload.date),
    concept: concept,
    amount: Math.round(amount * 100) / 100,
    payer: payer,
    note: payload.note === undefined ? null : String(payload.note || '')
  };
}

/** Dates cross the wire as yyyy-MM-dd and are stored as real dates, so the
 *  sheet keeps sorting and filtering them as it always has. */
function parseDate_(value) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) throw apiError_('BAD_REQUEST', 'Date must be yyyy-MM-dd');
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * A cell as `yyyy-MM-dd`, whether the cell is a date or the text of one.
 *
 * It used to be `instanceof Date` and nothing else, which was true of every cell
 * it read — the ledger's own dates are dates. Then the app started writing
 * `último` back into the Fijos tab as *text*, deliberately, so that Sheets could
 * not reformat a value the app compares as a string. Reading it with the old
 * rule gave '' back, and an empty `último` means "never settled": every
 * recurring expense would have been proposed again for ever, one row per month,
 * and the tests that cover that logic all run on the app's side of the wire
 * where the value is already a string.
 */
function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var text = String(value == null ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

/**
 * The concepts to offer as chips, ranked by frequency weighted towards the
 * recent.
 *
 * A plain frequency count would pin the list to whatever this household bought
 * most in 2021. Halving the weight every 90 days keeps "Comedor" near the top
 * while it is still a monthly habit and lets it fade once it stops, without
 * anyone maintaining a list.
 */
/** How many concepts the app is given to search. The grid shows eight of them;
 *  this is the vocabulary behind the search box. */
var CONCEPTS_SENT = 200;

function frequentConcepts_(entries) {
  var HALF_LIFE_DAYS = 90;
  var today = new Date();
  var byKey = {};

  entries.forEach(function (entry) {
    if (!entry.concept || entry.voided || entry.payer === null) return;
    var key = entry.concept.toLowerCase();
    var ageDays = (today - new Date(entry.date)) / 86400000;
    var weight = Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);

    var bucket = byKey[key] || (byKey[key] = { concept: entry.concept, score: 0 });
    bucket.concept = entry.concept;   // keep the most recent spelling
    bucket.score += weight;
  });

  return Object.keys(byKey)
    .map(function (key) { return byKey[key]; })
    .sort(function (a, b) { return b.score - a.score; })
    // Far more than the eight tiles the app shows, and that is the point: the
    // app filters this list as somebody types and *then* cuts it to eight, so
    // whatever is not sent here cannot be found by typing it. It used to send
    // exactly eight, which made the search box able to reorder the tiles already
    // on screen and nothing else — a concept apuntado once, `Museo`, was
    // unreachable the next day. Two hundred short strings is a few kilobytes.
    .slice(0, CONCEPTS_SENT)
    .map(function (bucket) {
      // A concept and nothing else. It used to carry two more things and both
      // were removed for the same reason: they moved a field the user had not
      // touched. The median amount filled in a figure nobody had checked, and
      // the usual payer changed who was paying behind the back of somebody who
      // had already chosen.
      return { concept: bucket.concept };
    });
}

