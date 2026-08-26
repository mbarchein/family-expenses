import { describe, expect, it } from 'vitest'
import { alsoWearing, categoryFor, guessCategory, iconOf, iconOfCategory } from '../lib/categories'
import type { Category, Entry } from '../api/types'

/**
 * The app's half of the category rules.
 *
 * It has to agree with `categorise_` in the backend: that pass files two
 * thousand old rows and this files the next one, so a disagreement would mean
 * re-running the pass quietly relabels whatever the app had just saved.
 */

const CATEGORIES: Category[] = [
  { name: 'Supermercado', icon: 'cesta', words: ['supermercado', 'super'] },
  { name: 'Combustible', icon: 'combustible', words: ['gasolinera', 'gasolina'] },
  { name: 'Panadería', icon: 'pan', words: ['panaderia', 'pan'] },
  { name: 'Gas', icon: 'llama', words: ['butano', 'gas'] },
  { name: 'Restaurantes', icon: 'cubiertos', words: ['restaurante', 'cena'] },
  // Two categories, one icon: allowed on purpose, and the app says so rather
  // than refusing.
  { name: 'Cafés y bares', icon: 'cubiertos', words: ['cafeteria'] },
]

function entry(over: Partial<Entry>): Entry {
  return {
    row: 2, id: 'x', date: '2026-08-26', concept: 'pan', amount: 1, payer: 0,
    note: '', category: '', method: '', voided: false, ...over,
  }
}

describe('guessCategory', () => {
  it('finds the category whose words the concept contains', () => {
    expect(guessCategory('supermercado Salobreña', CATEGORIES)).toBe('Supermercado')
    expect(guessCategory('Cena en un bar', CATEGORIES)).toBe('Restaurantes')
  })

  it('makes a short word be a word, not letters inside one', () => {
    // The rule the four already-shipped wrong icons paid for: `gastos varios`
    // was a gas flame and `pantalones` a loaf of bread.
    expect(guessCategory('gastos varios', CATEGORIES)).toBe('')
    expect(guessCategory('pantalones', CATEGORIES)).toBe('')
    expect(guessCategory('gas natural', CATEGORIES)).toBe('Gas')
    expect(guessCategory('panes', CATEGORIES)).toBe('Panadería')
  })

  it('leaves a concept it cannot place unfiled', () => {
    // A wrong category is printed on the row and totalled under a heading. An
    // empty one is a question still open.
    expect(guessCategory('lo del jueves', CATEGORIES)).toBe('')
    expect(guessCategory('', CATEGORIES)).toBe('')
  })
})

describe('categoryFor', () => {
  it('reuses what the same concept was filed as, over any guess', () => {
    // Somebody decided that; a guess does not get to overrule a decision.
    const history = [entry({ concept: 'Cena en un bar', category: 'Comer fuera' })]
    expect(categoryFor('cena en un bar', CATEGORIES, history)).toBe('Comer fuera')
  })

  it('takes the most recent decision when they disagree', () => {
    // `entries` arrives newest first, which is what makes this the answer to
    // "what is it filed as now" rather than "what was it once".
    const history = [
      entry({ concept: 'pan', category: 'Desayunos' }),
      entry({ concept: 'pan', category: 'Panadería' }),
    ]
    expect(categoryFor('pan', CATEGORIES, history)).toBe('Desayunos')
  })

  it('falls back to the words when nothing like it has been filed', () => {
    expect(categoryFor('gasolinera Repsol', CATEGORIES, [])).toBe('Combustible')
  })

  it('ignores history rows that were never filed themselves', () => {
    const history = [entry({ concept: 'pan', category: '' })]
    expect(categoryFor('pan', CATEGORIES, history)).toBe('Panadería')
  })
})

describe('iconOf', () => {
  it('prefers a hand-picked icon over everything', () => {
    expect(iconOf({ concept: 'pan', category: 'Restaurantes' }, CATEGORIES, { pan: 'regalo' }))
      .toBe('regalo')
  })

  it('takes the category icon before guessing from the concept', () => {
    // The point of having categories: `Cena en un bar` says nothing about
    // cutlery, and its category does.
    expect(iconOf({ concept: 'Cena en un bar', category: 'Restaurantes' }, CATEGORIES))
      .toBe('cubiertos')
  })

  it('still guesses from the concept for a row with no category', () => {
    // Which is every row on the sheet until the batch pass has run.
    expect(iconOf({ concept: 'gasolina', category: '' }, CATEGORIES)).toBe('combustible')
  })

  it('ignores an icon name this app cannot draw', () => {
    // A name mistyped in a browser. A blank square is not an answer to "what
    // kind of expense is this", so it falls through to the guess.
    const broken: Category[] = [{ name: 'Cosas', icon: 'cestaa', words: [] }]
    expect(iconOfCategory('Cosas', broken)).toBe(null)
    expect(iconOf({ concept: 'pan', category: 'Cosas' }, broken)).toBe('pan')
  })

  it('is null when nothing has an answer', () => {
    expect(iconOf({ concept: 'lo del jueves', category: '' }, CATEGORIES)).toBe(null)
  })
})

describe('alsoWearing', () => {
  it('names the other categories already using an icon', () => {
    expect(alsoWearing('cubiertos', CATEGORIES, 'Restaurantes')).toEqual(['Cafés y bares'])
  })

  it('does not count the category being edited', () => {
    expect(alsoWearing('cesta', CATEGORIES, 'Supermercado')).toEqual([])
  })
})
