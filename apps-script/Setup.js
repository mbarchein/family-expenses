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

  if (ss.getSheetByName(CATEGORIES_SHEET)) {
    report.push('Categorías: already there, left alone');
  } else {
    var categories = categoriesSheet_();
    categories.getRange(2, 1, CATEGORY_SEED.length, CATEGORY_HEADERS.length)
      .setValues(CATEGORY_SEED);
    // The notes are the documentation: this tab is edited in a browser by two
    // people who are not going to read the source.
    categories.getRange(1, 2).setNote(
      'El nombre del icono. Varias categorías pueden compartir uno; la app avisa.');
    categories.getRange(1, 3).setNote(
      'Palabras que hacen adivinar esta categoría desde el concepto, separadas por comas.');
    categories.setColumnWidth(1, 200);
    categories.setColumnWidth(3, 420);
    report.push('Categorías: created — ' + CATEGORY_SEED.length + ' to start with, rename freely');
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

  // The sheet has to be wide enough before anything can be written into H or I.
  // A Google sheet starts with 26 columns and this one has never been trimmed,
  // so this is a guard rather than an expectation — and a write past the last
  // column throws, which would abort the whole run.
  if (ledger.getMaxColumns() < COL_LAST) {
    ledger.insertColumnsAfter(ledger.getMaxColumns(), COL_LAST - ledger.getMaxColumns());
    report.push('Ledger: widened to ' + COL_LAST + ' columns');
  }
  report.push(claimColumn_(ledger, COL_CATEGORY, 'categoría'));
  report.push(claimColumn_(ledger, COL_METHOD, 'forma de pago'));

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
  // The tab is `Sugerencias` because that is what it is called in their
  // spreadsheet; what is counted is described in English like the rest of this
  // report, which nobody but us reads.
  lines.push('Sugerencias:      ' + plural_(counts.method, 'method') + ', ' +
    plural_(counts.concept, 'concept') + ', ' + plural_(counts.note, 'note'));
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
/** "1 template", "3 templates". A report that says "1 methods" reads as one
 *  written by nobody, which is a poor advertisement for the numbers in it. */
/**
 * Writes a header into an empty column, and refuses to touch an occupied one.
 *
 * The same care the id column has always had, now that there are three of these.
 * A column that already holds something is somebody's data: naming it after what
 * the app wants would not move that data, it would just make the app read it as
 * something it is not.
 */
function claimColumn_(sheet, column, header) {
  var letter = String.fromCharCode('A'.charCodeAt(0) + column - 1);
  var cell = sheet.getRange(1, column);
  var current = String(cell.getValue() || '').trim();
  if (!current) {
    cell.setValue(header).setFontWeight('bold');
    return 'Ledger: "' + header + '" header written in column ' + letter;
  }
  if (current === header) return 'Ledger: the ' + header + ' column was already there';
  return 'Ledger: column ' + letter + ' holds "' + current + '" — MOVE IT before the app'
    + ' writes ' + header + ' over it';
}

/**
 * Brings an existing Categorías tab up to date with the seed, additively.
 *
 * The seed is only written when the tab is created, so a tab that already exists
 * never sees a new category or a new word — and the first real run of
 * `previewCategorise` against 2,323 rows is exactly what teaches you which words
 * were missing. This is how those get in without anybody retyping thirty rows.
 *
 * Additive on purpose: it appends categories the tab does not have and words a
 * category does not have, and it removes nothing. This tab is theirs to edit, and
 * a pass that "corrected" it back to the seed would undo the editing it exists to
 * support. The one exception is `CATEGORY_RENAMES`, which is a name change rather
 * than a deletion, and which only fires when the old name is present and the new
 * one is not.
 *
 * Every line it changes is reported, because a function that edits a tab somebody
 * curates has to be readable afterwards.
 */
function updateCategories() {
  var existing = readCategories_();
  if (existing.missing) {
    return report_(['There is no "' + CATEGORIES_SHEET + '" tab. Run setupSpreadsheet() first.']);
  }

  var lines = [];
  var byKey = {};
  existing.items.forEach(function (item) { byKey[fold_(item.name)] = item; });

  CATEGORY_RENAMES.forEach(function (pair) {
    var from = byKey[fold_(pair[0])];
    if (!from || byKey[fold_(pair[1])]) return;
    // `raw` and not the folded list, both into the cell and into what the pass
    // below reads: with it missing, the rename wrote a stripped copy of the words
    // and the append that followed had nothing to append to, so it replaced them.
    // A rename lost `hipoteca`, and the next run put it back — which is how a
    // three-run probe found it.
    saveCategory_({ was: pair[0], name: pair[1], icon: from.icon, words: from.raw });
    delete byKey[fold_(pair[0])];
    byKey[fold_(pair[1])] = {
      name: pair[1], icon: from.icon, words: from.words, raw: from.raw
    };
    lines.push('RENAMED  ' + pair[0] + ' -> ' + pair[1]);
  });

  CATEGORY_SEED.forEach(function (row) {
    var name = row[0];
    var icon = row[1];
    var current = byKey[fold_(name)];

    if (!current) {
      // A new row gets the seed's own text, accents and all.
      saveCategory_({ name: name, icon: icon, words: row[2] });
      lines.push('ADDED    ' + name + '  [' + icon + ']  ' + row[2]);
      return;
    }

    // Compared folded, because that is how they are matched against a concept:
    // `panadería` on the tab and `panaderia` in the seed are the same word.
    var have = {};
    current.words.forEach(function (word) { have[word] = true; });
    // Written back as text rather than as the folded list. Writing the list would
    // hand `cafeteria, cafe` to a tab that said `cafetería, café` and reorder the
    // rest while it was at it — and this tab is a document two people read, where
    // a word without its accent looks like a mistake somebody made.
    var missing = rawWords_(row[2]).filter(function (word) { return !have[wordKey_(word)]; });
    if (!missing.length) return;

    saveCategory_({
      name: current.name,
      icon: current.icon || icon,
      words: current.raw ? current.raw + ', ' + missing.join(', ') : missing.join(', ')
    });
    lines.push('WORDS    ' + current.name + '  +' + missing.join(', '));
  });

  if (!lines.length) lines.push('Nothing to add: the tab already has every category and word.');
  lines.push('');
  lines.push('Nothing was removed. Run previewCategorise() to see what this changes.');
  return report_(lines);
}

/**
 * Fills column H for every row that has no category yet.
 *
 * The batch pass the whole category idea rests on. 2,318 rows exist and none of
 * them has one, and nobody is going to file them by hand — so a row gets its
 * category from one of two places, in this order:
 *
 *   1. **What this concept was filed as before.** If `Cena en un bar` already
 *      sits under Restaurantes somewhere, every other row saying the same thing
 *      belongs there too, whatever the words table thinks. This is what makes the
 *      pass improve as it is re-run: file ten rows by hand in the app and the
 *      next run spreads those ten decisions over every row that matches them.
 *   2. **The words on the Categorías tab.** A guess, and the only guess.
 *
 * A row that neither answers is left empty, on purpose. A wrong category is
 * printed on the row, totalled under a heading and then believed; an empty one is
 * a question still open. The report says how many are left so the number can be
 * driven down by editing `palabras` rather than by lowering the bar.
 *
 * Never touches the concept, the amounts, the balance formula or the id, and
 * never a row that already has a category — including one somebody typed by hand
 * to correct this pass. One write for the whole column: two thousand setValue
 * calls would time the execution out.
 */
function categoriseRows() {
  return categorise_(false);
}

/** What `categoriseRows` would do, without writing anything. */
function previewCategorise() {
  return categorise_(true);
}

function categorise_(dryRun) {
  var config = readConfig_();
  var categories = readCategories_();
  if (categories.missing) {
    return report_(['There is no "' + CATEGORIES_SHEET + '" tab.',
      'Run setupSpreadsheet() first — this pass files rows into the categories on it.']);
  }
  if (!categories.items.length) {
    return report_(['The ' + CATEGORIES_SHEET + ' tab is empty. Nothing to file rows into.']);
  }

  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  if (last < 2) return report_(['The ledger has no rows.']);

  var range = sheet.getRange(2, 1, last - 1, COL_LAST);
  var rows = range.getValues();
  var column = sheet.getRange(2, COL_CATEGORY, last - 1, 1);
  var formulas = column.getFormulas().filter(function (row) { return row[0]; }).length;
  if (formulas) {
    return report_(['Refusing: ' + formulas + ' cells in the category column hold formulas.',
      'Writing values over a formula is damage nobody notices for a year.']);
  }

  // What each concept has already been filed as. Read from the whole sheet
  // first, so a decision made on row 2,300 reaches row 12.
  var known = {};
  rows.forEach(function (row) {
    var already = String(row[COL_CATEGORY - 1] == null ? '' : row[COL_CATEGORY - 1]).trim();
    if (!already) return;
    var key = conceptKey_(bareConcept_(row[COL_CONCEPT - 1]));
    if (key) known[key] = already;
  });

  var values = [];
  var filled = 0;
  var byReason = { reused: 0, guessed: 0 };
  var counts = {};
  var unfiled = {};
  var unfiledRows = 0;

  rows.forEach(function (row) {
    var current = String(row[COL_CATEGORY - 1] == null ? '' : row[COL_CATEGORY - 1]).trim();
    if (current) { values.push([current]); return; }

    var concept = bareConcept_(row[COL_CONCEPT - 1]);
    if (!concept) { values.push(['']); return; }

    var key = conceptKey_(concept);
    var found = known[key] || '';
    if (found) byReason.reused++;
    else {
      found = guessCategory_(concept, categories.items);
      if (found) byReason.guessed++;
    }

    if (!found) {
      unfiledRows++;
      unfiled[concept] = (unfiled[concept] || 0) + 1;
      values.push(['']);
      return;
    }
    filled++;
    counts[found] = (counts[found] || 0) + 1;
    values.push([found]);
  });

  if (!dryRun && filled) {
    column.setValues(values);
    SpreadsheetApp.flush();
  }

  var lines = [
    (dryRun ? 'WOULD FILE' : 'FILED') + ':          ' + filled + ' of ' + (last - 1) + ' rows',
    '  from a concept already filed: ' + byReason.reused,
    '  from the words on the tab:    ' + byReason.guessed,
    'Still without a category:  ' + unfiledRows + ' rows',
    ''
  ];

  Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })
    .forEach(function (name) { lines.push('  ' + counts[name] + '  ' + name); });

  // The concepts left over, commonest first. This list is the work: every line
  // is a word to add to `palabras`, or a category that does not exist yet.
  var left = Object.keys(unfiled).sort(function (a, b) { return unfiled[b] - unfiled[a]; });
  if (left.length) {
    lines.push('');
    lines.push('Unfiled concepts, commonest first — add a word for these:');
    left.slice(0, 40).forEach(function (concept) {
      lines.push('  ' + unfiled[concept] + '  ' + concept);
    });
    if (left.length > 40) lines.push('  … and ' + (left.length - 40) + ' more');
  }
  if (dryRun) {
    lines.push('');
    lines.push('Nothing written. Run categoriseRows() to do it.');
  }
  return report_(lines);
}

