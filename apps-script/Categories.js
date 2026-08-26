/**
 * The Categorías tab: the categories, their icons, and the words that guess them.
 *
 * A concept is what somebody typed — "Cena en un bar" — and a category is the
 * bucket it belongs to — Restaurantes. Keeping them apart is what makes a total
 * by kind possible without first agreeing on a spelling, which is the problem
 * 720 distinct concepts over 2,318 rows had no answer to.
 *
 * It lives in the spreadsheet rather than in the app for the same reason Config
 * does: adding a category, or changing which icon it wears, is editing a cell.
 * No deployment, nothing to keep in sync between two phones, and the two people
 * using this can do it themselves. The headers are in Spanish because this tab is
 * opened by hand in Google Sheets — it is interface, not schema. See CLAUDE.md.
 *
 * `palabras` is the guess. When a concept has never been filed before, the words
 * are what suggest a category for it, and they are here rather than compiled into
 * the app so that a guess that annoys somebody can be fixed by the person it
 * annoys. Longest word first when matching, so `gasolina` beats `gas`.
 */

var CATEGORIES_SHEET = 'Categorías';
var CATEGORY_HEADERS = ['categoría', 'icono', 'palabras'];

/**
 * Every category on the tab, in the order it is written there.
 *
 * A missing tab is not an error: the app falls back to guessing from its own
 * built-in table, which is what it did before this tab existed. An empty answer
 * has to be survivable, because the first thing a new spreadsheet has is nothing.
 */
function readCategories_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CATEGORIES_SHEET);
  if (!sheet) return { items: [], missing: true };

  var last = sheet.getLastRow();
  if (last < 2) return { items: [], missing: false };

  var rows = sheet.getRange(2, 1, last - 1, CATEGORY_HEADERS.length).getValues();
  var items = [];
  var seen = {};
  rows.forEach(function (row) {
    var name = String(row[0] == null ? '' : row[0]).trim();
    if (!name) return;
    // The same category written twice is a mistake somebody made in a browser,
    // not two categories. The first one wins, which is the one nearer the top of
    // the tab they are looking at.
    var key = fold_(name);
    if (seen[key]) return;
    seen[key] = true;
    items.push({
      name: name,
      icon: String(row[1] == null ? '' : row[1]).trim(),
      words: splitWords_(row[2]),
      // The cell as it reads, accents and order intact. `words` is for matching;
      // this is for writing back to a tab two people look at.
      raw: String(row[2] == null ? '' : row[2]).trim()
    });
  });
  return { items: items, missing: false };
}

/** The words of a cell as they are written, trimmed and in order. What a person
 *  typed, kept for when it has to be written back to a tab they read. */
function rawWords_(raw) {
  return String(raw == null ? '' : raw)
    .split(/[,;\n]/)
    .map(function (word) { return word.trim(); })
    .filter(function (word) { return word; });
}

/** How a word is compared: folded, with its inner spaces collapsed. One function
 *  so that reading the tab and adding to it cannot disagree about what a word is. */
function wordKey_(word) {
  return fold_(word).replace(/\s+/g, ' ').trim();
}

/**
 * `pan, panadería` as ['pan', 'panaderia'], folded — the exact ones first and
 * then longest first, which is the order they are tried in: `gasolina` has to be
 * tried before `gas`, and `=maria` before either.
 */
function splitWords_(raw) {
  return rawWords_(raw)
    .map(wordKey_)
    .filter(function (word) { return word; })
    .sort(function (a, b) {
      var exact = (b.charAt(0) === '=') - (a.charAt(0) === '=');
      return exact || b.length - a.length;
    });
}

/**
 * The category a concept looks like, or ''.
 *
 * Short words have to match as whole words. Four characters is where the list
 * stops being distinctive — `gas`, `bar`, `pan`, `ropa` — and a plain substring
 * test put a bread roll on `pantalones` and a gas flame on `gastos varios`.
 */
var SHORT_WORD = 4;

function guessCategory_(concept, categories) {
  var text = fold_(concept).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  var parts = text.split(' ');

  // The exact words first, across every category, and only then the rest.
  //
  // "The whole concept is this" is a more specific claim than "the concept
  // contains this", so it wins — and it has to win regardless of which row is
  // higher up the tab. Inside one category the sort already put the exact ones
  // first; across categories nothing did, and that gap is the same one that keeps
  // biting: `inglés` in Educación would take `Corte inglés`, a department store,
  // purely because Educación sits above Ropa. `=corte inglés` in Ropa now settles
  // it, whatever the order.
  for (var pass = 0; pass < 2; pass++) {
    for (var i = 0; i < categories.length; i++) {
      var words = categories[i].words;
      for (var j = 0; j < words.length; j++) {
        if ((words[j].charAt(0) === '=') !== (pass === 0)) continue;
        if (wordMatches_(text, parts, words[j])) return categories[i].name;
      }
    }
  }
  return '';
}

