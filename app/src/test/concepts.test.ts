import { describe, expect, it } from 'vitest'
import { knownConcepts } from '../lib/concepts'
import type { Entry, Suggestion } from '../api/types'

const entry = (concept: string, voided = false): Entry => ({
  row: 1, id: concept, date: '2026-08-01', concept, amount: 10, payer: 0,
  note: '', category: '', method: '', voided,
})

const suggestion = (text: string, kind: Suggestion['kind'] = 'concept'): Suggestion =>
  ({ text, kind, person: null })

describe('knownConcepts', () => {
  it('puts the written-down ones first, then the ranking, then the ledger', () => {
    const all = knownConcepts(
      [{ concept: 'super' }],
      [entry('lo del jueves')],
      [suggestion('farmacia')],
    )

    expect(all).toEqual(['farmacia', 'super', 'lo del jueves'])
  })

  it('offers a concept apuntado a minute ago, which the backend has not seen', () => {
    // The window comes from the sheet, so a row still in the outbound queue is
    // not in it. It is on screen, so it has to be offerable.
    expect(knownConcepts([], [entry('ferretería')], [])).toEqual(['ferretería'])
  })

  it('is blind to case and accents, like everything else that compares concepts', () => {
    // The whole point of the list is to stop a second spelling of a word the
    // ledger already has; offering both spellings would be helping it happen.
    const all = knownConcepts([{ concept: 'Farmacia' }], [entry('farmacía')], [])
    expect(all).toEqual(['Farmacia'])
  })

  it('leaves out the methods and the notes, and the voided rows', () => {
    // The Sugerencias tab holds three kinds in one list, and a voided row's
    // concept is one that was taken back.
    const all = knownConcepts(
      [], [entry('anulado', true)],
      [suggestion('Tarjeta BBVA', 'method'), suggestion('a medias', 'note')],
    )
    expect(all).toEqual([])
  })
})
