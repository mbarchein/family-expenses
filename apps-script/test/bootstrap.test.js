/**
 * The answer the app is handed on every open, checked by running the real thing.
 *
 * `node --test apps-script/test/` — no framework, because Apps Script sources
 * cannot be imported and the fakes are forty lines. What this catches is the
 * class of failure that browser tests structurally cannot: they stub the API, so
 * a backend that throws, or answers a shape the app does not expect, looks green
 * all the way to somebody's phone.
 */

const test = require('node:test')
const assert = require('node:assert')
const { sheet, install, load, LEDGER_HEADERS, LEDGER_COLS, FIXED_HEADERS_ROW } = require('./fake-sheets')

const iso = date => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const CONFIG = [
  ['clave', 'valor'],
  ['persona_1_nombre', 'Viqui'],
  ['persona_1_columna', 'C'],
  ['persona_2_nombre', 'Mario'],
  ['persona_2_columna', 'D'],
  ['hoja_gastos', 'gastos'],
  ['oauth_client_id', 'x.apps.googleusercontent.com'],
]

/** A ledger like theirs: a couple of thousand rows, ending today. */
function ledgerRows(count) {
  const rows = [LEDGER_HEADERS]
  const today = new Date()
  for (let i = count; i > 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    rows.push([
      date, `compra ${i}`,
      i % 2 ? '' : 12.5, i % 2 ? 30 : '',
      100, '', `id-${i}`,
    ])
  }
  return rows
}

function world(over = {}) {
  const sheets = install({
    gastos: sheet('gastos', over.ledger || ledgerRows(900), LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', over.suggestions || [
      ['texto', 'tipo', 'ámbito'], ['Efectivo', 'medio', ''],
    ], 26),
    Fijos: sheet('Fijos', over.fixed || [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo'],
    ], 26),
  })
  load()
  return sheets
}

const USER = { email: 'mario@example.com', name: 'Mario' }

test('bootstrap answers the shape the app destructures', () => {
  world()
  const data = handleBootstrap_({}, USER)

  for (const key of ['user', 'config', 'balance', 'entries', 'frequent', 'suggestions', 'fixed', 'lastRow']) {
    assert.ok(key in data, `missing ${key}`)
  }
  assert.equal(data.config.people.length, 2)
  assert.ok(Array.isArray(data.fixed))
  assert.ok(data.entries.length > 0)
})

test('the window reaches back to the first of January of last year', () => {
  // The reason it is a date and not a row count: the totals over the list are
  // computed from what the app holds, so a count turned "this year" into "since
  // whenever row 1999 was".
  world()
  const data = handleBootstrap_({}, USER)
  const cutoff = `${new Date().getFullYear() - 1}-01-01`

  assert.ok(data.entries[0].date >= cutoff, `starts at ${data.entries[0].date}`)
  assert.ok(data.entries.length > 300, `only ${data.entries.length} rows`)
})

test('a ledger denser than the ceiling is cut to it, not to nothing', () => {
  // Dense, not long: the window is bounded by a date, so eleven years of two
  // rows a day still reaches back only to last January. The ceiling bites on
  // volume inside the window — which is worth knowing, because it means the
  // "the year starts on…" note over the list is a corner and not the norm.
  const today = new Date()
  const rows = [LEDGER_HEADERS]
  for (let day = 400; day > 0; day--) {
    for (let n = 0; n < 10; n++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day)
      rows.push([date, `compra ${day}-${n}`, 12.5, '', 100, '', `id-${day}-${n}`])
    }
  }

  world({ ledger: rows })
  assert.equal(handleBootstrap_({}, USER).entries.length, TAIL_MAX_ROWS)
})

test('an empty Fijos tab is no templates rather than an error', () => {
  // Their tab is exactly this until somebody adds a row, and a throw here would
  // take the whole bootstrap down — the app would not load at all.
  world()
  assert.deepEqual(handleBootstrap_({}, USER).fixed, [])
})

