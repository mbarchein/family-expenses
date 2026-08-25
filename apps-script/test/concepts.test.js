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
const { sheet, install, load } = require('./fake-sheets')

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
  const rows = [['Fecha', 'Concepto', 'Viqui', 'Mario', 'diferencia', 'observaciones', 'id']]
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
    gastos: sheet('gastos', ledgerOf(pairs), 7),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
  })
  load()
}

test('super and supermercado are one group, and the common one is kept', () => {
  world([['super', 112], ['supermercado', 37]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+1 \(37 rows would change\)/)
  assert.match(report, /KEEP super \(112\)\s+<-\s+supermercado \(37\) \[prefix\]/)
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
  assert.match(conceptGroups(), /KEEP gasolina \(20\)\s+<-\s+gasolna \(2\) \[typo\]/)
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

test('three spellings land in one group, not two that share a member', () => {
  // What one pass over pairs gets wrong: `Supermercado` matches both of the
  // others, so joining as they arrive can leave two groups with `super` in each.
  world([['super', 40], ['supermercado', 12], ['Supermercado', 5]])
  const report = conceptGroups()

  assert.match(report, /Groups proposed:\s+1 \(17 rows would change\)/)
  assert.equal(report.match(/KEEP /g).length, 1)
})

test('the report shows real rows, so a group can be recognised before it is merged', () => {
  // The whole point of the examples: somebody has to be able to tell whether
  // `supermercado` was the same shop before agreeing to rewrite thirty-seven
  // rows of their own history.
  world([['super', 3], ['supermercado', 2]])
  const report = conceptGroups()

  assert.match(report, /super: 2026-07-\d\d \d+\.\d\d/)
  assert.match(report, /supermercado: 2026-07-\d\d/)
})

test('it counts what it read and what it could not group', () => {
  world([['super', 2], ['una vez', 1], ['otra', 1]])
  const report = conceptGroups()

  assert.match(report, /Rows read:\s+4/)
  assert.match(report, /Distinct concepts: 3/)
  assert.match(report, /Used once:\s+2 - una vez, otra/)
})

test('it writes nothing at all', () => {
  // Read-only is the promise this function is run on: it is pointed at a real
  // household ledger by somebody who has been told it only looks.
  const sheets = {
    gastos: sheet('gastos', ledgerOf([['super', 3], ['supermercado', 2]]), 7),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
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
  assert.match(conceptGroups(), /KEEP compra super \(5\)\s+<-\s+super compra \(2\) \[order\]/)
})
