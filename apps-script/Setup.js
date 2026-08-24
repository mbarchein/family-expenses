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

  var existingFixed = ss.getSheetByName(FIXED_SHEET);
  if (existingFixed) {
    // `desde` and `último` arrived after the tab did. Headers and notes only —
    // never a data cell, and never `último` itself, which is the app's record of
    // what has already been dealt with.
    if (!String(existingFixed.getRange(1, 7).getValue()).trim()) {
      existingFixed.getRange(1, 7, 1, 2)
        .setValues([[FIXED_HEADERS[6], FIXED_HEADERS[7]]])
        .setFontWeight('bold');
      annotateFixed_(existingFixed);
      report.push('Fijos: already there — added the `desde` and `último` headers');
    } else {
      report.push('Fijos: already there, left alone');
    }
  } else {
    var fixed = ss.insertSheet(FIXED_SHEET);
    fixed.getRange(1, 1, 1, FIXED_COLS).setValues([FIXED_HEADERS]).setFontWeight('bold');
    annotateFixed_(fixed);
    fixed.setColumnWidth(1, 220);
    report.push('Fijos: created — ' + FIXED_HEADERS.join(' | '));
  }

  if (ss.getSheetByName(SUGGESTIONS_SHEET)) {
    report.push('Sugerencias: already there, left alone');
  } else {
    var suggestions = ss.insertSheet(SUGGESTIONS_SHEET);
    // Two payment methods to start with, because an empty tab does not explain
    // its own shape and these two are what the selector needs to appear at all.
    suggestions.getRange(1, 1, 3, 3).setValues([
      ['texto', 'tipo', 'ámbito'],
      ['Efectivo', 'medio', ''],
      ['Tarjeta', 'medio', '']
    ]);
    suggestions.getRange(1, 1, 1, 3).setFontWeight('bold');
    // The notes are the documentation. This tab is edited in the browser by two
    // people who will not be reading the source, and a wrong `tipo` is the one
    // mistake here that makes a row vanish.
    suggestions.getRange(1, 2).setNote('concepto, observacion o medio');
    suggestions.getRange(1, 3).setNote(
      'Vacío = para los dos. O el nombre de una persona, tal como está en Config.');
    suggestions.setColumnWidth(1, 260);
    report.push('Sugerencias: created — texto | tipo | ámbito, with two payment methods');
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
    // Both halves on purpose. The rounded one is the number the app shows and
    // the two of them argue about; the raw one is why it sometimes ends in a
    // string of nines, which is the spreadsheet's own floating point and not
    // something this app did to their money.
    'Balance read:     ' + euros_(sheet.getRange(last, COL_BALANCE).getValue()) +
      '  (raw: ' + sheet.getRange(last, COL_BALANCE).getValue() + ')',
    'Balance formula:  ' + sheet.getRange(last, COL_BALANCE).getFormula(),
    'Person 1:         ' + config.people[0].name + ' -> column ' + config.people[0].column +
      ' <' + (config.people[0].email || 'NO EMAIL') + '>',
    'Person 2:         ' + config.people[1].name + ' -> column ' + config.people[1].column +
      ' <' + (config.people[1].email || 'NO EMAIL') + '>',
    'OAuth client id:  ' + (config.oauthClientId || 'NOT SET — sign-in will refuse everyone'),
    'Allowed accounts: ' + allowedEmails_().join(', ')
  ];

  // A balance cell with no formula is not a balance. Printed as a bare value it
  // reads as "nothing to see"; the app turns that same empty cell into 0 and
  // shows a difference of zero, which is the one number here that is not
  // allowed to be quietly wrong. Run dumpLedgerShape() when this fires.
  if (!sheet.getRange(last, COL_BALANCE).getFormula()) {
    lines.push('*** ' + columnIndexToLetter_(COL_BALANCE) + last + ' holds no formula —' +
      ' the balance is read from that cell alone. Run dumpLedgerShape(). ***');
  }

  var suggestions = readSuggestions_();
  var counts = { concept: 0, note: 0, method: 0 };
  suggestions.items.forEach(function (item) { counts[item.kind]++; });
  lines.push('Sugerencias:      ' + counts.method + ' medios, ' + counts.concept +
    ' conceptos, ' + counts.note + ' observaciones');
  if (suggestions.unknownKind) {
    lines.push('*** ' + suggestions.unknownKind + ' row(s) in Sugerencias have a `tipo` that is' +
      ' none of concepto/observacion/medio, and are ignored ***');
  }
  if (suggestions.unknownScope) {
    lines.push('*** ' + suggestions.unknownScope + ' row(s) in Sugerencias name an `ámbito` that is' +
      ' neither person, and are being shown to both ***');
  }

  // The Fijos tab, which this report used to say nothing about at all — while
  // the advice being given was to run *this* function to give that tab its
  // `desde` and `último` headers. It is `setupSpreadsheet` that writes them, so
  // the one function anybody runs when something looks wrong had better say
  // whether they are there.
  lines.push('Fijos:            ' + describeFixed_());

  var withoutId = 0;
  if (last >= 2) {
    sheet.getRange(2, COL_ID, last - 1, 1).getValues().forEach(function (row) {
      if (!String(row[0] || '')) withoutId++;
    });
  }
  lines.push('Rows without id:  ' + withoutId +
    (withoutId ? ' (read-only from the app; run backfillIds)' : ''));

  console.log(lines.join('\n'));
  return lines.join('\n');
}