test('a Fijos tab with six columns still reads, since that is what exists today', () => {
  // `desde` and `último` arrived after the tab did. A sheet nobody has run
  // `setup` on since has six columns and has to keep working.
  world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo'],
      ['alquiler', 700, 1, 'Viqui', 'mensual', ''],
    ],
  })
  const [rent] = handleBootstrap_({}, USER).fixed

  assert.equal(rent.concept, 'alquiler')
  assert.equal(rent.amount, 700)
  assert.equal(rent.payer, 0)
  assert.equal(rent.months, 1)
  assert.equal(rent.active, true)
  assert.equal(rent.last, '')
})

test('último written as text is read back, not silently lost', () => {
  // The bug this pins down: the app writes that cell as text on purpose, so that
  // Sheets cannot reformat a value it compares as a string. Read with an
  // `instanceof Date` test it came back empty — and an empty `último` means
  // "never settled", so every recurring expense would be proposed again for
  // ever, one row per month.
  world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', '2026-08-01'],
    ],
  })
  assert.equal(handleBootstrap_({}, USER).fixed[0].last, '2026-08-01')
})

test('a row with a periodicidad nobody recognises is reported, not dropped in silence', () => {
  world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo'],
      ['alquiler', 700, 1, '', 'cada dos lunes', ''],
    ],
  })
  const { items, problems } = readFixed_()
  assert.equal(items.length, 0)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /periodicidad/)
})

test('an empty importe stays empty rather than becoming zero', () => {
  // "Ask me every time" and "always zero euros" are different templates.
  world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo'],
      ['luz', '', 20, '', 'bimestral', ''],
    ],
  })
  const [light] = handleBootstrap_({}, USER).fixed
  assert.equal(light.amount, null)
  assert.equal(light.payer, null)
  assert.equal(light.months, 2)
})

test('saving a template writes seven columns and leaves último alone', () => {
  const sheets = world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', '2026-07-01'],
    ],
  })

  saveFixed_({ row: 2, concept: 'alquiler', amount: 725, day: 1, payer: 0, months: 1, active: true, from: '' })

  const [write] = sheets.Fijos.writes
  assert.equal(write.values[0].length, 7, 'wrote over último')
  assert.equal(sheets.Fijos.values[1][7], '2026-07-01', 'último changed')
  assert.equal(sheets.Fijos.values[1][1], 725)
})

test('a template with no row is appended rather than overwriting row two', () => {
  const sheets = world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', ''],
    ],
  })

  saveFixed_({ row: 0, concept: 'gimnasio', amount: 39, day: 5, payer: 1, months: 1, active: true, from: '' })

  assert.equal(sheets.Fijos.values[1][0], 'alquiler', 'the rent was overwritten')
  assert.equal(sheets.Fijos.values[2][0], 'gimnasio')
})

/**
 * A template is its id, not its row.
 *
 * The tab is edited by hand in Google Sheets, so a row deleted or inserted above
 * one moves every row below it — and a phone holding a list from a minute earlier
 * would save a template over its neighbour, or mark the wrong one as dealt with.
 * These are the two writes where that is expensive, since `último` is what stops
 * a bill being proposed twice.
 */
test('a template is written by id, whatever row it has moved to', () => {
  const sheets = world({
    fixed: [
      FIXED_HEADERS_ROW,
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', '', '', 'id-alquiler'],
      ['gimnasio', 40, 5, 'Mario', 'mensual', 'sí', '', '', '', 'id-gimnasio'],
    ],
  })

  // Somebody deletes the rent by hand. The gym is on row 2 now, and the phone
  // still believes it is on row 3.
  sheets.Fijos.deleteRow(2)
  assert.equal(sheets.Fijos.values[1][0], 'gimnasio')

  const answer = saveFixed_({
    id: 'id-gimnasio', row: 3, concept: 'gimnasio', amount: 45, day: 5, payer: 1,
    months: 1, active: true,
  })

  assert.equal(answer.row, 2)
  assert.equal(sheets.Fijos.values[1][1], 45)
  // And nothing was appended below: the row was found, not created.
  assert.equal(sheets.Fijos.values.length, 2)
})

