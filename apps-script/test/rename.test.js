/**
 * Rewriting a concept across the ledger.
 *
 * This is the only function in the backend that edits history, so the tests are
 * mostly about restraint: which rows it leaves alone, which columns it never
 * reaches, and the two ways a rename could quietly destroy something — a
 * formula overwritten with its own result, and a row voided by being renamed
 * into the mark that means voided.
 */

const test = require('node:test')
const assert = require('node:assert')
const { sheet, install, load, LEDGER_HEADERS, LEDGER_COLS, FIXED_HEADERS_ROW } = require('./fake-sheets')

const CONFIG = [
  ['clave', 'valor'],
  ['persona_1_nombre', 'Viqui'],
  ['persona_1_columna', 'C'],
  ['persona_2_nombre', 'Mario'],
  ['persona_2_columna', 'D'],
  ['hoja_gastos', 'gastos'],
]

const HEADERS = LEDGER_HEADERS

/** A ledger from `[concepto, importe]` pairs, one row each. */
function world(entries, formulas) {
  const rows = [HEADERS]
  entries.forEach(([concept, amount], index) => {
    rows.push([new Date(2026, 6, 1 + index), concept, amount, '', 100, 'efectivo', `id-${index}`])
  })
  const sheets = {
    gastos: sheet('gastos', rows, LEDGER_COLS, formulas),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [FIXED_HEADERS_ROW], 26),
  }
  install(sheets)
  load()
  return sheets
}

/** The concept column as it stands, row 2 down. */
function concepts(sheets) {
  return sheets.gastos.values.slice(1).map(row => row[1])
}

test('every row with that spelling is rewritten, and only those', () => {
  const sheets = world([['super', 10], ['Supermercado', 20], ['super', 30], ['pan', 5]])

  const answer = renameConcept('super', 'Supermercado')

  assert.match(answer, /2 rows now read Supermercado \(was super\)/)
  assert.deepEqual(concepts(sheets), ['Supermercado', 'Supermercado', 'Supermercado', 'pan'])
})

test('a whole group goes in one pass', () => {
  const sheets = world([
    ['nomina María', 1], ['nomina maria', 2], ['nómina Maria', 3], ['Nómina María', 4], ['pan', 5],
  ])

  const answer = renameConcepts('nómina María', ['nomina María', 'nomina maria', 'nómina Maria'])

  assert.match(answer, /3 rows now read nómina María/)
  assert.deepEqual(concepts(sheets),
    ['nómina María', 'nómina María', 'nómina María', 'Nómina María', 'pan'])
})

test('nothing outside the concept column is touched', () => {
  // The amounts, the balance formula in column E, the observaciones and the ids
  // are not this function's business, and the way to be sure is to look at what
  // it asked to write rather than at what came out.
  const sheets = world([['super', 10], ['super', 20]])

  renameConcept('super', 'Supermercado')

  const ledgerWrites = sheets.gastos.writes
  assert.equal(ledgerWrites.length, 1, 'one write for the column, not one per row')
  assert.equal(ledgerWrites[0].column, 2, 'column B, the concept')
  assert.equal(ledgerWrites[0].row, 2, 'from the first data row')
  assert.ok(ledgerWrites[0].values.every(row => row.length === 1), 'one column wide')
})

test('a voided row keeps its mark and loses the old spelling', () => {
  // Voiding prefixes the concept with `[anulado] `. Matching on the bare text
  // is what stops a tidy-up leaving the voided rows spelling it the old way.
  const sheets = world([['super', 10], ['[anulado] super', ''], ['pan', 5]])

  const answer = renameConcept('super', 'Supermercado')

  assert.match(answer, /2 rows now read Supermercado/)
  assert.deepEqual(concepts(sheets), ['Supermercado', '[anulado] Supermercado', 'pan'])
})

test('renaming into the void mark is refused', () => {
  // It would void every row it touched, silently, by writing the string that
  // means voided into a column that means concept.
  const sheets = world([['super', 10]])

  const answer = renameConcept('super', '[anulado] super')

  assert.match(answer, /Refusing/)
  assert.match(answer, /would void every row/)
  assert.deepEqual(concepts(sheets), ['super'])
  assert.deepEqual(sheets.gastos.writes, [])
})

test('a formula in the concept column stops the whole rename', () => {
  // The write goes back as values. A formula replaced by its own result is
  // damage nobody notices for a year, so one of them is enough to refuse.
  const sheets = world([['super', 10], ['super', 20]], { '3,2': '=A3&" super"' })

  const answer = renameConcept('super', 'Supermercado')

  assert.match(answer, /Refusing: 1 cells in the concept column hold formulas/)
  assert.deepEqual(concepts(sheets), ['super', 'super'])
  assert.deepEqual(sheets.gastos.writes, [])
})

test('a spelling nobody uses writes nothing', () => {
  const sheets = world([['super', 10]])

  assert.match(renameConcept('gasolina', 'Gasolina'), /Nothing reads gasolina/)
  assert.deepEqual(sheets.gastos.writes, [])
})

test('running it twice is running it once', () => {
  const sheets = world([['super', 10], ['super', 20]])

  renameConcept('super', 'Supermercado')
  const again = renameConcept('super', 'Supermercado')

  assert.match(again, /Nothing reads super/)
  assert.deepEqual(concepts(sheets), ['Supermercado', 'Supermercado'])
})

test('the run is written down: when, from, to, how many, and who', () => {
  // Rewriting somebody's history without leaving a note of it is not something
  // a spreadsheet should help with.
  const sheets = world([['super', 10], ['Súper', 20]])

  renameConcepts('Supermercado', ['super', 'Súper'])

  const log = sheets.Renombrados
  assert.ok(log, 'the Renombrados tab was created')
  assert.deepEqual(log.values[0], ['cuándo', 'de', 'a', 'filas', 'quién'])

  const row = log.values[1]
  assert.match(String(row[0]), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.equal(row[1], 'super, Súper')
  assert.equal(row[2], 'Supermercado')
  assert.equal(row[3], 2)
  assert.equal(row[4], 'mario@example.com')
})

test('the preview says what would happen and changes nothing', () => {
  const sheets = world([['super', 10], ['super', 20], ['[anulado] super', ''], ['pan', 5]])

  const answer = previewRename('super', 'Supermercado')

  assert.match(answer, /Would rewrite: 3 rows/)
  assert.match(answer, /1 of them voided/)
  assert.match(answer, /Run renameConcept\("super", "Supermercado"\)/)
  assert.deepEqual(sheets.gastos.writes, [])
})

test('an empty name is refused rather than guessed at', () => {
  const sheets = world([['super', 10]])

  assert.match(renameConcept('super', '   '), /A concept to rename to is required/)
  assert.match(renameConcept('', 'Supermercado'), /A concept to rename from is required/)
  assert.deepEqual(sheets.gastos.writes, [])
})