/**
 * `=algo` matches only when the whole concept is `algo`.
 *
 * There for one real case, and it is a case with no other answer. `maria` on its
 * own is the cleaner being paid; `regalo maría` is a present for somebody called
 * María. As an ordinary word `maria` would take both, and it would take the
 * present because Hogar sits above Regalos on the tab — a category order nobody
 * chose deciding what a row means.
 *
 * So: the words that are only meaningful as the entire concept can say so.
 */
function wordMatches_(text, parts, word) {
  if (word.charAt(0) === '=') return text === word.substring(1);
  if (word.length > SHORT_WORD) return text.indexOf(word) !== -1;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === word || parts[i] === word + 's' || parts[i] === word + 'es') return true;
  }
  return false;
}

/**
 * Adds a category or edits one that exists, matched by its folded name.
 *
 * One row at a time rather than rewriting the tab. Two phones editing at the
 * same moment would otherwise have the second one write the whole list it read
 * before the first one saved, quietly undoing it — and this tab is meant to be
 * edited from a phone, which is exactly when that happens.
 */
function saveCategory_(payload) {
  var name = String(payload.name == null ? '' : payload.name).trim();
  if (!name) throw apiError_('BAD_REQUEST', 'A category needs a name');
  if (name.length > 60) throw apiError_('BAD_REQUEST', 'That name is too long for a category');

  var icon = String(payload.icon == null ? '' : payload.icon).trim();
  var words = Array.isArray(payload.words) ? payload.words.join(', ')
    : String(payload.words == null ? '' : payload.words);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = categoriesSheet_();
    var last = sheet.getLastRow();
    var wanted = fold_(payload.was ? String(payload.was).trim() : name);
    var row = 0;
    if (last >= 2) {
      var names = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < names.length; i++) {
        if (fold_(String(names[i][0] || '').trim()) === wanted) { row = i + 2; break; }
      }
    }
    if (!row) row = Math.max(last, 1) + 1;

    sheet.getRange(row, 1, 1, CATEGORY_HEADERS.length).setValues([[name, icon, words]]);
    SpreadsheetApp.flush();
    return { name: name, icon: icon, words: splitWords_(words), row: row };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Removes a category from the tab.
 *
 * This one really does delete a row, and it is worth being explicit about why
 * that is allowed here when it never is in the ledger: a row here is a setting,
 * not a fact. Nothing sums it, no formula reads the row below it, and the
 * expenses already filed under the name keep the text they were given — the
 * ledger's column H holds the name itself, not a reference to this tab.
 */
function deleteCategory_(payload) {
  var wanted = fold_(String(payload.name == null ? '' : payload.name).trim());
  if (!wanted) throw apiError_('BAD_REQUEST', 'A category needs a name');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = categoriesSheet_();
    var last = sheet.getLastRow();
    if (last < 2) return { removed: 0 };
    var names = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (fold_(String(names[i][0] || '').trim()) === wanted) {
        sheet.deleteRow(i + 2);
        SpreadsheetApp.flush();
        return { removed: 1 };
      }
    }
    return { removed: 0 };
  } finally {
    lock.releaseLock();
  }
}

/** The tab, created with its headers if it is not there yet. */
function categoriesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CATEGORIES_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CATEGORIES_SHEET);
  sheet.getRange(1, 1, 1, CATEGORY_HEADERS.length)
    .setValues([CATEGORY_HEADERS]).setFontWeight('bold');
  return sheet;
}

/**
 * The starter set, written once when the tab is created.
 *
 * These are the app's own guesses, moved out of the bundle and into the
 * spreadsheet where they can be argued with. The list is not meant to be right
 * for this household — it is meant to be a tab that explains its own shape, so
 * that the first thing anybody does with it is rename half of it.
 *
 * One icon can serve several categories, on purpose. The app says so when it
 * happens, and shows what else already wears it, rather than refusing.
 */
