/**
 * One-off functions, run by hand from the Apps Script editor.
 *
 * Nothing here is reachable over HTTP. These touch the structure of a
 * spreadsheet that holds years of history, so they are deliberately something a
 * person triggers while looking at the result, not something a phone can fire.
 *
 * Run them against the COPY first. See DEPLOY.md.
 */

/**
 * Creates what the app needs and nothing else.
 *
 * Safe to run twice: it never overwrites a Config that already exists, and it
 * refuses to claim the id column if something is already living there.
 */
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ledger = ss.getSheets()[0];
  var report = [];

  if (ss.getSheetByName(CONFIG_SHEET)) {
    report.push('Config: already there, left alone');
  } else {
    var sheet = ss.insertSheet(CONFIG_SHEET);
    // The initial names come from the ledger's own headers, which is what the
    // two people already call each other in this spreadsheet. They are only a
    // starting point — from now on the app reads the name from here, so the
    // headers can be renamed freely.
    var rows = [
      ['clave', 'valor'],
      ['hoja_libro', ledger.getName()],
      ['oauth_client_id', ''],
      ['persona_1_nombre', String(ledger.getRange(1, 3).getValue() || 'Persona 1')],
      ['persona_1_columna', 'C'],
      ['persona_1_correo', ''],
      ['persona_1_color', '#2F62D9'],
      ['persona_2_nombre', String(ledger.getRange(1, 4).getValue() || 'Persona 2')],
      ['persona_2_columna', 'D'],
      ['persona_2_correo', ''],
      ['persona_2_color', '#A96F13']
    ];
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 320);
    report.push('Config: created — fill in oauth_client_id and the two emails');
  }

  if (ss.getSheetByName(FIXED_SHEET)) {
    report.push('Fijos: already there, left alone');
  } else {
    var fixed = ss.insertSheet(FIXED_SHEET);
    fixed.getRange(1, 1, 1, 6)
      .setValues([['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']])
      .setFontWeight('bold');
    report.push('Fijos: created — empty, fill it in when phase 2 lands');
  }

  var idHeader = ledger.getRange(1, COL_ID);
  var current = String(idHeader.getValue() || '');
  if (!current) {
    idHeader.setValue('id').setFontWeight('bold');
    report.push('Ledger: "id" header written in column G');
  } else if (current === 'id') {
    report.push('Ledger: the id column was already there');
  } else {
    report.push('Ledger: column G holds "' + current + '" — MOVE IT or point COL_ID elsewhere');
  }

  console.log(report.join('\n'));
  return report;
}

/**
 * Gives every existing row an id.
 *
 * Optional. Without it the history still counts towards the balance and reads
 * fine in the app; the rows simply cannot be edited from a phone until each one
 * is claimed individually. Running it once turns the whole archive editable.
 *
 * One pass, one write. Six hundred separate setValue calls would take minutes
 * and time the execution out.
 */
function backfillIds() {
  var config = readConfig_();
  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  if (last < 2) return 'Nothing to do: the ledger is empty';

  var range = sheet.getRange(2, COL_ID, last - 1, 1);
  var ids = range.getValues();
  var written = 0;

  for (var i = 0; i < ids.length; i++) {
    if (!String(ids[i][0] || '')) {
      ids[i][0] = Utilities.getUuid();
      written++;
    }
  }

  if (written) range.setValues(ids);
  var message = written + ' of ' + ids.length + ' rows given an id';
  console.log(message);
  return message;
}

/**
 * Reports what the script sees, without changing anything.
 *
 * This is the first thing to run after deploying, and the thing to run again
 * when something behaves oddly. It answers, in one go, the questions that
 * otherwise turn into an afternoon: is it looking at the right tab, does the
 * balance it reads match the one on screen, and can it actually see the sharing
 * list or is it falling back to the Config emails.
 */
function sanityCheck() {
  var config = readConfig_();
  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  var headers = sheet.getRange(1, 1, 1, COL_ID).getValues()[0];

  var lines = [
    'Ledger tab:       ' + config.sheetName,
    'Last entry row:   ' + last,
    'Headers:          ' + headers.map(function (h) { return h || '(empty)'; }).join(' | '),
    'Balance read:     ' + sheet.getRange(last, COL_BALANCE).getValue(),
    'Balance formula:  ' + sheet.getRange(last, COL_BALANCE).getFormula(),
    'Person 1:         ' + config.people[0].name + ' -> column ' + config.people[0].column +
      ' <' + (config.people[0].email || 'NO EMAIL') + '>',
    'Person 2:         ' + config.people[1].name + ' -> column ' + config.people[1].column +
      ' <' + (config.people[1].email || 'NO EMAIL') + '>',
    'OAuth client id:  ' + (config.oauthClientId || 'NOT SET — sign-in will refuse everyone'),
    'Allowed accounts: ' + allowedEmails_().join(', ')
  ];

  var withoutId = 0;
  if (last >= 2) {
    sheet.getRange(2, COL_ID, last - 1, 1).getValues().forEach(function (row) {
      if (!String(row[0] || '')) withoutId++;
    });
  }
  lines.push('Rows without id:  ' + withoutId + ' (read-only from the app; run backfillIds)');

  console.log(lines.join('\n'));
  return lines.join('\n');
}
