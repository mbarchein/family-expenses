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
      words: splitWords_(row[2])
    });
  });
  return { items: items, missing: false };
}

/** `pan, panadería` as ['pan', 'panaderia'], folded, longest first. Matching a
 *  concept walks this list in order, so `gasolina` has to be tried before `gas`. */
function splitWords_(raw) {
  return String(raw == null ? '' : raw)
    .split(/[,;\n]/)
    .map(function (word) { return fold_(word).replace(/\s+/g, ' ').trim(); })
    .filter(function (word) { return word; })
    .sort(function (a, b) { return b.length - a.length; });
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

  for (var i = 0; i < categories.length; i++) {
    var words = categories[i].words;
    for (var j = 0; j < words.length; j++) {
      if (wordMatches_(text, parts, words[j])) return categories[i].name;
    }
  }
  return '';
}

function wordMatches_(text, parts, word) {
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
  ['Supermercado', 'cesta', 'supermercado, mercado, super, compra'],
  ['Panadería', 'pan', 'panadería, pan'],
  ['Restaurantes', 'cubiertos', 'restaurante, comida, cena, menú, tapas, comedor'],
  ['Cafés y bares', 'taza', 'cafetería, café, desayuno, bar'],
  ['Salud', 'salud', 'farmacia, medicina, medicamento, dentista, médico, clínica, óptica'],
  ['Combustible', 'combustible', 'gasolinera, gasolina, gasoil, combustible, diésel'],
  ['Coche', 'coche', 'taller, coche, itv, parking'],
  ['Transporte', 'bus', 'autobús, tren, metro, taxi, billete'],
  ['Luz', 'bombilla', 'electricidad, luz'],
  ['Agua', 'gota', 'agua'],
  ['Gas', 'llama', 'calefacción, butano, gas'],
  ['Internet y teléfono', 'senal', 'internet, fibra, teléfono'],
  ['Móvil', 'movil', 'móvil'],
  ['Vivienda', 'casa', 'hipoteca, alquiler, comunidad, piso'],
  ['Seguros', 'escudo', 'seguro'],
  ['Impuestos y recibos', 'recibo', 'impuesto, basura, multa, ibi, recibo, factura'],
  ['Banco', 'banco', 'banco, comisión, hucha'],
  ['Colegio', 'mochila', 'escolar, colegio, escuela, guardería, instituto, ampa'],
  ['Libros', 'libro', 'librería, libro, curso'],
  ['Ropa', 'camiseta', 'ropa, zapatos'],
  ['Regalos', 'regalo', 'regalo, cumpleaños, flores'],
  ['Ocio', 'entrada', 'cine, teatro, concierto, ocio, lotería'],
  ['Deporte', 'pesa', 'gimnasio, deporte, pádel'],
  ['Peluquería', 'tijeras', 'peluquería, barbería'],
  ['Viajes', 'maleta', 'vacaciones, hotel, viaje'],
  ['Mascotas', 'huella', 'veterinario, mascota, perro, gato'],
  ['Casa y arreglos', 'herramienta', 'ferretería, fontanero, obra'],
  ['Jardín', 'planta', 'jardín, plantas, maceta'],
  ['Bebé', 'biberon', 'pañales, bebé, niño']
];
