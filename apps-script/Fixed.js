/**
 * The Fijos tab: the recurring expenses, read and written.
 *
 * Eight columns, headers in Spanish for the same reason Config's keys are — the
 * tab is opened and filled in by the two people using the app, so it is
 * interface rather than schema:
 *
 *   concepto      what the expense is called when it lands in the ledger
 *   importe       empty for the ones that change every month, like the light
 *   dia           day of the month it falls due
 *   persona       empty for "whoever is holding the phone"
 *   periodicidad  mensual | bimestral | trimestral | semestral | anual
 *   activo        empty or sí; anything else stops it being proposed
 *   desde         the anchor: which due date the cadence counts from
 *   último        the last due date confirmed or skipped, written by the app
 *
 * **Nothing here decides what is due.** This file reads the rows, writes the
 * rows, and formats dates; which periods a template owes is worked out in the
 * app, in `app/src/lib/fixed.ts`, where there is a test runner. All the risk in
 * this feature is calendar arithmetic — a day 31 in February, an anchor two
 * months out of phase, six missed months — and calendar arithmetic without
 * tests is how a bill gets proposed twice or not at all.
 *
 * **A template is its `id`, not its row.** It was the row for a while, the way a
 * ledger entry's row used to be, and the row is not an identity: this tab is
 * edited by hand in Google Sheets, and deleting or inserting a row above one
 * moves every row below it. A phone holding a list from a minute earlier would
 * then save a template over its neighbour, or mark the wrong one as dealt with —
 * silently, and on the two writes where being wrong is expensive, since `último`
 * is what stops a bill being proposed twice.
 *
 * The row still comes back to the app: it is real information, it is what the
 * users see in the tab, and it is what a report names. It is simply not what
 * anything is looked up by.
 *
 * A row with no `id` is addressed by row as a fallback, and gets stamped with one
 * the first time the app writes it. That is for the templates somebody adds by
 * hand after the migration; `setupSpreadsheet` fills in the ones that were there
 * before.
 */

var FIXED_COLS = 10;
var FIXED_HEADERS = [
  'concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último',
  // After `último` and not beside `concepto`, for the same reason the ledger's two
  // new columns went on the end: `último` is written by `fixedDone` and nothing
  // else, and inserting a column would move it out from under that write.
  'categoría',
  // Last, and written by us rather than by them: it is the only column on this
  // tab that is ours. The users never need to look at it.
  'id'
];
/** The column `último` lives in. Named because two writes have to step around
 *  it: it is the tab's own record of what has been dealt with. */
var FIXED_COL_LAST = 8;
var FIXED_COL_CATEGORY = 9;
var FIXED_COL_ID = 10;

/** `activo` is opt-out: an empty cell is an active template, because a tab
 *  filled in by hand should not need a word in every row to work. */
function fixedIsActive_(value) {
  var text = fold_(value);
  return text === '' || text === 'si' || text === 'sí' || text === 'x' || text === 'true';
}

var FIXED_CADENCES = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  cuatrimestral: 4,
  semestral: 6,
  anual: 12
};

/**
 * Every template on the tab, with its problems named rather than dropped.
 *
 * The problems are English prose around Spanish nouns, and that is the rule
 * rather than an accident: `periodicidad`, `dia` and `persona` are the tab's own
 * column headers, so they are the users' data and are quoted as they appear —
 * while the sentence around them is read by whoever runs `sanityCheck`, which is
 * us. Nothing here reaches the app; if it ever does, it needs translating first.
 *
 * A row the app cannot use is reported instead of vanishing — the same rule the
 * Sugerencias tab follows, and for the same reason: a row that disappears
 * without saying why is a bug the app gets blamed for.
 */
function readFixed_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FIXED_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { items: [], problems: [] };

  var names = readConfig_().people.map(function (person) { return fold_(person.name); });
  var width = Math.min(sheet.getMaxColumns(), FIXED_COLS);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
  var items = [];
  var problems = [];

  rows.forEach(function (row, index) {
    var rowNumber = index + 2;
    var concept = String(row[0] == null ? '' : row[0]).trim();
    if (!concept) return;

    var cadence = FIXED_CADENCES[fold_(row[4])] || (fold_(row[4]) === '' ? 1 : 0);
    if (!cadence) {
      problems.push(concept + ': periodicidad «' + row[4] + '» is not a cadence we know');
      return;
    }

    var day = Number(row[2]) || 1;
    if (day < 1 || day > 31) {
      problems.push(concept + ': dia ' + row[2] + ' is outside 1..31');
      return;
    }

    var who = fold_(row[3]);
    var person = who ? names.indexOf(who) : -1;
    if (who && person === -1) problems.push(concept + ': persona «' + row[3] + '» is neither of the two');

    items.push({
      row: rowNumber,
      // Empty on a row added by hand since the migration. The app falls back to
      // the row for those, and the first write stamps one in.
      id: String(row[FIXED_COL_ID - 1] == null ? '' : row[FIXED_COL_ID - 1]).trim(),
      concept: concept,
      // Empty stays empty rather than becoming zero: it is the difference
      // between "always 60 euros" and "ask me every time".
      amount: row[1] === '' || row[1] == null ? null : Number(row[1]),
      day: day,
      payer: person === -1 ? null : person,
      months: cadence,
      category: String(row[FIXED_COL_CATEGORY - 1] == null ? '' : row[FIXED_COL_CATEGORY - 1]).trim(),
      active: fixedIsActive_(row[5]),
      from: formatDate_(row[6]) || '',
      last: formatDate_(row[7]) || ''
    });
  });

  return { items: items, problems: problems };
}