/**
 * The ledger's shape, wider than the code's own assumptions.
 *
 * sanityCheck() has two blind spots that between them hid a real mismatch for
 * an entire deployment. It reads only as far as COL_ID, so a ledger with an
 * extra column in front looks merely odd rather than shifted; and it prints the
 * balance as a value without saying whether a formula produced it, so a balance
 * read out of an amounts cell arrives as an empty line instead of an alarm.
 *
 * This looks at A to J regardless of the constants, shows every formula, and
 * ends by checking the two configured amount columns against the five fixed
 * ones — a person pointed at COL_BALANCE is the failure that started all this,
 * and it is one comparison away from being obvious.
 *
 * Read-only. Run it whenever the shape is in doubt, and in particular before
 * DEPLOY.md 9 hands the app the real book.
 */
function dumpLedgerShape() {
  var WIDTH = 10; // A to J: deliberately wider than COL_ID
  var config = readConfig_();
  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  var lines = [
    'Ledger tab:   ' + config.sheetName,
    'lastDataRow_: ' + last + ' (walked up column ' + columnIndexToLetter_(COL_DATE) + ')',
    ''
  ];

  // Display values, not raw ones: a date comes back as a Date object whose
  // toString says nothing about the format the sheet actually shows.
  for (var r = 1; r <= 3; r++) {
    var shown = sheet.getRange(r, 1, 1, WIDTH).getDisplayValues()[0];
    lines.push('row ' + r + ':  ' + shown.map(function (v, i) {
      return columnIndexToLetter_(i + 1) + '=' + (v === '' ? '(empty)' : v);
    }).join(' | '));
  }

  lines.push('', 'row ' + last + ', per column:');
  var values = sheet.getRange(last, 1, 1, WIDTH).getDisplayValues()[0];
  var formulas = sheet.getRange(last, 1, 1, WIDTH).getFormulas()[0];
  for (var c = 0; c < WIDTH; c++) {
    lines.push('  ' + columnIndexToLetter_(c + 1) + ': ' +
      (values[c] === '' ? '(empty)' : values[c]) +
      (formulas[c] ? '   formula: ' + formulas[c] : '   (no formula)'));
  }

  // What the code will reach for, next to the header that is actually there.
  var headers = sheet.getRange(1, 1, 1, WIDTH).getDisplayValues()[0];
  var fixed = [
    ['COL_DATE', COL_DATE],
    ['COL_CONCEPT', COL_CONCEPT],
    ['COL_BALANCE', COL_BALANCE],
    ['COL_NOTE', COL_NOTE],
    ['COL_ID', COL_ID]
  ];
  lines.push('', 'what the code will use:');
  fixed.forEach(function (pair) {
    lines.push('  ' + pair[0] + ' = ' + pair[1] + ' (' + columnIndexToLetter_(pair[1]) + ')' +
      ' -> header "' + (headers[pair[1] - 1] || '(empty)') + '"');
  });
  config.people.forEach(function (person, i) {
    lines.push('  persona_' + (i + 1) + '  = ' + person.column +
      ' (' + columnIndexToLetter_(person.column) + ')' +
      ' -> header "' + (headers[person.column - 1] || '(empty)') + '"  ' + person.name);
  });

  // The collisions. Any of these means a write lands on top of another field.
  config.people.forEach(function (person, i) {
    fixed.forEach(function (pair) {
      if (person.column === pair[1]) {
        lines.push('  *** persona_' + (i + 1) + ' and ' + pair[0] +
          ' are both column ' + columnIndexToLetter_(pair[1]) +
          ' — saving would write one over the other ***');
      }
    });
  });
  if (!formulas[COL_BALANCE - 1]) {
    lines.push('  *** ' + columnIndexToLetter_(COL_BALANCE) + last +
      ' holds no formula. The balance is read from that cell and nothing else,' +
      ' so the app would show ' + (Number(values[COL_BALANCE - 1]) || 0) + ' ***');
  }

  console.log(lines.join('\n'));
  return lines.join('\n');
}

