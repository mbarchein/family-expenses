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

/**
 * Loaded once here, before any test body runs.
 *
 * The tests that check the real seed name `CATEGORY_SEED`, which only exists
 * after `load()` has evaluated the sources — so without this they pass only
 * because some earlier test happened to load them, and running one on its own
 * with `--test-name-pattern` fails with `CATEGORY_SEED is not defined`. Found
 * exactly that way.
 */
load()

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

/* ── the batch pass ───────────────────────────────────────────────────── */

/**
 * Filling column H for rows that have none.
 *
 * The pass the whole idea rests on: 2,318 rows exist and none of them has a
 * category. So the tests are about the order of the two answers — what this
 * concept was filed as before beats what the words guess — and about everything
 * it must not touch on the way.
 */

function ledger(rows) {
  const values = [LEDGER_HEADERS]
  rows.forEach(([concept, category], index) => {
    values.push([new Date(2026, 6, 1 + index), concept, 10 + index, '', 100, '',
      `id-${index}`, category || '', ''])
  })
  return values
}

function filedWorld(rows, categories) {
  const sheets = {
    gastos: sheet('gastos', ledger(rows), LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
    'Categorías': sheet('Categorías',
      [['categoría', 'icono', 'palabras']].concat(categories || GUESSES), 3),
  }
  install(sheets)
  load()
  return sheets
}

/** Column H, row 2 down. */
function filed(sheets) {
  return sheets.gastos.values.slice(1).map(row => row[COL_CATEGORY - 1])
}

test('the words file the rows nobody has filed', () => {
  const sheets = filedWorld([['supermercado Salobreña'], ['gasolinera Repsol'], ['pan']])
  const answer = categoriseRows()

  assert.deepEqual(filed(sheets), ['Supermercado', 'Combustible', 'Panadería'])
  assert.match(answer, /FILED:\s+3 of 3 rows/)
})

test('a concept already filed beats the words, and spreads', () => {
  // The reason re-running this improves it: file one row by hand in the app and
  // the next pass carries that decision to every row saying the same thing —
  // even backwards, to rows above the one that was filed.
  const sheets = filedWorld([
    ['Cena en un bar'],
    ['pan'],
    ['Cena en un bar', 'Comer fuera'],
    ['cena en un bar'],
  ])
  const answer = categoriseRows()

  assert.deepEqual(filed(sheets),
    ['Comer fuera', 'Panadería', 'Comer fuera', 'Comer fuera'])
  // Two newly filled from the known concept; the third already had it.
  assert.match(answer, /from a concept already filed: 2/)
  assert.match(answer, /from the words on the tab:\s+1/)
})

test('a row that already has a category is left exactly as it is', () => {
  // Including one somebody typed by hand to correct this pass. Overwriting that
  // would make the correction pointless and the pass untrustworthy.
  const sheets = filedWorld([['pan', 'Desayunos'], ['pan']])
  categoriseRows()

  assert.deepEqual(filed(sheets), ['Desayunos', 'Desayunos'])
})

test('a concept that looks like nothing is left empty and reported', () => {
  // A wrong category is printed on the row, totalled under a heading and then
  // believed. An empty one is a question still open, and the report is where the
  // work shows up: every line is a word to add to `palabras`.
  const sheets = filedWorld([['lo del jueves'], ['lo del jueves'], ['pan']])
  const answer = categoriseRows()

  assert.deepEqual(filed(sheets), ['', '', 'Panadería'])
  assert.match(answer, /Still without a category:\s+2 rows/)
  assert.match(answer, /Unfiled concepts, commonest first/)
  assert.match(answer, /2\s+lo del jueves/)
})

test('a voided row is filed under the concept it is a tombstone of', () => {
  const sheets = filedWorld([['[anulado] pan']])
  categoriseRows()
  assert.deepEqual(filed(sheets), ['Panadería'])
})

test('the preview writes nothing at all', () => {
  const sheets = filedWorld([['pan'], ['supermercado']])
  const answer = previewCategorise()

  assert.match(answer, /WOULD FILE:\s+2 of 2 rows/)
  assert.match(answer, /Nothing written/)
  assert.deepEqual(sheets.gastos.writes, [])
})

test('it writes the category column and nothing else', () => {
  const sheets = filedWorld([['pan'], ['supermercado']])
  categoriseRows()

  assert.equal(sheets.gastos.writes.length, 1, 'one write for the column, not one per row')
  assert.equal(sheets.gastos.writes[0].column, COL_CATEGORY)
  assert.equal(sheets.gastos.writes[0].row, 2)
  assert.ok(sheets.gastos.writes[0].values.every(row => row.length === 1), 'one column wide')
})

test('a formula in the category column stops the whole pass', () => {
  const sheets = {
    gastos: sheet('gastos', ledger([['pan'], ['super']]), LEDGER_COLS, { '3,8': '=B3' }),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
    'Categorías': sheet('Categorías', [['categoría', 'icono', 'palabras']].concat(GUESSES), 3),
  }
  install(sheets)
  load()

  assert.match(categoriseRows(), /Refusing: 1 cells in the category column hold formulas/)
  assert.deepEqual(sheets.gastos.writes, [])
})

test('with no tab it says which function to run rather than guessing', () => {
  const sheets = {
    gastos: sheet('gastos', ledger([['pan']]), LEDGER_COLS),
    Config: sheet('Config', CONFIG, 2),
    Sugerencias: sheet('Sugerencias', [['texto', 'tipo', 'ámbito']], 26),
    Fijos: sheet('Fijos', [['concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo']], 26),
  }
  install(sheets)
  load()

  assert.match(categoriseRows(), /There is no "Categorías" tab/)
  assert.deepEqual(sheets.gastos.writes, [])
})

/* ── keeping an existing tab up to date ───────────────────────────────── */

/**
 * The seed only runs when the tab is created, so a tab that already exists never
 * sees a new category or a new word — and the first real run of the batch pass
 * over 2,323 rows is exactly what teaches you which words were missing.
 *
 * These tests are about restraint: it adds, it never removes, and it is safe to
 * run twice.
 */

test('a category the tab does not have is added', () => {
  const sheets = world([['Supermercado', 'cesta', 'super']])
  updateCategories()

  const names = sheets['Categorías'].values.slice(1).map(row => row[0])
  assert.ok(names.includes('Música'), 'the new category arrived')
  assert.ok(names.includes('Restaurantes'))
})

test('missing words are appended and existing ones are left alone', () => {
  // `iberdrola` and `endesa` are what the real ledger asked for, and `mi luz` is
  // something somebody added by hand. Both have to survive.
  const sheets = world([['Luz', 'bombilla', 'luz, mi luz']])
  updateCategories()

  const row = sheets['Categorías'].values.slice(1).find(line => line[0] === 'Luz')
  assert.match(row[2], /mi luz/)
  assert.match(row[2], /iberdrola/)
  assert.match(row[2], /endesa/)
})

test('nothing is ever removed, including a word the seed does not know', () => {
  // The tab is theirs to edit. A pass that corrected it back to the seed would
  // undo the editing it exists to support.
  const sheets = world([['Ocio', 'entrada', 'cine, ficzone, isla de capri']])
  updateCategories()

  const row = sheets['Categorías'].values.slice(1).find(line => line[0] === 'Ocio')
  assert.match(row[2], /ficzone/)
  assert.match(row[2], /isla de capri/)
})

test('an icon somebody changed by hand is kept', () => {
  const sheets = world([['Deporte', 'huella', 'deporte']])
  updateCategories()

  const row = sheets['Categorías'].values.slice(1).find(line => line[0] === 'Deporte')
  assert.equal(row[1], 'huella', 'their icon, not the seed’s')
})

test('Vivienda becomes Hogar, once', () => {
  // Two categories both meaning "the house" would be worse than either name:
  // every row filed after the change would land in one of them at random.
  const sheets = world([['Vivienda', 'casa', 'hipoteca, alquiler']])
  const first = updateCategories()

  const names = sheets['Categorías'].values.slice(1).map(row => row[0])
  assert.ok(names.includes('Hogar'))
  assert.ok(!names.includes('Vivienda'))
  assert.match(first, /RENAMED\s+Vivienda -> Hogar/)

  // And running it again neither renames anything nor adds a second Hogar.
  const again = updateCategories()
  assert.ok(!again.includes('RENAMED'))
  assert.equal(
    sheets['Categorías'].values.slice(1).filter(row => row[0] === 'Hogar').length, 1)
})

test('running it twice changes nothing the second time', () => {
  world([['Supermercado', 'cesta', 'super']])
  updateCategories()
  assert.match(updateCategories(), /Nothing to add/)
})

/**
 * Idempotence, checked over three runs rather than asserted.
 *
 * "It only adds" is not the same claim as "running it again does nothing", and
 * the difference is where the bugs were. Both of these were written as a probe
 * and both failed: the rename wrote a stripped copy of its words and the append
 * that followed had nothing to append to, so `hipoteca` was lost and the next run
 * put it back.
 */
test('a tab already matching the seed is not written to at all', () => {
  const sheets = world(CATEGORY_SEED.map(row => [row[0], row[1], row[2]]))

  assert.match(updateCategories(), /Nothing to add/)
  assert.match(updateCategories(), /Nothing to add/)
  assert.deepEqual(sheets['Categorías'].writes, [], 'not one write for a tab that is up to date')
})

test('a tab that needs words settles after one run', () => {
  const sheets = world([
    ['Luz', 'bombilla', 'luz'],
    ['Cafés y bares', 'taza', 'cafetería'],
    ['Vivienda', 'casa', 'hipoteca'],
  ])

  updateCategories()
  const settled = JSON.parse(JSON.stringify(sheets['Categorías'].values))

  assert.match(updateCategories(), /Nothing to add/)
  assert.match(updateCategories(), /Nothing to add/)
  assert.deepEqual(sheets['Categorías'].values, settled, 'the tab stopped changing')
})

test('a rename keeps the words it was carrying', () => {
  const sheets = world([['Vivienda', 'casa', 'hipoteca, comunidad']])
  updateCategories()

  const row = sheets['Categorías'].values.slice(1).find(line => line[0] === 'Hogar')
  assert.match(row[2], /hipoteca/)
  assert.match(row[2], /comunidad/)
})

test('their spelling survives, and new words arrive in the seed’s', () => {
  // This tab is a document two people read. A word that comes back without its
  // accent looks like a mistake somebody made, and reordering the line they wrote
  // is no better — so what they typed stays where they typed it, and the new ones
  // go on the end.
  const sheets = world([['Cafés y bares', 'taza', 'cafetería, café']])
  updateCategories()

  const row = sheets['Categorías'].values.slice(1).find(line => line[0] === 'Cafés y bares')
  assert.match(row[2], /^cafetería, café, /, 'theirs first, untouched')
  assert.match(row[2], /heladería/, 'and the new ones with their accents too')
})

test('the cleaning and the transfer are filed under Hogar', () => {
  // Their correction, and the reason the category is called Hogar rather than
  // Vivienda: `nómina María` is the cleaner being paid, and the transfer goes to
  // the account the mortgage comes out of. Neither is an income.
  const sheets = filedWorld(
    [['nomina María'], ['nómina Maria'], ['Traspaso a cuenta común'], ['hipoteca']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets), ['Hogar', 'Hogar', 'Hogar', 'Hogar'])
})

test('the food shops all land in Supermercado, and pan is still a whole word', () => {
  const sheets = filedWorld(
    [['fruteria'], ['Frutería'], ['carniceria'], ['pescadería'], ['pan'], ['pantalones']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets), [
    'Supermercado', 'Supermercado', 'Supermercado', 'Supermercado', 'Supermercado', 'Ropa',
  ])
})

test('the fixed suppliers are words, and the orchestra has a category', () => {
  const sheets = filedWorld(
    [['Iberdrola'], ['Endesa'], ['Emasagra'], ['Alsa'], ['orquesta'], ['Orquesta Irene']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets),
    ['Luz', 'Luz', 'Agua', 'Transporte', 'Música', 'Música'])
})

test('Corte inglés is a shop, and gastos varios is not gas', () => {
  // The collision this whole exact-word business exists for. `inglés` is a word
  // of Educación now, and the department store is kept out of it by `=corte
  // inglés` under Ropa — which wins even though Ropa sits lower on the tab.
  const sheets = filedWorld(
    [['Corte inglés'], ['gastos varios'], ['Inglés Irene']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets), ['Ropa', '', 'Educación'])
})

/* ── words that only mean anything as the whole concept ───────────────── */

test('=maría is the cleaner, and a present for María is not', () => {
  // Their own answer, and the case that needed a rule rather than a word:
  // `maria` on its own is the cleaning being paid, `regalo maría` is a present.
  // As a plain word it would take both, and it would take the present, because
  // Hogar sits above Regalos on the tab.
  const sheets = filedWorld(
    [['maria'], ['María'], ['Regalo María'], ['regalo maria elia']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets), ['Hogar', 'Hogar', 'Regalos', 'Regalos'])
})

test('the English is the lessons, and the Corte is the shop', () => {
  const sheets = filedWorld(
    [['Inglés Irene'], ['inglés irene'], ['Corte inglés'], ['Corte Ingés']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  // The last is their own typo for the shop, which is why it is on the tab as an
  // exact word of its own.
  assert.deepEqual(filed(sheets), ['Educación', 'Educación', 'Ropa', 'Ropa'])
})

test('an exact word beats a contained one from a category higher up', () => {
  // The rule, on its own. Written this way round on purpose: the category with
  // the contained word is first, so passing means the order did not decide it.
  world([
    ['Educación', 'mochila', 'inglés'],
    ['Ropa', 'camiseta', '=corte inglés'],
  ])
  const items = readCategories_().items

  assert.equal(guessCategory_('Corte inglés', items), 'Ropa')
  assert.equal(guessCategory_('clases de inglés', items), 'Educación')
})

test('the exact words are tried before the rest', () => {
  world([['Hogar', 'casa', 'nómina, =maría, hipoteca']])
  const words = readCategories_().items[0].words
  assert.equal(words[0], '=maria', 'the exact one first, whatever its length')
})

test('tributos are taxes', () => {
  // Singular on the tab so it reaches both: `tributo` is long enough to match
  // inside a word, which is what makes `tributos` land too.
  const sheets = filedWorld(
    [['tributos'], ['Tributo IBI'], ['tributos municipales']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets),
    ['Impuestos y recibos', 'Impuestos y recibos', 'Impuestos y recibos'])
})

test('the eleven they sent last land where they said', () => {
  const sheets = filedWorld([
    ['excursión'], ['excursiones colegio'], ['violín'], ['Comesaña'], ['cl'],
    ['Picasso'], ['flash'], ['Contreras'], ['Zara'], ['bonobús'],
    ['cumple'], ['cumpleaños Eva'], ['regalo eva'],
  ], CATEGORY_SEED.map(row => [row[0], row[1], row[2]]))
  categoriseRows()

  assert.deepEqual(filed(sheets), [
    'Educación', 'Educación', 'Educación', 'Educación', 'Educación',
    'Libros', 'Libros', 'Supermercado', 'Ropa', 'Transporte',
    'Regalos', 'Regalos', 'Regalos',
  ])
})

test('cl is a word and not two letters inside one', () => {
  // Two characters, so it has to be the whole word: Salud has `clínica`, and the
  // pair must not collide.
  const sheets = filedWorld(
    [['cl'], ['clínica'], ['cl irene']],
    CATEGORY_SEED.map(row => [row[0], row[1], row[2]]),
  )
  categoriseRows()

  assert.deepEqual(filed(sheets), ['Educación', 'Salud', 'Educación'])
})

test('everything else they answered lands where they said', () => {
  const sheets = filedWorld([
    ['BBVA abono'], ['BBVA retención'], ['Acacio'], ['oeg'], ['Mariela'],
    ['Altramuces'], ['Orontes'], ['Ficzone'], ['Isla de Capri'],
    ['tienda hamburgo'], ['Salobreña'], ['Moclín'], ['pedido'],
    // And the one they said to leave alone.
    ['ro'],
  ], CATEGORY_SEED.map(row => [row[0], row[1], row[2]]))
  categoriseRows()

  assert.deepEqual(filed(sheets), [
    'Hogar', 'Hogar', 'Internet y teléfono', 'Educación', 'Educación',
    'Restaurantes', 'Educación', 'Ocio', 'Cafés y bares',
    'Viajes', 'Viajes', 'Viajes', 'Supermercado',
    '',
  ])
})