test('a period is marked done by id, whatever row it has moved to', () => {
  const sheets = world({
    fixed: [
      FIXED_HEADERS_ROW,
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', '', '', 'id-alquiler'],
      ['gimnasio', 40, 5, 'Mario', 'mensual', 'sí', '', '', '', 'id-gimnasio'],
    ],
  })
  sheets.Fijos.deleteRow(2)

  setFixedDone_({ id: 'id-gimnasio', row: 3, due: '2026-08-05' })

  // On the gym, which is what the id names — and not into the empty space below
  // the tab, which is where row 3 now points.
  assert.equal(sheets.Fijos.values[1][FIXED_COL_LAST - 1], '2026-08-05')
  assert.equal(sheets.Fijos.values.length, 2)
})

test('replaying a save writes the same row rather than a second rent', () => {
  // The queue is on disk and replays what it holds. Keyed by id, a save that was
  // sent twice is the same row twice.
  const sheets = world({
    fixed: [FIXED_HEADERS_ROW, ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', '', '', 'id-1']],
  })
  const template = {
    id: 'id-1', concept: 'alquiler', amount: 720, day: 1, payer: 0, months: 1, active: true,
  }

  saveFixed_(template)
  saveFixed_(template)

  assert.equal(sheets.Fijos.values.length, 2)
  assert.equal(sheets.Fijos.values[1][1], 720)
})

test('a template with no id is found by row, and stamped on the way past', () => {
  // For a row added by hand after the migration: addressable, and stable from the
  // first write onwards rather than for ever by row.
  const sheets = world({
    fixed: [FIXED_HEADERS_ROW, ['piscina', 30, 8, '', 'mensual', 'sí', '', '', '', '']],
  })

  saveFixed_({
    id: 'id-piscina', row: 2, concept: 'piscina', amount: 35, day: 8, payer: null,
    months: 1, active: true,
  })

  assert.equal(sheets.Fijos.values[1][1], 35)
  assert.equal(sheets.Fijos.values[1][FIXED_COL_ID - 1], 'id-piscina')
})

test('the migration gives every template an id and can be run twice', () => {
  const sheets = world({
    fixed: [
      FIXED_HEADERS_ROW,
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', '', '', ''],
      ['gimnasio', 40, 5, 'Mario', 'mensual', 'sí', '', '', '', 'ya-tenia'],
      // No concepto: not a template, and inventing a row here would be inventing
      // one nobody meant.
      ['', '', '', '', '', '', '', '', '', ''],
    ],
  })

  const first = stampFixedIds_(sheets.Fijos)
  const ids = sheets.Fijos.values.slice(1).map(row => row[FIXED_COL_ID - 1])

  assert.match(first, /1 template\(s\) given an id/)
  assert.ok(ids[0], 'the rent has an id now')
  assert.equal(ids[1], 'ya-tenia')
  assert.equal(ids[2], '')

  // Twice: the one it wrote is left exactly as it was.
  const again = stampFixedIds_(sheets.Fijos)
  assert.match(again, /every template already had an id/)
  assert.equal(sheets.Fijos.values[1][FIXED_COL_ID - 1], ids[0])
})

test('marking a period done refuses a row and a date that are not one', () => {
  world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', ''],
    ],
  })

  // Both refusals, in the order they are checked — a template that cannot be
  // found is the one that would otherwise write `último` into empty space below
  // the tab. The message names both ways it looked, because "fila 9 no existe" is
  // no help when the app sent an id.
  assert.throws(() => setFixedDone_({ row: 9, due: '2026-08-01' }), /No hay ningún fijo/)
  assert.throws(() => setFixedDone_({ id: 'nope', due: '2026-08-01' }), /No hay ningún fijo/)
  assert.throws(() => setFixedDone_({ row: 2, due: 'agosto' }), /inválida/)

  assert.deepEqual(setFixedDone_({ row: 2, due: '2026-08-01' }), { row: 2, last: '2026-08-01' })
})

/**
 * The health GET, which exists to be opened in a browser tab when the app says
 * `Failed to fetch` and nobody can tell whether the deployment is alive.
 */
