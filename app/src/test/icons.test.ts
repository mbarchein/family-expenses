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
