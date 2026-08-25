import { describe, expect, it } from 'vitest'
import { ICON_NAMES, isIconName } from '../components/Icon'
import { fold, iconFor, initialOf } from '../lib/icons'

describe('iconFor', () => {
  it('takes the chosen icon over anything it would have guessed', () => {
    // Somebody picked it in the menu. Nothing here can be more right than that,
    // including a keyword that matches.
    expect(iconFor('supermercado', 'huella')).toBe('huella')
    expect(iconFor('lo del jueves', 'huella')).toBe('huella')
  })

  it('ignores a chosen name the set does not draw', () => {
    // A stored choice outlives a rename. Falling through to the guess is the
    // only outcome that is not an empty square on the fast path.
    expect(iconFor('supermercado', 'no-existe')).toBe('cesta')
    expect(iconFor('lo del jueves', 'no-existe')).toBeNull()
  })

  it('matches the longer keyword first', () => {
    // The reason the table is sorted by length: "gas" is inside "gasolina", and
    // a flame on the petrol is exactly the kind of small lie this must not print.
    expect(iconFor('gasolina')).toBe('combustible')
    expect(iconFor('gas')).toBe('llama')
    expect(iconFor('gas ciudad')).toBe('llama')
  })

  it('finds the word inside a longer concept', () => {
    expect(iconFor('compra del super')).toBe('cesta')
    expect(iconFor('recibo de la luz de julio')).toBe('recibo')
    expect(iconFor('la luz de julio')).toBe('bombilla')
  })

  it('ignores accents and capitals', () => {
    expect(iconFor('Farmacia')).toBe('salud')
    expect(iconFor('PELUQUERÍA')).toBe('tijeras')
    expect(iconFor('café')).toBe('taza')
  })

  it('gives up rather than guessing', () => {
    // A tile with an initial says nothing; a tile with the wrong icon says
    // something false, on the fast path, every time.
    expect(iconFor('lo del jueves')).toBeNull()
    expect(iconFor('')).toBeNull()
    expect(iconFor('   ')).toBeNull()
  })

  it('only ever names an icon the set draws', () => {
    // The table is written by hand and its right-hand column is a name. A typo
    // there would render an empty tile, which is the one thing the initial
    // fallback exists to prevent.
    const guesses = [
      'super', 'farmacia', 'gasolina', 'luz', 'agua', 'gas', 'internet', 'movil',
      'hipoteca', 'seguro', 'cena', 'cafe', 'ropa', 'regalo', 'colegio', 'hotel',
      'tren', 'perro', 'ferreteria', 'coche', 'basura', 'banco', 'cine',
      'peluqueria', 'gimnasio', 'jardin', 'panales', 'comedor',
    ].map(concept => iconFor(concept))

    expect(guesses.every(name => name !== null)).toBe(true)
    for (const name of guesses) expect(isIconName(name!)).toBe(true)
  })
})

describe('fold', () => {
  it('is what makes "Super" and "super" one concept', () => {
    expect(fold('  Súper ')).toBe('super')
    expect(fold('CAFÉ')).toBe('cafe')
  })
})

describe('initialOf', () => {
  it('is one capital letter', () => {
    expect(initialOf('lo del jueves')).toBe('L')
    expect(initialOf('  espacio delante')).toBe('E')
  })

  it('has something to show for an empty concept', () => {
    expect(initialOf('   ')).toBe('·')
  })
})

describe('the icon set', () => {
  it('has every name it says it has', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(20)
    for (const name of ICON_NAMES) expect(isIconName(name)).toBe(true)
    expect(isIconName('no-existe')).toBe(false)
  })
})

describe('a keyword short enough to hide inside another word', () => {
  // `pan` is what forced this: it is inside `pantalones`, `pañuelos` and
  // `compañía`. Checking the rest of the list turned up four icons that were
  // already wrong on any ledger containing these words.
  it('gives bread to the bread and to the baker', () => {
    expect(iconFor('pan')).toBe('pan')
    expect(iconFor('Pan')).toBe('pan')
    expect(iconFor('panes')).toBe('pan')
    expect(iconFor('panadería')).toBe('pan')
    expect(iconFor('Panaderia')).toBe('pan')
    expect(iconFor('pan de pueblo')).toBe('pan')
  })

  it('gives it to nothing that merely contains the letters', () => {
    for (const concept of ['pantalones', 'pañuelos', 'compañía de seguros', 'campana']) {
      expect(iconFor(concept), concept).not.toBe('pan')
    }
    // `pañales` keeps the one it had: a longer keyword wins, as it always did.
    expect(iconFor('pañales')).toBe('biberon')
  })

  it('stops the four that were already wrong', () => {
    // Shipped, and wrong: a gas flame on `gastos varios`, a t-shirt on
    // `europa`, a coffee cup on `barbacoa`, a water drop on `aguacates`.
    expect(iconFor('gastos varios')).not.toBe('llama')
    expect(iconFor('europa viaje')).not.toBe('camiseta')
    expect(iconFor('barbacoa')).not.toBe('taza')
    expect(iconFor('aguacates')).not.toBe('gota')
    expect(iconFor('bebidas')).not.toBe('biberon')
  })

  it('keeps the short keywords working as words, plural included', () => {
    expect(iconFor('gas')).toBe('llama')
    expect(iconFor('gas natural')).toBe('llama')
    expect(iconFor('ropa')).toBe('camiseta')
    expect(iconFor('ropas')).toBe('camiseta')
    expect(iconFor('cine')).toBe('entrada')
    expect(iconFor('cines')).toBe('entrada')
    expect(iconFor('agua')).toBe('gota')
    expect(iconFor('bar')).toBe('taza')
    expect(iconFor('IBI 1')).toBe('recibo')
  })

  it('still lets a long keyword match inside a word', () => {
    // The rule only tightens for short ones: this is what makes `gasolinera`
    // find `gasolina` and `panaderia` find anything at all.
    expect(iconFor('gasolinera Repsol')).toBe('combustible')
    expect(iconFor('supermercado Salobreña')).toBe('cesta')
  })

  it('gives the cup to a cafetería, which is the same concept as a café', () => {
    // Their call, and the reason `cafeteria` is spelled out: `cafe` is short
    // enough to be matched as a whole word now, so it no longer reaches inside.
    expect(iconFor('café')).toBe('taza')
    expect(iconFor('cafetería')).toBe('taza')
  })
})
