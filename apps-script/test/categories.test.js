/**
 * The Categorías tab.
 *
 * A concept is what somebody typed and a category is the bucket it belongs to,
 * and the tab is where the two are joined: the name, the icon it wears, and the
 * words that guess it from a concept nobody has filed before.
 *
 * The tests that matter most are about the guessing, because a wrong guess files
 * somebody's expense under the wrong heading without asking — and about what the
 * tab survives, since it is edited by hand in a browser by two people who will
 * write the same category twice and leave a trailing space on it.
 */

const test = require('node:test')
const assert = require('node:assert')
const { sheet, install, load, LEDGER_HEADERS, LEDGER_COLS } = require('./fake-sheets')

const CONFIG = [
  ['clave', 'valor'],
  ['persona_1_nombre', 'Viqui'],
  ['persona_1_columna', 'C'],
  ['persona_2_nombre', 'Mario'],
  ['persona_2_columna', 'D'],
  ['hoja_gastos', 'gastos'],
]

function world(categories) {
  const sheets = {
    gastos: sheet('gastos', [LEDGER_HEADERS], LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
  }
  if (categories) {
    sheets['Categorías'] = sheet('Categorías', [['categoría', 'icono', 'palabras']].concat(categories), 3)
  }
  install(sheets)
  load()
  return sheets
}

test('a category carries its icon and its words', () => {
  world([['Restaurantes', 'cubiertos', 'restaurante, cena, menú']])
  const items = readCategories_().items

  assert.equal(items.length, 1)
  assert.equal(items[0].name, 'Restaurantes')
  assert.equal(items[0].icon, 'cubiertos')
  // Folded, because a concept typed on a phone will not carry the accents. The
  // longest first, and otherwise in the order they were written — `cena` before
  // `menú`, both four letters.
  assert.deepEqual(items[0].words, ['restaurante', 'cena', 'menu'])
})

test('the words come back longest first, so gasolina beats gas', () => {
  // Both are words of the same category here, but the ordering is what stops
  // `gas` claiming `gasolina` when they belong to different ones.
  world([['Combustible', 'combustible', 'gas, gasolinera, gasolina']])
  assert.deepEqual(readCategories_().items[0].words, ['gasolinera', 'gasolina', 'gas'])
})

test('a missing tab is a fallback, not an error', () => {
  // The first thing a new spreadsheet has is nothing, and the app guesses from
  // its own table until this tab exists.
  world(null)
  const answer = readCategories_()
  assert.deepEqual(answer.items, [])
  assert.equal(answer.missing, true)
})

test('the same category written twice is one category', () => {
  // Somebody editing thirty rows in a browser will do this. The one nearer the
  // top wins, because that is the one they are looking at.
  world([
    ['Restaurantes', 'cubiertos', 'cena'],
    ['restaurantes ', 'taza', 'bar'],
  ])
  const items = readCategories_().items
  assert.equal(items.length, 1)
  assert.equal(items[0].icon, 'cubiertos')
})

test('a row with no name is skipped rather than becoming a blank category', () => {
  world([['', 'cesta', 'super'], ['Supermercado', 'cesta', 'super']])
  assert.deepEqual(readCategories_().items.map(item => item.name), ['Supermercado'])
})

/* ── guessing ─────────────────────────────────────────────────────────── */

const GUESSES = [
  ['Supermercado', 'cesta', 'supermercado, super, compra'],
  ['Combustible', 'combustible', 'gasolinera, gasolina'],
  ['Panadería', 'pan', 'panadería, pan'],
  ['Gas', 'llama', 'gas, butano'],
  ['Restaurantes', 'cubiertos', 'restaurante, cena'],
]

test('a concept nobody has filed is guessed from the words', () => {
  world(GUESSES)
  const items = readCategories_().items

  assert.equal(guessCategory_('supermercado Salobreña', items), 'Supermercado')
  assert.equal(guessCategory_('Cena en un bar', items), 'Restaurantes')
  assert.equal(guessCategory_('gasolinera Repsol', items), 'Combustible')
})

test('a short word has to be a word, not letters inside one', () => {
  // The four wrong icons this rule was written for: `gastos varios` was a gas
  // flame, `pantalones` a loaf of bread. Four characters is where the list stops
  // being distinctive.
  world(GUESSES)
  const items = readCategories_().items

  assert.equal(guessCategory_('gastos varios', items), '')
  assert.equal(guessCategory_('pantalones', items), '')
  assert.equal(guessCategory_('gas natural', items), 'Gas')
  assert.equal(guessCategory_('pan', items), 'Panadería')
  // And the Spanish plural of a short word still counts as that word.
  assert.equal(guessCategory_('panes', items), 'Panadería')
})

test('a concept that looks like nothing is left unfiled', () => {
  // Deliberately: a category is going to be printed on the row and totalled
  // under a heading, and a wrong one is worse than an empty one.
  world(GUESSES)
  assert.equal(guessCategory_('lo del jueves', readCategories_().items), '')
  assert.equal(guessCategory_('', readCategories_().items), '')
})

/* ── writes ───────────────────────────────────────────────────────────── */

test('a new category is appended, an existing one is edited in place', () => {
  const sheets = world([['Restaurantes', 'cubiertos', 'cena']])

  saveCategory_({ name: 'Peluquería', icon: 'tijeras', words: ['peluquería', 'barbería'] })
  assert.equal(sheets['Categorías'].values.length, 3)

  saveCategory_({ name: 'Restaurantes', icon: 'taza', words: ['cena', 'menú'] })
  assert.equal(sheets['Categorías'].values.length, 3, 'edited rather than added again')
  assert.deepEqual(sheets['Categorías'].values[1], ['Restaurantes', 'taza', 'cena, menú'])
})

test('a category can be renamed without losing its row', () => {
  const sheets = world([['Restaurantes', 'cubiertos', 'cena']])

  saveCategory_({ was: 'Restaurantes', name: 'Comer fuera', icon: 'cubiertos', words: ['cena'] })

  assert.equal(sheets['Categorías'].values.length, 2)
  assert.equal(sheets['Categorías'].values[1][0], 'Comer fuera')
})

test('the tab is created on the first save if it is not there', () => {
  const sheets = world(null)
  saveCategory_({ name: 'Supermercado', icon: 'cesta', words: ['super'] })

  const created = sheets['Categorías']
  assert.ok(created, 'the tab was created')
  assert.deepEqual(created.values[0], ['categoría', 'icono', 'palabras'])
  assert.equal(created.values[1][0], 'Supermercado')
})

test('a category with no name is refused rather than written blank', () => {
  const sheets = world([['Restaurantes', 'cubiertos', 'cena']])
  assert.throws(() => saveCategory_({ name: '   ', icon: 'cesta' }), /needs a name/)
  assert.equal(sheets['Categorías'].values.length, 2)
})

test('deleting a category removes its row and nothing else', () => {
  // A row here is a setting, not a fact: nothing sums it, and the expenses filed
  // under the name keep the text they were given, since column H holds the name
  // itself rather than a reference to this tab.
  const sheets = world([
    ['Restaurantes', 'cubiertos', 'cena'],
    ['Supermercado', 'cesta', 'super'],
  ])

  assert.deepEqual(deleteCategory_({ name: 'restaurantes' }), { removed: 1 })
  assert.deepEqual(sheets['Categorías'].values.map(row => row[0]), ['categoría', 'Supermercado'])

  assert.deepEqual(deleteCategory_({ name: 'Nada' }), { removed: 0 })
})

test('bootstrap carries the categories the app needs to draw the second step', () => {
  world(GUESSES)
  const answer = handleBootstrap_({}, { email: 'mario@example.com' })

  assert.equal(answer.categories.length, GUESSES.length)
  assert.equal(answer.categories[0].name, 'Supermercado')
  assert.equal(answer.categories[0].icon, 'cesta')
})
