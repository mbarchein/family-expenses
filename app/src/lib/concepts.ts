import { fold } from './icons'
import type { Entry, Suggestion } from '../api/types'

/**
 * Every concept this app can offer, in the order it should offer them.
 *
 * The written-down ones first — the Sugerencias tab is a decision somebody made
 * on purpose — then the backend's ranking of what gets apuntado most, then
 * whatever is in the list on this phone. That last one matters more than it
 * looks: the backend's vocabulary comes from the sheet, so a concept apuntado a
 * minute ago, or one still sitting in the outbound queue with no signal, would
 * not be in it. It is on screen, so it has to be offerable.
 *
 * Deduplicated by `fold`, which is the app's own case- and accent-blind key:
 * `Farmacia` and `farmacia` are not two entries in a list whose whole job is to
 * stop the ledger growing a second spelling of a word it already has.
 *
 * The concept grid on the second step builds its own version of this with icons
 * and pinning, because it is a grid of tiles rather than a list of words. This is
 * for the two screens that use a `datalist` — editing a gasto, writing a fijo.
 */
export function knownConcepts(
  frequent: readonly { concept: string }[],
  entries: readonly Entry[],
  suggestions: readonly Suggestion[],
): string[] {
  const seen = new Set<string>()
  const all: string[] = []

  const add = (concept: string) => {
    const key = fold(concept)
    if (!key || seen.has(key)) return
    seen.add(key)
    all.push(concept)
  }

  for (const item of suggestions) if (item.kind === 'concept') add(item.text)
  for (const chip of frequent) add(chip.concept)
  // Voided rows are skipped: their concept is struck through in the list and
  // offering it back is offering a word that was taken back.
  for (const entry of entries) if (!entry.voided) add(entry.concept)

  return all
}
