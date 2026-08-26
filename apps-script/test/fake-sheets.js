/**
 * Enough of Google's runtime to run the backend in Node.
 *
 * Every browser test in this repository stubs the API, which means the backend's
 * own answer — the JSON the app is handed on every open — was checked by nobody.
 * That is how a change to `readTail_` and a new `Fixed.js` reached a phone with
 * only a `node --check` between them and the two people using this app.
 *
 * These fakes are the smallest thing that makes `handleBootstrap_` runnable: a
 * sheet is an array of rows, a range is a view over it, and everything that
 * writes records what it was asked to write so a test can assert it. It is not a
 * simulation of Sheets and does not try to be — it is a way to find out whether
 * the code parses, runs, and returns the shape the app expects.
 */

/**
 * The ledger's header row, and how wide a row is.
 *
 * Here rather than copied into each test file: `categoría` and `forma de pago`
 * were appended as columns H and I, and three fixtures declaring their own seven
 * columns is three places for the next one to be forgotten.
 */
const LEDGER_HEADERS = [
  'Fecha', 'Concepto', 'Viqui', 'Mario', 'diferencia', 'observaciones', 'id',
  'categoría', 'forma de pago'
]
const LEDGER_COLS = LEDGER_HEADERS.length

/** The Fijos tab's header row. `categoría` was appended after `último`, so that
 *  `fixedDone` keeps writing to the same column it always has. */
const FIXED_HEADERS_ROW = [
  'concepto', 'importe', 'dia', 'persona', 'periodicidad', 'activo', 'desde', 'último',
  'categoría'
]

function sheet(name, values, maxColumns, formulas) {
  var writes = []
  // Keyed 'row,column'. Empty for almost every test, and the point of the one
  // where it is not: a range written back as values would replace a formula
  // with whatever it happened to evaluate to.
  var byCell = formulas || {}
  return {
    name: name,
    values: values,
    writes: writes,
    formulas: byCell,
    getName: function () { return name },
    getMaxRows: function () { return values.length + 500 },
    getMaxColumns: function () { return maxColumns || 26 },
    getLastRow: function () { return values.length },
    getLastColumn: function () { return (values[0] || []).length },
    setColumnWidth: function () {},
    deleteRow: function (row) {
      writes.push({ deleted: row })
      values.splice(row - 1, 1)
    },
    getRange: function (row, column, rows, columns) {
      var height = rows || 1
      var width = columns || 1
      return {
        getValue: function () { return cell(values, row, column) },
        getValues: function () {
          var out = []
          for (var i = 0; i < height; i++) {
            var line = []
            for (var j = 0; j < width; j++) line.push(cell(values, row + i, column + j))
            out.push(line)
          }
          return out
        },
        setValue: function (value) {
          writes.push({ row: row, column: column, values: [[value]] })
          put(values, row, column, value)
          return this
        },
        setValues: function (block) {
          writes.push({ row: row, column: column, values: block })
          for (var i = 0; i < block.length; i++) {
            for (var j = 0; j < block[i].length; j++) put(values, row + i, column + j, block[i][j])
          }
          return this
        },
        getNextDataCell: function () { return { getRow: function () { return values.length } } },
        getFormula: function () { return '=SUM($C$2:C2)-SUM($D$2:D2)' },
        getFormulas: function () {
          var out = []
          for (var i = 0; i < height; i++) {
            var line = []
            for (var j = 0; j < width; j++) {
              line.push(byCell[(row + i) + ',' + (column + j)] || '')
            }
            out.push(line)
          }
          return out
        },
        clearContent: function () {
          writes.push({ row: row, column: column, values: [['']] })
          for (var i = 0; i < height; i++) {
            for (var j = 0; j < width; j++) put(values, row + i, column + j, '')
          }
          return this
        },
        copyTo: function () { return this },
        setNumberFormat: function () { return this },
        setNote: function () { return this },
        setFontWeight: function () { return this },
        setDataValidation: function () { return this },
      }
    },
  }
}

function cell(values, row, column) {
  var line = values[row - 1] || []
  var value = line[column - 1]
  return value === undefined ? '' : value
}