test('doGet answers without a token, and carries no ledger with it', () => {
  world()
  const answer = JSON.parse(doGet().getContent())

  assert.equal(answer.service, 'a-medias')
  assert.equal(answer.status, 'ok')
  // Deliberately nothing else. Anything it looked up could fail on its own and
  // muddy the single bit of information it exists to carry, and a public
  // endpoint is not a place to put a household's expenses.
  const carried = JSON.stringify(answer)
  for (const leak of ['compra', 'Viqui', 'Mario', 'id-', 'diferencia']) {
    assert.ok(!carried.includes(leak), `doGet leaked ${leak}`)
  }
})

test('the health answer cannot be mistaken for an action succeeding', () => {
  // A GET arrives here without anybody asking for one: an Apps Script POST is a
  // 302, fetch follows a 302 as a GET, and the app's POST lands on doGet. While
  // this answered `{ ok: true, data: {...} }` the app could not tell that from a
  // bootstrap — it cached `{ service, status }` as the ledger, and every reload
  // painted from the cache and crashed before reaching the network again.
  world()
  const answer = JSON.parse(doGet().getContent())

  assert.equal(answer.ok, false, 'the app reads ok:true as "this is your data"');
  assert.equal(answer.data, undefined, 'nothing may sit where the ledger sits')
  assert.equal(answer.error.code, 'GET')
})

test('an unknown action is refused before anything is read', () => {
  // What the app's reachability probe sends. It must not append, not read the
  // ledger, and not need a credential to be told no.
  world()
  const answer = JSON.parse(doPost({ postData: { contents: '{"action":"ping"}' } }).getContent())

  assert.equal(answer.ok, false)
  assert.equal(answer.error.code, 'UNKNOWN_ACTION')
})

/**
 * sanityCheck: the one function anybody runs when something looks wrong.
 *
 * It said nothing whatsoever about the Fijos tab, while the advice being given
 * was to run it *to fix* that tab — which `setupSpreadsheet` does, not this. A
 * report that is silent about the newest thing in the model is a report that
 * hides exactly what is most likely to be broken.
 */
test('sanityCheck reports the Fijos tab, its templates and how many are active', () => {
  world({ fixed: [
    ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
    ['alquiler', 700, 1, 'Viqui', 'mensual', 'si', '', '2026-08-01'],
    ['luz', '', 15, '', 'bimestral', 'si', '', ''],
    ['gimnasio', 30, 5, 'Mario', 'mensual', 'no', '', ''],
  ] })

  const report = sanityCheck()
  assert.match(report, /Fijos:\s+3 templates, 2 active/)
  // "1 templates" would read as a report written by nobody.
  assert.ok(!/\b1 \w+s\b/.test(report), 'nothing plural should be counted as one')
  assert.ok(!report.includes('MISSING'), 'the headers are there; nothing to warn about')
})

test('sanityCheck names the missing headers, and the function that writes them', () => {
  // The state their spreadsheet was actually in: the tab exists, from before
  // `desde` and `último` did. It still reads — the columns are read by position
  // — so nothing looks wrong until every period is proposed again for ever.
  world({ fixed: [
    ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo'],
    ['alquiler', 700, 1, 'Viqui', 'mensual', 'si'],
  ] })

  const report = sanityCheck()
  assert.match(report, /MISSING the `desde` and `último` headers; run setupSpreadsheet/)
})

test('sanityCheck repeats the rows the app is ignoring, rather than dropping them', () => {
  world({ fixed: [
    ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
    ['alquiler', 700, 1, 'Viqui', 'cada dos jueves', '', '', ''],
  ] })

  const report = sanityCheck()
  assert.match(report,
    /Fijos rows the app is ignoring: alquiler: periodicidad «cada dos jueves» is not a cadence/)
  assert.match(report, /0 templates, 0 active/)
})

test('sanityCheck says nothing about backfillIds when every row has an id', () => {
  world()
  assert.match(sanityCheck(), /Rows without id:\s+0$/m)
})

test('sanityCheck prints the balance in euros as well as raw', () => {
  // Their own report read `-152.0600000002887`, which is the spreadsheet's
  // floating point and not something this app did to their money. Both, so that
  // the number they argue about is the one the app shows.
  const sheets = world()
  sheets.gastos.values[sheets.gastos.values.length - 1][4] = -152.0600000002887

  const report = sanityCheck()
  assert.match(report, /Balance read:\s+-152\.06\s+\(raw: -152\.0600000002887\)/)
})

