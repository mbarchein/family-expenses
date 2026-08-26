/**
 * The concept-grouping report, checked against the mistakes it must not make.
 *
 * A grouping this proposes ends up rewriting somebody's history, so the tests
 * that matter most are the ones about what it refuses: two real concepts one
 * letter apart, a short word swallowed by a longer one, a spelling that is
 * simply rare. Being wrong by missing a group costs a second look; being wrong
 * by proposing one costs the ledger.
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

/** A ledger of nothing but concepts: `[concepto, veces]`. */
function ledgerOf(pairs) {
  const rows = [LEDGER_HEADERS]
  let n = 0
  for (const [concept, times] of pairs) {
    for (let i = 0; i < times; i++) {
      n++
      rows.push([new Date(2026, 6, 1 + (n % 27)), concept, 10 + n, '', 0, '', `id-${n}`])
    }
  }
  return rows
}

function world(pairs) {
  install({
    gastos: sheet('gastos', ledgerOf(pairs), LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [FIXED_HEADERS_ROW], 26),
  })
  load()
}

test('super and supermercado are one group, and the common one is kept', () => {
  world([['super', 112], ['supermercado', 37]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+1 \(37 rows would change\)/)
  assert.match(report, /super \(112\) {2}<- {2}supermercado \(37\) \[prefix\]/)
})

test('the case and the accents alone are a group', () => {
  world([['super', 9], ['Súper', 4], ['SUPER.', 2]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+1 \(6 rows would change\)/)
  assert.match(report, /\[accents\]/)
})

test('a plural and a word order are named as what they are', () => {
  world([['caña', 8], ['cañas', 3], ['compra super', 5], ['super compra', 2]])
  const report = conceptGroups()

  assert.match(report, /\[plural\]/)
  assert.match(report, /\[order\]/)
})

test('a typo joins the word it is a typo of', () => {
  world([['gasolina', 20], ['gasolna', 2]])
  assert.match(conceptGroups(), /gasolina \(20\) {2}<- {2}gasolna \(2\) \[typo\]/)
})

test('two real words one letter apart are left alone', () => {
  // `coche` and `noche` are one edit apart and both are real. This is the
  // false positive the two-letter shared start exists to refuse, and the reason
  // a bare edit distance was not enough.
  world([['coche', 30], ['noche', 12], ['casa', 9], ['caza', 4]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+0 \(0 rows would change\)/)
})

test('a short word is not swallowed by a longer one that contains it', () => {
  // The electricity and the garage's electricity are two rows on this ledger,
  // and `luz` starting `luz garaje` is not evidence that they are one.
  world([['luz', 24], ['luz garaje', 6]])
  assert.match(conceptGroups(), /Groups proposed:\s+0 /)
})

test('three spellings land in one group, anchored on the most used', () => {
  world([['super', 40], ['supermercado', 12], ['Supermercado', 5]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+1 \(17 rows would change\)/)
  assert.match(report, /^super \(40\) {2}<- {2}supermercado \(12\) \[prefix\], Supermercado \(5\)/m)
})

test('one group prints real rows, so it can be recognised before it is merged', () => {
  // Somebody has to be able to tell whether `supermercado` was the same shop
  // before agreeing to rewrite ninety-nine rows of their own history. The list
  // does not carry the evidence — printing two rows per spelling is what made
  // Apps Script truncate the first real run — so it lives here, one group at a
  // time, which is how the question is actually asked.
  world([['super', 3], ['supermercado', 2]])
  const detail = conceptGroup('supermercado')

  assert.match(detail, /KEEP super \(3\)/)
  assert.match(detail, /super \(3\): 2026-07-\d\d \d+\.\d\d/)
  assert.match(detail, /supermercado \(2\) \[prefix\]: 2026-07-\d\d/)
  assert.match(detail, /2 rows would be rewritten as super\./)
})

test('a group nobody asked about says so rather than answering', () => {
  world([['super', 3], ['supermercado', 2]])
  assert.match(conceptGroup('gasolina'), /No group contains gasolina/)
})

test('it counts what it read and what it could not group', () => {
  world([['super', 2], ['una vez', 1], ['otra', 1]])
  const report = conceptGroups()

  assert.match(report, /Rows read:\s+4/)
  assert.match(report, /Distinct concepts: 3/)
  assert.match(report, /Used once:\s+2 concepts/)
})

test('it writes nothing at all', () => {
  // Read-only is the promise this function is run on: it is pointed at a real
  // household ledger by somebody who has been told it only looks.
  const sheets = {
    gastos: sheet('gastos', ledgerOf([['super', 3], ['supermercado', 2]]), LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [FIXED_HEADERS_ROW], 26),
  }
  install(sheets)
  load()

  conceptGroups()

  for (const name of Object.keys(sheets)) {
    assert.deepEqual(sheets[name].writes, [], `${name} was written to`)
  }
})

test('a phrase is not merged into the word it starts with', () => {
  // What the first demo run proposed and should not have: `cena fuera` into
  // `cena`, `compra super` into `super`. Those are not two spellings of one
  // thing, they are two things written differently — and merging them does not
  // tidy the ledger, it loses what it said.
  world([['cena', 22], ['cena fuera', 7], ['super', 40], ['compra super', 5]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+0 /)
})

test('the same words in another order are still one concept', () => {
  // The other half of that: a reordering is a spelling variant, so it stays.
  world([['compra super', 5], ['super compra', 2]])
  assert.match(conceptGroups(), /compra super \(5\) {2}<- {2}super compra \(2\) \[order\]/)
})

/**
 * The three groupings the real ledger produced that would have destroyed
 * information. Every one of these is a spelling that exists on their sheet.
 */

test('presents for different people are not one present', () => {
  // What the first real run proposed: regalo eva, regalo elia, Regalo Lía,
  // regalo rosa, regalo Lisa, regalo lina and regalo yian in one group, to be
  // rewritten as `regalo eva`. Four of those are children with names.
  world([
    ['regalo eva', 7], ['Regalo Eva', 2], ['Regalo Lía', 1], ['regalo elia', 1],
    ['regalo rosa', 1], ['regalo Lisa', 1], ['regalo lina', 1], ['regalo yian', 1],
  ])
  const report = conceptGroups()

  // Only the one that really is the same: case and accents.
  assert.match(report, /regalo eva \(7\) {2}<- {2}Regalo Eva \(2\) \[accents\]$/m)
  for (const name of ['Lía', 'elia', 'rosa', 'Lisa', 'lina', 'yian']) {
    assert.ok(!report.includes(name), `${name} was pulled into another concept`)
  }
})

test('numbered receipts are different receipts', () => {
  // IBI 1 to 4 are four bills with four amounts; the conservatorio ones are two
  // instalments. A digit is data, never a misspelling of another digit.
  world([
    ['IBI 1', 1], ['IBI 2', 1], ['IBI 3', 1], ['IBI 4', 1],
    ['matrícula conservatorio', 2], ['Matrícula conservatorio 1', 1],
    ['Matrícula conservatorio 2', 1],
  ])
  assert.match(conceptGroups(), /Groups proposed:\s+0 /)
})

test('nothing is grouped through a chain', () => {
  // `ropa eva` and `ropa deca` are not the same, and neither is reachable from
  // the other except through links nobody looked at.
  world([['ropa eva', 3], ['Ropa Eva', 1], ['ropa deca', 1]])
  const report = conceptGroups()

  assert.match(report, /ropa eva \(3\) {2}<- {2}Ropa Eva \(1\) \[accents\]$/m)
  assert.ok(!report.includes('deca'), 'ropa deca was pulled in')
})

/** And the groupings from that same run that have to survive. */

test('the real duplicates are still found', () => {
  world([
    ['nomina María', 11], ['nomina maria', 5], ['nómina Maria', 1], ['Nómina María', 1],
    ['Corte inglés', 2], ['Corte Ingés', 1],
    ['carniceria', 5], ['carniuceria', 1],
    ['restaurante', 3], ['restauran', 2],
    ['Teatro Eva', 13], ['Eva teatro', 1],
    ['traspaso a cuenta común', 3], ['traspaso cuenta comun', 2],
  ])
  const report = conceptGroups()

  assert.match(report, /nomina María \(11\).*nomina maria \(5\) \[accents\]/)
  assert.match(report, /Corte inglés \(2\) {2}<- {2}Corte Ingés \(1\) \[typo\]/)
  assert.match(report, /carniceria \(5\) {2}<- {2}carniuceria \(1\) \[typo\]/)
  assert.match(report, /restaurante \(3\) {2}<- {2}restauran \(2\) \[prefix\]/)
  assert.match(report, /Teatro Eva \(13\) {2}<- {2}Eva teatro \(1\) \[order\]/)
  // The dropped `a`, which no other rule can see: the phrases are different
  // lengths, so it is not a typo, and the words are not a reordering.
  assert.match(report, /traspaso a cuenta común \(3\) {2}<- {2}traspaso cuenta comun \(2\) \[stopwords\]/)
})

test('the summary counts the rows each signal would change', () => {
  world([['pan', 114], ['Pan', 26], ['caña', 18], ['cañas', 6]])
  assert.match(conceptGroups(), /By signal:\s+accents 26, plural 6/)
})

test('a voided row counts under the concept it is, not as a spelling of its own', () => {
  // Voiding prefixes the concept with `[anulado] `. Left raw, every voided entry
  // arrives as its own spelling and the report proposes merging a tombstone into
  // the thing it is a tombstone of.
  world([['super', 3], ['[anulado] super', 1], ['Super', 2]])
  const report = conceptGroups()

  assert.match(report, /Distinct concepts: 2/)
  assert.match(report, /super \(4\) {2}<- {2}Super \(2\) \[accents\]/)
  assert.ok(!report.includes('anulado'), 'the mark leaked into the report')
})
