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
const { sheet, install, load } = require('./fake-sheets')

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
  const rows = [['Fecha', 'Concepto', 'Viqui', 'Mario', 'diferencia', 'observaciones', 'id']]
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
    gastos: sheet('gastos', over.ledger || ledgerRows(900), 7),
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
  const rows = [['Fecha', 'Concepto', 'Viqui', 'Mario', 'diferencia', 'observaciones', 'id']]
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

test('marking a period done refuses a row and a date that are not one', () => {
  world({
    fixed: [
      ['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último'],
      ['alquiler', 700, 1, 'Viqui', 'mensual', 'sí', '', ''],
    ],
  })

  // Both refusals, in the order they are checked — a row that does not exist is
  // the one that would otherwise write `último` into empty space below the tab.
  assert.throws(() => setFixedDone_({ row: 9, due: '2026-08-01' }), /no existe/)
  assert.throws(() => setFixedDone_({ row: 2, due: 'agosto' }), /inválida/)

  assert.deepEqual(setFixedDone_({ row: 2, due: '2026-08-01' }), { row: 2, last: '2026-08-01' })
})