/** The concept as it reads, with the voided mark taken off the front: a
 *  tombstone belongs under the same category as the thing it is a tombstone of. */
function bareConcept_(value) {
  var text = String(value == null ? '' : value).trim();
  return text.indexOf(VOID_MARK) === 0 ? text.substring(VOID_MARK.length).trim() : text;
}

function plural_(count, noun) {
  return count + ' ' + noun + (count === 1 ? '' : 's');
}

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

  var line = plural_(fixed.items.length, 'template') + ', ' + active + ' active';
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

/**
 * Concepts that look like the same concept typed twice.
 *
 * Read-only, and run by hand from the editor. It exists to answer a question
 * before anything is built on top of it, and the first run against the real
 * ledger answered it in a way no invented fixture had: 2318 rows, 720 distinct
 * concepts, and the overwhelming majority of the duplication is capitals and
 * accents — `Farmacia` and `farmacia`, `Taxi` and `taxi`, seven ways of writing
 * `nómina María`. It also proposed three groups that would have destroyed
 * information, and those are the reason the rules below look the way they do.
 *
 * Six signals, each named next to the group it produced, so a bad grouping
 * accuses its own rule rather than the whole idea:
 *
 *   accents    the same word once case and accents are gone: Súper, super
 *   plural     the same word with a Spanish -s or -es: caña, cañas
 *   stopwords  the same words with a little one dropped: traspaso a cuenta, traspaso cuenta
 *   prefix     one word grown into a longer one: super, supermercado
 *   order      the same words in another order: teatro Eva, Eva teatro
 *   typo       one word of a phrase misspelled: Corte inglés, Corte Ingés
 *
 * What the real ledger taught, and what the rules now refuse:
 *
 *   - `IBI 1`, `IBI 2`, `IBI 3` are three receipts with three different amounts,
 *     and `Matrícula conservatorio 1` and `2` are two instalments. A digit is
 *     data, never a misspelling of another digit, so two concepts whose digits
 *     differ are never one concept.
 *   - `regalo eva`, `regalo elia`, `regalo Lía`, `regalo rosa` are presents for
 *     four different people. `typo` now needs the phrase to be the same length,
 *     the difference to be in exactly one word, and that word to be five
 *     characters or more — so a name is never a typo of another name.
 *   - Those four were dragged into one group by transitivity: each linked to the
 *     next through something, and union-find made them a set. Groups are now
 *     anchored — every spelling has to match the *kept* one directly — so no
 *     membership rests on a chain nobody can see, and every line of the report
 *     carries the reason for itself.
 *
 * A false grouping costs a rewrite of somebody's history. The cheap direction to
 * be wrong in is missing one, and two of these rules were retired for being
 * wrong in the expensive direction.
 */