test('the accounts allowed to use the app are listed once each', () => {
  // The owner is also an editor, so the owner arrived twice — and this list is
  // printed as who may use the app.
  world()
  install({}, { editors: ['viqui@example.com', 'mario@example.com'], owner: 'mario@example.com' })
  const emails = allowedEmails_()

  assert.deepEqual(emails, ['viqui@example.com', 'mario@example.com'])
})

test('a concept from years before the window is still searchable', () => {
  // The limit that made the first fix insufficient: the vocabulary was built
  // from the window the app is sent, which reaches back to 1 January of last
  // year at the most. On a ledger that starts in 2022, a concept last used in
  // 2023 could not be found by typing it — and nothing in the app could say so,
  // because the search box worked, it simply had nothing to search.
  const rows = [LEDGER_HEADERS]
  rows.push([new Date(2022, 4, 12), 'Museo del Prado', 18, '', 100, '', 'old-1'])
  rows.push([new Date(2023, 8, 3), 'peluqueria', 12, '', 100, '', 'old-2'])
  // Four hundred recent rows, so the window really does leave 2022 behind: with
  // a handful of rows it would cover the whole sheet and prove nothing.
  const today = new Date()
  for (let i = 0; i < 400; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i % 300))
    rows.push([date, `reciente ${i % 40}`, 10, '', 100, '', `new-${i}`])
  }
  world({ ledger: rows })

  const data = handleBootstrap_({}, USER)
  const concepts = data.frequent.map(item => item.concept)

  assert.ok(concepts.includes('Museo del Prado'), 'a 2022 concept was not sent')
  assert.ok(concepts.includes('peluqueria'), 'a 2023 concept was not sent')

  // And the window is unchanged, which is the other half: the *list* is still
  // the recent slice, because that is what the screen shows. The vocabulary is
  // no longer tied to it.
  const sent = data.entries.map(entry => entry.concept)
  assert.ok(!sent.includes('Museo del Prado'),
    'the entry window grew to the whole sheet, which was not the point')
})

test('a voided row is not offered back as a concept', () => {
  const rows = [LEDGER_HEADERS]
  rows.push([new Date(2026, 0, 5), '[anulado] museo', '', '', 100, '', 'v-1'])
  rows.push([new Date(2026, 0, 6), 'pan', 2, '', 100, '', 'v-2'])
  world({ ledger: rows })

  const concepts = handleBootstrap_({}, USER).frequent.map(item => item.concept)
  assert.deepEqual(concepts, ['pan'])
})

test('the vocabulary sent is much longer than the eight tiles shown', () => {
  // The bug this fixes: the app filters this list as somebody types and *then*
  // cuts it to eight, so whatever is not sent cannot be found by typing it. With
  // eight sent, the search box could reorder the tiles already on screen and
  // nothing else — a `Museo` apuntado once was unreachable the next day.
  const rows = [LEDGER_HEADERS]
  const today = new Date()
  for (let i = 0; i < 40; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    rows.push([date, `concepto ${i}`, 10 + i, '', 100, '', `id-${i}`])
  }
  rows.push([today, 'Museo', 12, '', 100, '', 'id-museo'])
  world({ ledger: rows })

  const concepts = handleBootstrap_({}, USER).frequent.map(item => item.concept)

  assert.ok(concepts.length > 8, `only ${concepts.length} concepts were sent`)
  assert.ok(concepts.includes('Museo'), 'a concept used once was not sent at all')
})

test('the vocabulary is ordered by how recently it was used', () => {
  // Which is what makes the first eight the right eight before anybody types.
  const rows = [LEDGER_HEADERS]
  const today = new Date()
  const old = new Date(today.getFullYear() - 1, 0, 15)
  for (let i = 0; i < 3; i++) rows.push([old, 'lo de siempre', 10, '', 100, '', `old-${i}`])
  rows.push([today, 'lo de hoy', 10, '', 100, '', 'new-1'])
  world({ ledger: rows })

  const concepts = handleBootstrap_({}, USER).frequent.map(item => item.concept)
  assert.equal(concepts[0], 'lo de hoy')
})