function put(values, row, column, value) {
  while (values.length < row) values.push([])
  var line = values[row - 1]
  while (line.length < column) line.push('')
  line[column - 1] = value
}

/** Installs the globals the sources reach for. Returns the sheets by name. */
function install(sheets, options) {
  var settings = options || {}
  global.SpreadsheetApp = {
    // Only the member the append reads. `copyTo` here is a no-op that records
    // nothing, which is right: what it copies is *formatting*, and a fake with
    // no formatting cannot have an opinion about it. What matters is that the
    // call does not throw, since it sits between the two writes that do count.
    CopyPasteType: { PASTE_FORMAT: 'format', PASTE_NORMAL: 'normal' },
    getActiveSpreadsheet: function () {
      return {
        getId: function () { return 'sheet-id' },
        getSheetByName: function (wanted) { return sheets[wanted] || null },
        getSheets: function () {
          return Object.keys(sheets).map(function (key) { return sheets[key] })
        },
        insertSheet: function (wanted) {
          sheets[wanted] = sheet(wanted, [], 26)
          return sheets[wanted]
        },
        flush: function () {},
        getEditors: function () {
          return (settings.editors || ['mario@example.com']).map(function (email) {
            return { getEmail: function () { return email } }
          })
        },
        getOwner: function () {
          return { getEmail: function () { return settings.owner || 'mario@example.com' } }
        },
      }
    },
    flush: function () {},
    Direction: { UP: 'up' },
    newDataValidation: function () {
      return { requireValueInList: function () { return { build: function () { return {} } } } }
    },
  }

  global.Session = {
    getScriptTimeZone: function () { return 'Europe/Madrid' },
    getActiveUser: function () { return { getEmail: function () { return 'mario@example.com' } } },
  }
  global.Utilities = {
    // The format string used to be ignored, which was fine while every caller
    // asked for a date — and a lie the moment one asked for the time, which the
    // rename log does: "when" is the whole point of an audit row.
    formatDate: function (date, zone, pattern) {
      var pad = function (n) { return n < 10 ? '0' + n : String(n) }
      var out = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
      if (String(pattern || '').indexOf('HH:mm') !== -1) {
        out += ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
      }
      return out
    },
    base64Encode: function (value) { return Buffer.from(String(value)).toString('base64') },
  }
  // Absent until the first writer with a lock was tested, which is to say: every
  // function in the backend that takes one had never run in here at all.
  global.LockService = {
    getScriptLock: function () {
      return {
        waitLock: function () { settings.locks = (settings.locks || 0) + 1 },
        releaseLock: function () { settings.released = (settings.released || 0) + 1 },
      }
    },
  }
  global.CacheService = {
    getScriptCache: function () { return { get: function () { return null }, put: function () {} } },
  }
  global.PropertiesService = {
    getScriptProperties: function () {
      return { getProperty: function () { return null }, setProperty: function () {} }
    },
  }
  global.ContentService = {
    createTextOutput: function (text) {
      return { setMimeType: function () { return { getContent: function () { return text } } } }
    },
    MimeType: { JSON: 'json' },
  }
  global.Logger = { log: function () {} }
  return sheets
}

/** Evaluates the real sources into this process, in dependency order. */
function load() {
  var fs = require('fs')
  var path = require('path')
  var dir = path.join(__dirname, '..')
  // Every backend source, in the order Apps Script would see them. A file left
  // out of this list is a file no test runs, which is how Auth.js — including the
  // function that decides who may use the app — went untested for weeks.
  var files = [
    'Config.js', 'Categories.js', 'Ledger.js', 'Fixed.js', 'Auth.js', 'Api.js', 'Setup.js'
  ]
  var source = files
    .filter(function (file) { return fs.existsSync(path.join(dir, file)) })
    .map(function (file) { return fs.readFileSync(path.join(dir, file), 'utf8') })
    .join('\n;\n')
  // Indirect eval, so the declarations land as globals and the sources can see
  // each other exactly as they do in Apps Script.
  ;(0, eval)(source)
}

module.exports = {
  sheet: sheet, install: install, load: load,
  LEDGER_HEADERS: LEDGER_HEADERS, LEDGER_COLS: LEDGER_COLS,
  FIXED_HEADERS_ROW: FIXED_HEADERS_ROW
}