function conceptGroups() {
  var counted = countConcepts_();
  if (!counted.order.length) return report_(['The ledger has no concepts to read.']);

  var groups = groupConcepts_(counted.order.map(function (text) { return counted.byText[text]; }));
  var tidied = groups.reduce(function (sum, group) { return sum + group.tidies; }, 0);
  var signals = {};
  groups.forEach(function (group) {
    group.merge.forEach(function (item) {
      signals[item.why] = (signals[item.why] || 0) + item.count;
    });
  });

  var lines = [
    'Rows read:         ' + counted.rows,
    'Distinct concepts: ' + counted.order.length,
    'Groups proposed:   ' + groups.length + ' (' + tidied + ' rows would change)',
    'By signal:         ' + Object.keys(signals).sort().map(function (name) {
      return name + ' ' + signals[name];
    }).join(', '),
    ''
  ];

  // One line per group and no examples, which is what makes 84 groups fit: the
  // first run printed two rows of evidence per spelling and Apps Script cut the
  // log off half way through, which is the one thing a report must not do.
  // `conceptGroup('super')` prints the evidence for one of them.
  groups.forEach(function (group) {
    lines.push(group.keep.text + ' (' + group.keep.count + ')  <-  ' +
      group.merge.map(function (item) {
        return item.text + ' (' + item.count + ') [' + item.why + ']';
      }).join(', '));
  });

  var once = counted.order.filter(function (text) { return counted.byText[text].count === 1; });
  lines.push('');
  lines.push('Used once:         ' + once.length + ' concepts');
  return report_(lines);
}

