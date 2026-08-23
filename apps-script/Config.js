/**
 * The Config tab.
 *
 * Every name, column and address lives in the spreadsheet, not here. Renaming a
 * person is editing a cell — no deployment, no code change, and nothing to keep
 * in sync between the two phones.
 *
 * The keys are in Spanish because that tab is opened and edited by hand in
 * Google Sheets by the two people using the app. It is interface, not schema.
 * See CLAUDE.md.
 */

var CONFIG_SHEET = 'Config';
var FIXED_SHEET = 'Fijos';

/** Fixed positions in the ledger. Only the two amount columns are configurable,
 *  because only those differ between households. */
var COL_DATE = 1;
var COL_CONCEPT = 2;
var COL_BALANCE = 5;
var COL_NOTE = 6;
var COL_ID = 7;

var VOID_MARK = '[anulado] ';

function readConfig_() {
  var cached = readConfig_.cache_;
  if (cached) return cached;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    throw apiError_('MISCONFIGURED',
      'There is no "' + CONFIG_SHEET + '" tab. Run setupSpreadsheet() once from the editor.');
  }

  var raw = {};
  sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues().forEach(function (row) {
    var key = String(row[0] || '').trim();
    if (key) raw[key] = String(row[1] == null ? '' : row[1]).trim();
  });

  var config = {
    sheetName: raw.hoja_libro || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getName(),
    oauthClientId: raw.oauth_client_id || '',
    people: [
      person_(raw, 1, '#2F62D9'),
      person_(raw, 2, '#A96F13')
    ]
  };

  if (config.people[0].column === config.people[1].column) {
    throw apiError_('MISCONFIGURED', 'Both people point at the same column in Config');
  }

  // Cached for the lifetime of one execution only. Apps Script tears the script
  // down between requests anyway, and a longer-lived cache would mean editing
  // Config had no visible effect until it expired — which reads as a bug.
  readConfig_.cache_ = config;
  return config;
}

function person_(raw, n, defaultColor) {
  var prefix = 'persona_' + n + '_';
  var letter = String(raw[prefix + 'columna'] || (n === 1 ? 'C' : 'D')).trim().toUpperCase();
  return {
    name: raw[prefix + 'nombre'] || ('Persona ' + n),
    column: columnLetterToIndex_(letter),
    email: String(raw[prefix + 'correo'] || '').toLowerCase(),
    color: raw[prefix + 'color'] || defaultColor
  };
}

/** What the frontend is allowed to know. The OAuth client id is public by
 *  nature (it ships in the page) but the emails are not echoed back beyond
 *  telling each user which of the two columns is theirs. */
function publicConfig_(config, user) {
  return {
    people: config.people.map(function (p) {
      return { name: p.name, color: p.color };
    }),
    meIndex: indexOfUser_(config, user)
  };
}

/**
 * Which column belongs to the signed-in account.
 *
 * Returns -1 when the email is not in Config. That is a real state, not an
 * error: an editor of the spreadsheet who is neither of the two people can read
 * the ledger perfectly well, they just have no column to charge an expense to.
 * The app hides the payer selector and the save button in that case.
 */
function indexOfUser_(config, user) {
  for (var i = 0; i < config.people.length; i++) {
    if (config.people[i].email && config.people[i].email === user.email) return i;
  }
  return -1;
}

function ledgerSheet_(config) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheetName);
  if (!sheet) {
    throw apiError_('MISCONFIGURED', 'There is no tab named "' + config.sheetName + '"');
  }
  return sheet;
}

function columnLetterToIndex_(letter) {
  var index = 0;
  for (var i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  if (!(index >= 1 && index <= 26)) {
    throw apiError_('MISCONFIGURED', 'Not a valid column letter: ' + letter);
  }
  return index;
}
