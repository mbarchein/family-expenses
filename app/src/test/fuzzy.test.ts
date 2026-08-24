import { describe, expect, it } from 'vitest'
import { fuzzyFilter } from '../lib/fuzzy'

const CONCEPTS = [
  'supermercado',
  'compra suelta',
  'seguro del piso',
  'gasolina',
  'luz',
  'lavandería y luz',
  'café',
  'comedor febrero',
]

const search = (query: string) => fuzzyFilter(CONCEPTS, query, concept => concept)

describe('fuzzyFilter', () => {
  it('leaves the list alone when nothing has been typed', () => {
    // The incoming order already means something: frequency × recency for the
    // history, and the order the two of them wrote it down for the sheet.
    expect(search('')).toEqual(CONCEPTS)
    expect(search('   ')).toEqual(CONCEPTS)
  })

  it('puts the run of adjacent letters first', () => {
    // Both contain s, u and p in that order — "seguro del piso" scattered
    // across three words, "supermercado" as a run at the front. The run wins,
    // and that is the difference between search and filtering.
    const results = search('sup')
    expect(results[0]).toBe('supermercado')
    expect(results).toContain('seguro del piso')
    // "compra suelta" has its p before its s, so it is not a match at all:
    // order is the whole point of a subsequence.
    expect(results).not.toContain('compra suelta')
  })

  it('prefers the shorter entry when the match is otherwise the same', () => {
    expect(search('luz')[0]).toBe('luz')
  })

  it('ignores accents and capitals in both directions', () => {
    expect(search('cafe')).toContain('café')
    expect(search('CAFÉ')).toContain('café')
    expect(fuzzyFilter(['CAFÉ'], 'cafe', text => text)).toEqual(['CAFÉ'])
  })

  it('drops anything that does not contain the letters in order', () => {
    // 'z' before 'u' exists in neither, and "zul" is not "luz" backwards by
    // accident: order is the whole point of a subsequence.
    expect(search('zul')).toEqual([])
    expect(search('xyz')).toEqual([])
  })

  it('matches across words', () => {
    expect(search('comfeb')).toContain('comedor febrero')
  })

  it('finds an entry from a typo that skips a letter', () => {
    // The reason this is a subsequence match and not a substring one: a thumb
    // on a phone drops letters.
    expect(search('sper')).toContain('supermercado')
  })

  it('does not invent matches for the empty haystack', () => {
    expect(fuzzyFilter([''], 'a', text => text)).toEqual([])
  })
})