/**
 * One group in full, with real rows under every spelling of it.
 *
 * The evidence lives here rather than in the list because of what it is for:
 * deciding whether `supermercado` was the same shop as `Supermercado` before
 * agreeing to rewrite ninety-nine rows of your own history. That is a question
 * asked about one group at a time, with the dates and the amounts in front of
 * you — not a wall of them scrolling past.
 */
function conceptGroup(wanted) {
  var counted = countConcepts_();
  var groups = groupConcepts_(counted.order.map(function (text) { return counted.byText[text]; }));
  var key = conceptKey_(String(wanted == null ? '' : wanted));

  var found = null;
  groups.forEach(function (group) {
    if (found) return;
    var names = [group.keep.text].concat(group.merge.map(function (item) { return item.text; }));
    if (names.some(function (name) { return conceptKey_(name) === key; })) found = group;
  });
  if (!found) return report_(['No group contains ' + wanted + '. Run conceptGroups() for the list.']);

  var lines = ['KEEP ' + found.keep.text + ' (' + found.keep.count + ')'];
  [found.keep].concat(found.merge).forEach(function (item) {
    lines.push('  ' + item.text + ' (' + item.count + ')' +
      (item.why ? ' [' + item.why + ']' : '') +
      (item.examples.length ? ': ' + item.examples.join('  |  ') : ''));
  });
  lines.push('');
  lines.push(found.tidies + ' rows would be rewritten as ' + found.keep.text + '.');
  return report_(lines);
}

