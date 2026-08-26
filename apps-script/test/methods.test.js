/**
 * Moving the payment method out of the observaciones and into column I.
 *
 * Every row on this ledger predates that column, so until the method is out of
 * the note nothing can be totalled by card — which is the whole reason the column
 * exists. The tests are about the restraint: only an exact match moves, and
 * anything that merely mentions a method is reported and left as it is.
 */

const test = require('node:test')
const assert = require('node:assert')
const { sheet, install, load, LEDGER_HEADERS, LEDGER_COLS } = require('./fake-sheets')
load()

const CONFIG = [
  ['clave', 'valor'],
  ['persona_1_nombre', 'Viqui'], ['persona_1_columna', 'C'],
  ['persona_2_nombre', 'Mario'], ['persona_2_columna', 'D'],
  ['hoja_gastos', 'gastos'],
]

const SUGGESTIONS = [
  ['texto', 'tipo', 'ámbito'],
  ['Efectivo', 'medio', ''],
  ['Tarjeta BBVA', 'medio', 'Mario'],
  ['a medias', 'observacion', ''],
]

/** rows: [note, methodAlreadyThere]. */
function world(rows, suggestions) {
  const values = [LEDGER_HEADERS]
  rows.forEach(([note, method], i) => {
    values.push([new Date(2026, 6, 1 + i), `compra ${i}`, 10 + i, '', 100,
      note || '', `id-${i}`, '', method || ''])
  })
  const sheets = {
    gastos: sheet('gastos', values, LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', suggestions || SUGGESTIONS, 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
  }
  install(sheets)
  load()
  return sheets
}

const notes = sheets => sheets.gastos.values.slice(1).map(row => row[COL_NOTE - 1])
const methods = sheets => sheets.gastos.values.slice(1).map(row => row[COL_METHOD - 1])

test('an observación that is exactly a method moves to its own column', () => {
  const sheets = world([['Efectivo'], ['Tarjeta BBVA'], ['efectivo']])
  const answer = moveMethods()

  assert.deepEqual(methods(sheets), ['Efectivo', 'Tarjeta BBVA', 'Efectivo'])
  assert.deepEqual(notes(sheets), ['', '', ''])
  // The third was lowercase on the sheet and comes out spelled as the tab spells
  // it, which is the point of having the tab.
  assert.match(answer, /MOVED:\s+3 of 3 rows/)
})

test('an observación that only mentions a method is left alone and reported', () => {
  // Splitting `Tarjeta BBVA, lo pongo yo` means deciding where the method ends
  // and the comment begins, on somebody's history, by guessing at a comma.
  const sheets = world([['Tarjeta BBVA, lo pongo yo'], ['con la tarjeta bbva de Mario']])
  const answer = moveMethods()

  assert.deepEqual(methods(sheets), ['', ''])
  assert.deepEqual(notes(sheets), ['Tarjeta BBVA, lo pongo yo', 'con la tarjeta bbva de Mario'])
  assert.match(answer, /Left alone/)
  assert.match(answer, /2 rows/)
  assert.match(answer, /1\s+Tarjeta BBVA, lo pongo yo/)
})

test('a note that is not about paying is not touched', () => {
  const sheets = world([['lo pongo yo y me lo pasas'], ['a medias'], ['']])
  moveMethods()

  assert.deepEqual(methods(sheets), ['', '', ''])
  assert.deepEqual(notes(sheets), ['lo pongo yo y me lo pasas', 'a medias', ''])
})

test('a row that already has a method keeps its note as well', () => {
  // It has been through here, or somebody filled it in from the app. Either way
  // the note beside it is not this pass's business any more.
  const sheets = world([['Efectivo', 'Tarjeta BBVA']])
  moveMethods()

  assert.deepEqual(methods(sheets), ['Tarjeta BBVA'])
  assert.deepEqual(notes(sheets), ['Efectivo'])
})

test('running it twice moves nothing the second time', () => {
  const sheets = world([['Efectivo'], ['Tarjeta BBVA'], ['lo pongo yo']])
  moveMethods()
  const settled = { notes: notes(sheets), methods: methods(sheets) }
  const writes = sheets.gastos.writes.length

  const again = moveMethods()

  assert.match(again, /MOVED:\s+0 of 3 rows/)
  assert.deepEqual(notes(sheets), settled.notes)
  assert.deepEqual(methods(sheets), settled.methods)
  assert.equal(sheets.gastos.writes.length, writes, 'the second run wrote nothing')
})

test('the two writes are each exactly as tall as the ledger', () => {
  // Two `setValues`, one per column. A block of the wrong height would shift
  // every row below it onto its neighbour's note.
  const sheets = world([['Efectivo'], ['lo pongo yo'], [''], ['Tarjeta BBVA']])
  moveMethods()

  const written = sheets.gastos.writes.filter(one => one.values.length > 1)
  assert.equal(written.length, 2)
  written.forEach(one => {
    assert.equal(one.values.length, sheets.gastos.values.length - 1)
    assert.ok(one.values.every(row => row.length === 1), 'one column wide')
  })
})

test('the preview writes nothing', () => {
  const sheets = world([['Efectivo']])
  const answer = previewMethods()

  assert.match(answer, /WOULD MOVE:\s+1 of 1 rows/)
  assert.match(answer, /Nothing written/)
  assert.deepEqual(sheets.gastos.writes, [])
})

test('with no methods on the tab it says so rather than doing nothing quietly', () => {
  const sheets = world([['Efectivo']], [['texto', 'tipo', 'ámbito'], ['a medias', 'observacion', '']])
  assert.match(moveMethods(), /No payment methods on the Sugerencias tab/)
  assert.deepEqual(sheets.gastos.writes, [])
})

test('a formula in either column stops the whole pass', () => {
  const values = [LEDGER_HEADERS,
    [new Date(2026, 6, 1), 'compra', 10, '', 100, 'Efectivo', 'id-0', '', '']]
  const sheets = {
    gastos: sheet('gastos', values, LEDGER_COLS, { '2,6': '=A2' }),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', SUGGESTIONS, 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
  }
  install(sheets)
  load()

  assert.match(moveMethods(), /Refusing: 1 cells/)
  assert.deepEqual(sheets.gastos.writes, [])
})
