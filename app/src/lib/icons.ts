import { isIconName, type IconName } from '../components/Icon'

/**
 * Which icon a concept gets, in three tries.
 *
 * 1. **What you chose**, in the icon menu on the second step. Nothing here can
 *    be more right than that, so it wins outright.
 * 2. **This table**, a guess from the words in the concept. It has to exist
 *    because most concepts never pass through any menu: the ones the history
 *    throws up were typed into a row months ago and nobody is going to sit down
 *    and label eighty of them.
 * 3. **Nothing**, and the tile shows the concept's initial instead. A guess that
 *    misses is worse than no guess: a shopping basket on the electricity bill is
 *    a small lie printed on the fast path, every time.
 *
 * Deliberately not clever and deliberately not learned. An icon that changes on
 * a concept over time is worse than no icon: the tiles are recognised by shape
 * before they are read, and that only works if the shape holds still.
 */

/** Longest first, so `gasolina` is matched before `gas` — the whole reason this
 *  is sorted rather than written in a readable order. */
const KEYWORDS: Array<[string, IconName]> = ([
  ['supermercado', 'cesta'], ['mercado', 'cesta'], ['super', 'cesta'], ['compra', 'cesta'],
  ['farmacia', 'salud'], ['medicina', 'salud'], ['medicamento', 'salud'],
  ['dentista', 'salud'], ['medico', 'salud'], ['clinica', 'salud'], ['optica', 'salud'],
  ['gasolinera', 'combustible'], ['gasolina', 'combustible'], ['gasoil', 'combustible'],
  ['combustible', 'combustible'], ['diesel', 'combustible'],
  ['electricidad', 'bombilla'], ['luz', 'bombilla'],
  ['agua', 'gota'],
  ['calefaccion', 'llama'], ['butano', 'llama'], ['gas', 'llama'],
  ['internet', 'senal'], ['fibra', 'senal'], ['telefono', 'senal'], ['movil', 'movil'],
  ['hipoteca', 'casa'], ['alquiler', 'casa'], ['comunidad', 'casa'], ['piso', 'casa'],
  ['seguro', 'escudo'],
  ['restaurante', 'cubiertos'], ['comida', 'cubiertos'], ['cena', 'cubiertos'],
  ['menu', 'cubiertos'], ['tapas', 'cubiertos'], ['comedor', 'cubiertos'],
  ['cafeteria', 'taza'], ['cafe', 'taza'], ['desayuno', 'taza'], ['bar', 'taza'],
  // `pan` and `panadería` are the second and third most used concepts on this
  // ledger, at 140 rows and 12. `cafetería` is spelled out because `cafe` is
  // short enough to be matched as a whole word now, and the two are one concept.
  ['panaderia', 'pan'], ['pan', 'pan'],
  ['ropa', 'camiseta'], ['zapatos', 'camiseta'], ['zara', 'camiseta'],
  ['regalo', 'regalo'], ['cumpleanos', 'regalo'], ['flores', 'regalo'],
  ['libreria', 'libro'], ['libro', 'libro'], ['colegio', 'libro'], ['escuela', 'libro'],
  ['guarderia', 'libro'], ['curso', 'libro'],
  ['vacaciones', 'maleta'], ['hotel', 'maleta'], ['viaje', 'maleta'],
  ['autobus', 'bus'], ['tren', 'bus'], ['metro', 'bus'], ['taxi', 'bus'], ['billete', 'bus'],
  ['veterinario', 'huella'], ['mascota', 'huella'], ['perro', 'huella'], ['gato', 'huella'],
  ['ferreteria', 'herramienta'], ['fontanero', 'herramienta'], ['obra', 'herramienta'],
  ['taller', 'coche'], ['coche', 'coche'], ['itv', 'coche'], ['parking', 'coche'],
  ['impuesto', 'recibo'], ['basura', 'recibo'], ['multa', 'recibo'], ['ibi', 'recibo'],
  ['recibo', 'recibo'], ['factura', 'recibo'],
  ['banco', 'banco'], ['comision', 'banco'], ['hucha', 'banco'],
  ['cine', 'entrada'], ['teatro', 'entrada'], ['concierto', 'entrada'], ['ocio', 'entrada'],
  ['loteria', 'entrada'],
  ['peluqueria', 'tijeras'], ['barberia', 'tijeras'],
  ['gimnasio', 'pesa'], ['deporte', 'pesa'], ['padel', 'pesa'],
  ['jardin', 'planta'], ['plantas', 'planta'], ['maceta', 'planta'],
  ['panales', 'biberon'], ['bebe', 'biberon'], ['nino', 'biberon'],
] as Array<[string, IconName]>).sort((a, b) => b[0].length - a[0].length)

/** Lowercased and stripped of accents, the same fold the concept search uses. */
export function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/**
 * The icon for a concept, or null when nothing is better than a wrong one.
 *
 * `chosen` is what the icon menu stored for this concept. It is checked against
 * the set before being trusted: a name that is no longer drawn has to fall
 * through to the guess rather than render an empty square.
 */
export function iconFor(concept: string, chosen?: string): IconName | null {
  if (chosen && isIconName(chosen)) return chosen
  const text = fold(concept)
  if (!text) return null
  for (const [word, icon] of KEYWORDS) if (matches(text, word)) return icon
  return null
}

/** A keyword short enough to hide inside other words. Four characters is where
 *  the list stops being distinctive: `gas`, `bar`, `ropa`, `agua`, `pan`. */
const SHORT = 4

/**
 * Whether a concept contains a keyword as the keyword rather than as letters.
 *
 * A plain substring test was enough while the short words happened not to
 * collide, and it stopped being enough the moment `pan` was added: `pantalones`,
 * `pañuelos` and `compañía` all contain it. Checking the whole list showed four
 * wrong icons already shipped — `gastos varios` was a gas flame, `europa viaje`
 * a t-shirt, `barbacoa` a coffee cup, `aguacates` a water drop.
 *
 * So a short keyword has to be a word of its own, give or take a Spanish
 * plural: `cine` still matches `cines` and `ropa` still matches `ropas`, while
 * `gas` no longer matches `gastos`. Long keywords keep the substring rule, which
 * is what lets `gasolinera` match `gasolina` and `panaderia` match at all.
 */
function matches(text: string, word: string): boolean {
  if (word.length > SHORT) return text.includes(word)
  return text.split(/[^a-z0-9ñ]+/).some(part =>
    part === word || part === `${word}s` || part === `${word}es`)
}

/** What the tile shows when there is no icon: one capital letter. */
export function initialOf(concept: string): string {
  return concept.trim().charAt(0).toUpperCase() || '·'
}