/** Every distinct concept on the ledger, with how often and two of its rows. */
function countConcepts_() {
  var config = readConfig_();
  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  if (last < 2) return { rows: 0, order: [], byText: {} };

  // Already indexes: `readConfig_` turns the Config tab's letters into numbers,
  // and putting them through the converter a second time asks it what column
  // number 3 is.
  var first = config.people[0].column;
  var second = config.people[1].column;
  var rows = sheet.getRange(2, 1, last - 1, COL_ID).getValues();

  var order = [];
  var byText = {};
  rows.forEach(function (row) {
    var raw = String(row[COL_CONCEPT - 1] == null ? '' : row[COL_CONCEPT - 1]).trim();
    // A voided row carries its concept behind `[anulado] `. Counted under the
    // concept it is, not as a concept of its own: otherwise every voided entry
    // would arrive as its own spelling, and the report would propose merging a
    // tombstone into the thing it is a tombstone of.
    var text = raw.indexOf(VOID_MARK) === 0 ? raw.substring(VOID_MARK.length).trim() : raw;
    if (!text) return;
    if (!byText[text]) {
      byText[text] = { text: text, count: 0, examples: [] };
      order.push(text);
    }
    var seen = byText[text];
    seen.count++;
    if (seen.examples.length < 2) {
      var amount = row[first - 1] === '' ? row[second - 1] : row[first - 1];
      seen.examples.push(formatDate_(row[COL_DATE - 1]) + ' ' + euros_(amount));
    }
  });

  return { rows: last - 1, order: order, byText: byText };
}

function report_(lines) {
  var text = lines.join('\n');
  console.log(text);
  return text;
}

/**
 * The groups, anchored on the spelling that is used most.
 *
 * Every member matches the anchor *directly*, and that is the whole design. The
 * first version joined pairs with union-find, which is how `regalo eva` ended up
 * holding presents for four different people: each linked to the next through
 * something, and a set formed out of links nobody had looked at. Anchoring costs
 * a group that would have been found through a chain, and buys a report where
 * every line answers for itself.
 */
function groupConcepts_(items) {
  var sorted = items.slice().sort(function (x, y) {
    return y.count - x.count || x.text.length - y.text.length;
  });

  var anchors = [];
  sorted.forEach(function (item) {
    for (var i = 0; i < anchors.length; i++) {
      var signal = sameConcept_(anchors[i].keep.text, item.text);
      if (signal) {
        anchors[i].merge.push({
          text: item.text, count: item.count, examples: item.examples, why: signal
        });
        return;
      }
    }
    anchors.push({ keep: item, merge: [] });
  });

  return anchors
    .filter(function (group) { return group.merge.length; })
    .map(function (group) {
      group.tidies = group.merge.reduce(function (sum, item) { return sum + item.count; }, 0);
      return group;
    })
    .sort(function (x, y) { return y.tidies - x.tidies; });
}

/** Which signal says these two are one concept, or '' for none. */
function sameConcept_(one, other) {
  var a = conceptKey_(one);
  var b = conceptKey_(other);
  if (!a || !b) return '';
  if (a === b) return 'accents';

  // A digit is data. `IBI 1` and `IBI 2` are two receipts, and no rule below
  // gets to say otherwise.
  if (digitsOf_(a) !== digitsOf_(b)) return '';

  if (singular_(a) === singular_(b)) return 'plural';
  if (withoutStopWords_(a) === withoutStopWords_(b)) return 'stopwords';
  if (oneWord_(a) && oneWord_(b) && a.length >= 4 && b.length >= 4 &&
      (b.indexOf(a) === 0 || a.indexOf(b) === 0)) {
    return 'prefix';
  }
  if (sortedWords_(a) === sortedWords_(b)) return 'order';
  if (isTypo_(a, b)) return 'typo';
  return '';
}

/**
 * One word of a phrase, misspelled.
 *
 * Three conditions, each of them there because the real ledger broke the rule
 * without it: the same number of words, so `matrícula conservatorio` does not
 * absorb `matrícula conservatorio 1`; exactly one word different, so two
 * changes are two different things and not one slip; and that word at least
 * five characters with a shared two-letter start, so `eva` is not a typo of
 * `elia` and `coche` is not one of `noche`.
 */
function isTypo_(a, b) {
  var left = a.split(' ');
  var right = b.split(' ');
  if (left.length !== right.length) return false;

  var pair = null;
  for (var i = 0; i < left.length; i++) {
    if (left[i] === right[i]) continue;
    if (pair) return false;
    pair = [left[i], right[i]];
  }
  if (!pair) return false;

  var shorter = Math.min(pair[0].length, pair[1].length);
  var allowed = shorter >= 8 ? 2 : 1;
  return shorter >= 5 && pair[0].slice(0, 2) === pair[1].slice(0, 2) &&
    editDistance_(pair[0], pair[1], allowed) <= allowed;
}