var CATEGORY_SEED = [
  // The food shops are all one line, which is their call: their own concepts had
  // been distinguishing frutería from supermercado since 2022 and they would
  // rather have one figure for the food than four. `pan` stays a whole-word match
  // — `pantalones` is not bread.
  ['Supermercado', 'cesta',
    'supermercado, mercado, super, compra, panadería, pan, frutería, fruta, '
    + 'carnicería, pescadería, verdulería, pedido, contreras'],
  ['Restaurantes', 'cubiertos',
    'restaurante, comida, cena, menú, tapas, comedor, pizza, altramuces'],
  ['Cafés y bares', 'taza',
    'cafetería, café, desayuno, bar, cerveza, helado, heladería, isla de capri'],
  ['Salud', 'salud', 'farmacia, medicina, medicamento, dentista, médico, clínica, óptica'],
  ['Combustible', 'combustible', 'gasolinera, gasolina, gasoil, combustible, diésel'],
  ['Coche', 'coche', 'taller, coche, itv, parking'],
  ['Transporte', 'bus', 'autobús, tren, metro, taxi, billete, alsa, bonobús'],
  ['Luz', 'bombilla', 'electricidad, luz, iberdrola, endesa'],
  ['Agua', 'gota', 'agua, emasagra'],
  ['Gas', 'llama', 'calefacción, butano, gas'],
  ['Internet y teléfono', 'senal', 'internet, fibra, teléfono, acacio'],
  ['Móvil', 'movil', 'móvil'],
  // Their word, and it covers more than the building: the cleaning — which their
  // ledger calls `nómina María` — and the transfer to the account the mortgage and
  // the standing bills come out of.
  // `=maría` and not `maría`: on its own it is the cleaner being paid, while
  // `regalo maría` is a present for somebody of that name. See `wordMatches_`.
  ['Hogar', 'casa',
    'hipoteca, alquiler, comunidad, piso, limpieza, nómina, traspaso, bbva, =maría'],
  ['Seguros', 'escudo', 'seguro'],
  ['Impuestos y recibos', 'recibo',
    'impuesto, tributo, basura, multa, ibi, recibo, factura'],
  ['Banco', 'banco', 'banco, comisión, hucha'],
  // Their word, said five times over: excursions, the violin, the English, the
  // tutors. `inglés` is a plain word here and `Corte inglés` — a department store
  // — is kept out of it by `=corte inglés` under Ropa, which wins because an exact
  // word beats a contained one whatever the row order. See `guessCategory_`.
  ['Educación', 'mochila',
    'escolar, colegio, escuela, guardería, instituto, ampa, papelería, orontes, '
    + 'oeg, mariela, inglés, excursión, violín, comesaña, cl'],
  ['Música', 'nota', 'orquesta, conservatorio, música, solfeo'],
  ['Libros', 'libro', 'librería, libro, curso, picasso, flash'],
    // The two exact ones are the department store, their own typo of it included.
  // Without them `inglés` under Educación would take both.
  ['Ropa', 'camiseta',
    'ropa, zapatos, pantalón, camisa, zara, =corte inglés, =corte ingés'],
  ['Regalos', 'regalo', 'regalo, cumple, cumpleaños, flores'],
  ['Ocio', 'entrada', 'cine, teatro, concierto, ocio, lotería, entrada, ficzone'],
  ['Deporte', 'pesa', 'gimnasio, deporte, pádel, bádminton'],
  ['Peluquería', 'tijeras', 'peluquería, barbería'],
  ['Viajes', 'maleta', 'vacaciones, hotel, viaje, hamburgo, salobreña, moclín'],
  ['Mascotas', 'huella', 'veterinario, mascota, perro, gato'],
  ['Casa y arreglos', 'herramienta', 'ferretería, fontanero, obra'],
  ['Jardín', 'planta', 'jardín, plantas, maceta'],
  ['Bebé', 'biberon', 'pañales, bebé, niño']
];

/**
 * Categories that changed name after a spreadsheet already had them.
 *
 * `Vivienda` became `Hogar` because that is what the two of them call it, and
 * because the cleaning and the transfer that pays the mortgage belong in the same
 * bucket as the mortgage. Applied only when the old name is on the tab and the
 * new one is not, so it happens once and re-running it does nothing.
 *
 * Two categories both meaning "the house" would be worse than either name: every
 * row filed after the change would land in one of them at random.
 */
var CATEGORY_RENAMES = [
  ['Vivienda', 'Hogar'],
  // `Colegio` held a private tutor, the English lessons and the violin. They
  // called it educación five times over before I stopped calling it a school.
  ['Colegio', 'Educación']
];