/**
 * The two columns appended after the fact: `categoría` in H and `forma de pago`
 * in I.
 *
 * At the end and not where they would read best, because inserting a column into
 * a ledger with years in it shifts every letter after it — the two person columns
 * named in Config, the balance formula in E, the id column. Appending shifts
 * nothing, and these tests are about the part that is easy to get wrong instead:
 * a row is now nine cells wide everywhere it is read, written or copied.
 */

test('a row carries its category and its payment method', () => {
  const rows = [LEDGER_HEADERS]
  rows.push([new Date(2026, 7, 20), 'Cena en un bar', 40, '', 100, 'con Ana', 'id-1',
    'Restaurantes', 'Tarjeta'])
  world({ ledger: rows })

  const answer = handleBootstrap_({}, { email: 'mario@example.com' })
  const entry = answer.entries[0]

  // The concept stays what was typed and the category is the bucket it belongs
  // to. That separation is the whole point of the column.
  assert.equal(entry.concept, 'Cena en un bar')
  assert.equal(entry.category, 'Restaurantes')
  assert.equal(entry.method, 'Tarjeta')
  assert.equal(entry.note, 'con Ana')
})

test('rows from before the two columns read as empty, not as undefined', () => {
  // Every one of the 2,318 existing rows is this case, and `undefined` reaching
  // the app is a category that renders as the word undefined.
  const rows = [LEDGER_HEADERS]
  rows.push([new Date(2026, 7, 20), 'pan', 1.4, '', 100, '', 'id-1'])
  world({ ledger: rows })

  const entry = handleBootstrap_({}, { email: 'mario@example.com' }).entries[0]
  assert.equal(entry.category, '')
  assert.equal(entry.method, '')
})

test('an append writes both new cells', () => {
  const sheets = world({ ledger: [LEDGER_HEADERS, [new Date(2026, 7, 1), 'pan', 1, '', 100, '', 'id-0']] })

  const written = appendEntry_(readConfig_(), {
    id: 'new-1', date: '2026-08-26', concept: 'Cena en un bar', amount: 40, payer: 1,
    note: '', category: 'Restaurantes', method: 'Tarjeta',
  }, { email: 'mario@example.com' })

  assert.equal(written.category, 'Restaurantes')
  assert.equal(written.method, 'Tarjeta')
  const row = sheets.gastos.values[2]
  assert.equal(row[COL_CATEGORY - 1], 'Restaurantes')
  assert.equal(row[COL_METHOD - 1], 'Tarjeta')
})

test('an edit that says nothing about the category leaves it alone', () => {
  // A phone running a version of the app that has never heard of these columns
  // sends no category at all. That has to mean "leave it as it is" and not
  // "empty it", or one old handset would undo the whole batch pass.
  const sheets = world({
    ledger: [LEDGER_HEADERS,
      [new Date(2026, 7, 1), 'Cena', 40, '', 100, '', 'id-1', 'Restaurantes', 'Tarjeta']],
  })

  updateEntry_(readConfig_(), {
    id: 'id-1', date: '2026-08-01', concept: 'Cena en un bar', amount: 42, payer: 0, note: '',
  }, { email: 'mario@example.com' })

  const row = sheets.gastos.values[1]
  assert.equal(row[COL_CATEGORY - 1], 'Restaurantes')
  assert.equal(row[COL_METHOD - 1], 'Tarjeta')
  assert.equal(row[COL_CONCEPT - 1], 'Cena en un bar')
})

test('an edit that empties the category empties it', () => {
  const sheets = world({
    ledger: [LEDGER_HEADERS,
      [new Date(2026, 7, 1), 'Cena', 40, '', 100, '', 'id-1', 'Restaurantes', 'Tarjeta']],
  })

  updateEntry_(readConfig_(), {
    id: 'id-1', date: '2026-08-01', concept: 'Cena', amount: 40, payer: 0, note: '',
    category: '', method: '',
  }, { email: 'mario@example.com' })

  const row = sheets.gastos.values[1]
  assert.equal(row[COL_CATEGORY - 1], '')
  assert.equal(row[COL_METHOD - 1], '')
})