/** Folded, with the punctuation and the repeated spaces gone, so that `Super.`
 *  and `super` are one word written twice. */
function conceptKey_(text) {
  return fold_(text).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function oneWord_(key) {
  return key.indexOf(' ') === -1;
}

function digitsOf_(key) {
  return key.replace(/[^0-9]/g, '');
}

/**
 * Spanish plurals, the two that matter. Nothing clever: this is a proposal for
 * somebody to confirm, not a morphology.
 *
 * The class is spelled out rather than `\w`, which is ASCII: with `\w{3,}` the
 * rule could not see past the ñ, so `cañas` never matched `caña` and the pair
 * was grouped by the prefix rule instead — the right answer with the wrong
 * reason on it, which is worse here than no answer.
 */
function singular_(key) {
  return key.replace(/([a-z0-9ñ]{3,})es\b/g, '$1').replace(/([a-z0-9ñ]{3,})s\b/g, '$1');
}

/**
 * The same words with a small one dropped: `traspaso a cuenta común` and
 * `traspaso cuenta comun`. Real, on this ledger, and not something any other
 * rule can see — the phrases are different lengths, so it is not a typo, and
 * the words are not a reordering.
 */
var STOP_WORDS = { a: 1, al: 1, de: 1, del: 1, el: 1, la: 1, las: 1, los: 1, en: 1, y: 1, con: 1 };

function withoutStopWords_(key) {
  return key.split(' ').filter(function (word) { return !STOP_WORDS[word]; }).join(' ');
}

function sortedWords_(key) {
  return key.split(' ').sort().join(' ');
}

/** Levenshtein, abandoned as soon as it is past the limit: the answer beyond
 *  that is never used, and every concept is compared with every other one. */
function editDistance_(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  var previous = [];
  for (var j = 0; j <= b.length; j++) previous[j] = j;

  for (var i = 1; i <= a.length; i++) {
    var current = [i];
    var best = i;
    for (var k = 1; k <= b.length; k++) {
      current[k] = Math.min(
        previous[k] + 1,
        current[k - 1] + 1,
        previous[k - 1] + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1)
      );
      if (current[k] < best) best = current[k];
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Rewriting one spelling of a concept as another, across the whole ledger.
 *
 * This is the half of unifying concepts that touches their data, so it is worth
 * being explicit about what it will and will not do. It rewrites column B and
 * nothing else: not the amounts, not the balance formula in column E, not the
 * observaciones, not a single row's position. It never deletes a row and never
 * inserts one. Rows are matched by the exact text of their concept, so
 * `Supermercado` and `supermercado` are two calls and not one guess.
 *
 * Three rails, each of them for a specific way this could go wrong:
 *
 *   - A voided row carries its concept behind `[anulado] `. The mark is kept and
 *     the concept inside it is rewritten, so a tidy-up does not leave the voided
 *     rows spelling it the old way — and a target that starts with the mark is
 *     refused outright, because renaming a row *into* the mark would void it
 *     without anybody saying so.
 *   - If any concept cell holds a formula, nothing is written at all. The write
 *     goes back as values, and a formula replaced by its own result is the kind
 *     of quiet damage nobody notices for a year.
 *   - Every run appends to `Renombrados`: when, from what, to what, how many
 *     rows, and who ran it. Rewriting somebody's history without leaving a note
 *     of it is not something a spreadsheet should help with.
 */
var RENAME_LOG_SHEET = 'Renombrados';
var RENAME_LOG_HEADERS = ['cuándo', 'de', 'a', 'filas', 'quién'];

/** What `renameConcept` would do, without doing any of it. */
function previewRename(from, to) {
  var config = readConfig_();
  var plan = planRename_(config, [from], to);
  if (plan.problem) return report_([plan.problem]);

  return report_([
    'Would rewrite: ' + plan.rows + ' rows',
    'From:          ' + from + (plan.voided ? ' (' + plan.voided + ' of them voided)' : ''),
    'To:            ' + to,
    plan.rows ? 'Run renameConcept("' + from + '", "' + to + '") to do it.' : 'Nothing to do.'
  ]);
}

/** Rewrites every row whose concept is exactly `from` so that it reads `to`. */
function renameConcept(from, to) {
  var config = readConfig_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var plan = planRename_(config, [from], to);
    if (plan.problem) return report_([plan.problem]);
    if (!plan.rows) return report_(['Nothing reads ' + from + '. Nothing written.']);

    applyRename_(config, plan);
    logRename_([from], to, plan.rows);
    SpreadsheetApp.flush();

    return report_([plan.rows + ' rows now read ' + to + ' (was ' + from + ').',
      'Logged in ' + RENAME_LOG_SHEET + '.']);
  } finally {
    lock.releaseLock();
  }
}

/**
 * A whole group in one pass: every spelling in `from`, rewritten as `to`.
 *
 * One read and one write for six spellings of `nómina María`, rather than six of
 * each. It is also the honest unit of the decision — a group is what somebody
 * confirms, so a group is what gets applied and what gets logged.
 */
function renameConcepts(to, from) {
  var targets = Array.isArray(from) ? from : Array.prototype.slice.call(arguments, 1);
  var config = readConfig_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var plan = planRename_(config, targets, to);
    if (plan.problem) return report_([plan.problem]);
    if (!plan.rows) return report_(['None of those spellings exist. Nothing written.']);

    applyRename_(config, plan);
    logRename_(targets, to, plan.rows);
    SpreadsheetApp.flush();

    return report_([plan.rows + ' rows now read ' + to + '.',
      'Rewritten: ' + targets.join(', '),
      'Logged in ' + RENAME_LOG_SHEET + '.']);
  } finally {
    lock.releaseLock();
  }
}

/** The rows that would change and what they would say, or a reason not to. */
function planRename_(config, targets, to) {
  var wanted = String(to == null ? '' : to).trim();
  var names = (targets || []).map(function (name) {
    return String(name == null ? '' : name).trim();
  }).filter(function (name) { return name; });

  if (!wanted) return { problem: 'A concept to rename to is required.' };
  if (!names.length) return { problem: 'A concept to rename from is required.' };
  if (wanted.indexOf(VOID_MARK) === 0) {
    return { problem: 'Refusing: "' + wanted + '" starts with ' + VOID_MARK.trim() +
      ', which would void every row it touched.' };
  }

  var sheet = ledgerSheet_(config);
  var last = lastDataRow_(sheet);
  if (last < 2) return { problem: 'The ledger has no rows.' };

  var range = sheet.getRange(2, COL_CONCEPT, last - 1, 1);
  var values = range.getValues();
  var formulas = range.getFormulas();
  var withFormula = formulas.filter(function (row) { return row[0]; }).length;
  if (withFormula) {
    return { problem: 'Refusing: ' + withFormula + ' cells in the concept column hold formulas.' +
      ' Writing values over a formula is damage nobody notices for a year.' };
  }

  var changed = 0;
  var voided = 0;
  values.forEach(function (row, index) {
    var text = String(row[0] == null ? '' : row[0]);
    var marked = text.indexOf(VOID_MARK) === 0;
    var bare = marked ? text.substring(VOID_MARK.length) : text;
    if (names.indexOf(bare.trim()) === -1) return;
    if (bare.trim() === wanted && !marked) return;
    values[index][0] = marked ? VOID_MARK + wanted : wanted;
    changed++;
    if (marked) voided++;
  });

  return { range: range, values: values, rows: changed, voided: voided, to: wanted };
}

/** One write for the column, and only when something in it changed. */
function applyRename_(config, plan) {
  plan.range.setValues(plan.values);
}

function logRename_(targets, to, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(RENAME_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(RENAME_LOG_SHEET);
    sheet.getRange(1, 1, 1, RENAME_LOG_HEADERS.length)
      .setValues([RENAME_LOG_HEADERS]).setFontWeight('bold');
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, RENAME_LOG_HEADERS.length).setValues([[
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
    targets.join(', '),
    to,
    rows,
    whoIsRunning_()
  ]]);
}

/** Best effort: an editor run knows the user, a web app run knows the token's
 *  owner, and neither is worth failing a rename over. */
function whoIsRunning_() {
  try {
    return Session.getActiveUser().getEmail() || 'unknown';
  } catch (err) {
    return 'unknown';
  }
}
