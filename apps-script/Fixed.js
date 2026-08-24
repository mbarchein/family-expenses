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
 * The row number is the identity of a template, the way it is for a ledger
 * entry. Nothing here reorders the tab.
 */

var FIXED_COLS = 8;
var FIXED_HEADERS = [
  'concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'
];

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
      problems.push(concept + ': periodicidad «' + row[4] + '» no reconocida');
      return;
    }

    var day = Number(row[2]) || 1;
    if (day < 1 || day > 31) {
      problems.push(concept + ': dia ' + row[2] + ' fuera de 1..31');
      return;
    }

    var who = fold_(row[3]);
    var person = who ? names.indexOf(who) : -1;
    if (who && person === -1) problems.push(concept + ': persona «' + row[3] + '» no es ninguna de las dos');

    items.push({
      row: rowNumber,
      concept: concept,
      // Empty stays empty rather than becoming zero: it is the difference
      // between "always 60 euros" and "ask me every time".
      amount: row[1] === '' || row[1] == null ? null : Number(row[1]),
      day: day,
      payer: person === -1 ? null : person,
      months: cadence,
      active: fixedIsActive_(row[5]),
      from: formatDate_(row[6]) || '',
      last: formatDate_(row[7]) || ''
    });
  });

  return { items: items, problems: problems };
}

/**
 * Writes one template, appending when it is new.
 *
 * `último` is never touched here. It is the app's record of what has been dealt
 * with, and an edit to the amount of the rent is not a statement about whether
 * this month's is paid — losing that distinction would propose the rent twice.
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

  var row = Number(payload.row) || 0;
  if (row < 2 || row > sheet.getLastRow()) {
    row = Math.max(sheet.getLastRow() + 1, 2);
  }
  // Seven columns, not eight: `último` is left exactly as it was.
  sheet.getRange(row, 1, 1, values.length).setValues([values]);

  return { row: row };
}

/** Marks a template as dealt with up to `due` — confirmed or skipped, which
 *  are the same fact as far as "do not propose it again" is concerned. */
function setFixedDone_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FIXED_SHEET);
  if (!sheet) throw apiError_('NO_FIXED_SHEET', 'Falta la pestaña ' + FIXED_SHEET);

  var row = Number(payload.row) || 0;
  if (row < 2 || row > sheet.getLastRow()) throw apiError_('BAD_REQUEST', 'Fila ' + row + ' no existe');

  var due = String(payload.due || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw apiError_('BAD_REQUEST', 'Fecha «' + due + '» inválida');

  // Written as text rather than as a Date: the app compares these as strings and
  // a cell Sheets decides to reformat is a comparison that stops matching.
  sheet.getRange(row, 8).setNumberFormat('@').setValue(due);
  return { row: row, last: due };
}

function cadenceName_(months) {
  var wanted = Number(months) || 1;
  for (var name in FIXED_CADENCES) {
    if (FIXED_CADENCES[name] === wanted) return name;
  }
  return 'mensual';
}