/**
 * The notes are the documentation, the way they are on Sugerencias.
 *
 * This tab is edited in a browser by two people who will never read this file,
 * and the columns that can be got wrong silently are `periodicidad` — a word
 * that is not on the list stops a row being proposed at all — and `último`,
 * which is the app's own bookkeeping and not a field to fill in by hand.
 */
/** Two decimals, the way the app shows it. */
function euros_(value) {
  var number = Number(value);
  return isNaN(number) ? String(value) : number.toFixed(2);
}

/**
 * The state of the recurring templates, in one line plus whatever is wrong.
 *
 * Deliberately readFixed_ rather than a second reading of the tab: what this has
 * to report is what the *app* will see, including the rows it refuses and why.
 * A report that read the cells its own way could say everything is fine about a
 * tab the app cannot use.
 */
function describeFixed_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FIXED_SHEET);
  if (!sheet) return 'no tab — run setupSpreadsheet to create it';

  var headed = String(sheet.getRange(1, 7).getValue()).trim() &&
    String(sheet.getRange(1, 8).getValue()).trim();
  var fixed = readFixed_();
  var active = fixed.items.filter(function (item) { return item.active; }).length;

  var line = fixed.items.length + ' templates, ' + active + ' active';
  if (!headed) {
    // Without the two headers the tab still reads — the columns are read by
    // position — but nothing can be written back to `último`, so every period
    // would be proposed again for ever.
    line += ' — MISSING the `desde` and `último` headers; run setupSpreadsheet';
  }
  if (fixed.problems.length) {
    line += '\n*** Fijos rows the app is ignoring: ' + fixed.problems.join('; ') + ' ***';
  }
  return line;
}

function annotateFixed_(sheet) {
  sheet.getRange(1, 2).setNote('Vacío = te lo pregunta cada vez (la luz, el agua).');
  sheet.getRange(1, 3).setNote('Día del mes. 31 en un mes de 30 cae el último día.');
  sheet.getRange(1, 4).setNote('Vacío = quien tenga el móvil en ese momento.');
  sheet.getRange(1, 5).setNote(
    'mensual, bimestral, trimestral, cuatrimestral, semestral o anual. Vacío = mensual.');
  sheet.getRange(1, 6).setNote('Vacío o sí = activo. Cualquier otra cosa lo desactiva.');
  sheet.getRange(1, 7).setNote(
    'Desde cuándo cuenta la periodicidad. Solo importa si no es mensual.');
  sheet.getRange(1, 8).setNote('Lo escribe la app: el último vencimiento resuelto. No lo edites.');
}