/**
 * The row a template's id is on, or 0.
 *
 * Read as one range and walked from the bottom, like the ledger's own lookup: if
 * an id ever appears twice — a row duplicated by hand in the tab — the later one
 * wins, which is the one somebody just made.
 */
function findFixedRowById_(sheet, id) {
  if (!id) return 0;
  var last = sheet.getLastRow();
  if (last < 2 || sheet.getMaxColumns() < FIXED_COL_ID) return 0;
  var ids = sheet.getRange(2, FIXED_COL_ID, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).trim() === id) return i + 2;
  }
  return 0;
}

/**
 * The row a write is aimed at: by id, or by row while a template has no id.
 *
 * The row fallback is not only for rows added by hand. An operation queued by a
 * phone running the previous version carries a row and no id — the queue is on
 * disk and survives the app updating itself — so dropping the fallback would turn
 * a saved template into a `BAD_REQUEST` the queue reports and discards. It can go
 * once both phones have been through a cycle of saving a fijo.
 */
function fixedRowFor_(sheet, payload) {
  var byId = findFixedRowById_(sheet, String(payload.id || '').trim());
  if (byId) return byId;
  var row = Number(payload.row) || 0;
  return row >= 2 && row <= sheet.getLastRow() ? row : 0;
}

/** Writes the id into a row that has none, so the next write finds it by id. */
function stampFixedId_(sheet, row, id) {
  if (!id) return;
  if (sheet.getMaxColumns() < FIXED_COL_ID) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), FIXED_COL_ID - sheet.getMaxColumns());
  }
  var cell = sheet.getRange(row, FIXED_COL_ID);
  if (!String(cell.getValue()).trim()) cell.setValue(id);
}

/**
 * Writes one template, appending when it is new.
 *
 * `último` is never touched here. It is the app's record of what has been dealt
 * with, and an edit to the amount of the rent is not a statement about whether
 * this month's is paid — losing that distinction would propose the rent twice.
 *
 * Found by id, so replaying a queued save writes the same row twice rather than
 * appending a second copy of the rent — the same reason `append` looks for the
 * entry's id before writing a new line.
 */
function saveFixed_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FIXED_SHEET);
  if (!sheet) throw apiError_('NO_FIXED_SHEET', 'Falta la pestaña ' + FIXED_SHEET);

  var concept = String(payload.concept || '').trim();
  if (!concept) throw apiError_('BAD_REQUEST', 'Un fijo necesita concepto');

  var config = readConfig_();
  var cadence = cadenceName_(payload.months);
  var values = [
    concept,
    payload.amount == null || payload.amount === '' ? '' : Number(payload.amount),
    Number(payload.day) || 1,
    payload.payer == null ? '' : config.people[payload.payer].name,
    cadence,
    payload.active === false ? 'no' : 'sí',
    payload.from || ''
  ];

  var id = String(payload.id || '').trim();
  var row = fixedRowFor_(sheet, payload);
  if (!row) row = Math.max(sheet.getLastRow() + 1, 2);
  // Seven columns, not eight: `último` is left exactly as it was.
  sheet.getRange(row, 1, 1, values.length).setValues([values]);
  stampFixedId_(sheet, row, id);
  // And the category on its own, over on the other side of `último`, which is
  // why this is a second write rather than a wider one.
  if (payload.category !== undefined) {
    sheet.getRange(row, FIXED_COL_CATEGORY)
      .setValue(String(payload.category == null ? '' : payload.category).trim());
  }

  return { row: row, id: id || String(sheet.getRange(row, FIXED_COL_ID).getValue()).trim() };
}

/** Marks a template as dealt with up to `due` — confirmed or skipped, which
 *  are the same fact as far as "do not propose it again" is concerned. */
function setFixedDone_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FIXED_SHEET);
  if (!sheet) throw apiError_('NO_FIXED_SHEET', 'Falta la pestaña ' + FIXED_SHEET);

  var row = fixedRowFor_(sheet, payload);
  if (!row) {
    throw apiError_('NOT_FOUND', 'No hay ningún fijo con id «' + (payload.id || '') +
      '» ni fila ' + (payload.row || 0));
  }

  var due = String(payload.due || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw apiError_('BAD_REQUEST', 'Fecha «' + due + '» inválida');

  // Written as text rather than as a Date: the app compares these as strings and
  // a cell Sheets decides to reformat is a comparison that stops matching.
  sheet.getRange(row, FIXED_COL_LAST).setNumberFormat('@').setValue(due);
  stampFixedId_(sheet, row, String(payload.id || '').trim());
  return { row: row, last: due };
}

function cadenceName_(months) {
  var wanted = Number(months) || 1;
  for (var name in FIXED_CADENCES) {
    if (FIXED_CADENCES[name] === wanted) return name;
  }
  return 'mensual';
}
