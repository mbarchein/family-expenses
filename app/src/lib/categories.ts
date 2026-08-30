import { isIconName, type IconName } from '../components/Icon'
import type { Category, Entry } from '../api/types'
import { fold, iconFor, wordMatches } from './icons'

/**
 * Which category an expense belongs to, and which icon that category wears.
 *
 * A concept is what somebody typed — "Cena en un bar" — and a category is the
 * bucket — Restaurantes. The split is what makes a total by kind possible without
 * first agreeing on a spelling, which 720 distinct concepts over 2,318 rows had
 * no answer to.
 *
 * The categories themselves live in the spreadsheet, on the Categorías tab, so
 * this file holds no list of its own: only the rules for reading one.
 */

/**
 * The category to suggest for a concept, in the same order the batch pass uses.
 *
 * 1. **What this concept was filed as before.** If `Cena en un bar` already sits
 *    under Restaurantes on some row, the next one saying the same thing belongs
 *    there too, whatever the words think — somebody decided that, and a guess
 *    does not get to overrule a decision.
 * 2. **The words on the tab.** A guess, and the only guess.
 * 3. **Nothing.** Deliberately: a category gets printed on the row and totalled
 *    under a heading, so a wrong one is worse than an empty one, and this is a
 *    suggestion nobody has confirmed yet.
 *
 * Keeping this in step with `categorise_` in the backend is the point. The batch
 * pass files two thousand old rows and this files the next one; if they disagreed,
 * re-running the pass would quietly relabel what the app had just saved.
 */
export function categoryFor(concept: string, categories: readonly Category[],
                            entries: readonly Entry[]): string {
  const key = fold(concept)
  if (!key) return ''

  // Newest first, which is what "what it was filed as" means when the answer has
  // changed: `entries` arrives sorted by date descending.
  for (const entry of entries) {
    if (entry.category && fold(entry.concept) === key) return entry.category
  }
  return guessCategory(concept, categories)
}

/** The first category whose words the concept contains, or ''. */
export function guessCategory(concept: string, categories: readonly Category[]): string {
  const text = fold(concept).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  // The exact words first, then the longest ordinary one — in both cases because
  // the more specific claim wins, and it has to win wherever its row happens to
  // sit on the tab. `inglés` under Educación would otherwise take `El Corte
  // Inglés`, a department store, purely because one row is above another. Same
  // two passes as the backend, and they have to stay the same: that one files two
  // thousand old rows and this one files the next.
  for (const category of categories) {
    for (const word of category.words) {
      if (word.startsWith('=') && matchesWord(text, word)) return category.name
    }
  }

  let best = { name: '', word: '' }
  for (const category of categories) {
    for (const word of category.words) {
      if (word.startsWith('=') || word.length <= best.word.length) continue
      if (matchesWord(text, word)) best = { name: category.name, word }
    }
  }
  return best.name
}

/**
 * `=algo` on the tab matches only when the whole concept is `algo`.
 *
 * One real case with no other answer: `maria` on its own is the cleaner being
 * paid, and `regalo maría` is a present for somebody called María. As an ordinary
 * word it would take both — and it would take the present, because the category
 * holding it sits higher on the tab. A category order nobody chose is not a good
 * reason for a row to mean something else.
 *
 * The same rule as `wordMatches_` in the backend, and it has to stay the same
 * rule: that pass files two thousand old rows and this files the next one.
 */
function matchesWord(text: string, word: string): boolean {
  if (word.startsWith('=')) return text === word.slice(1)
  return wordMatches(text, word)
}

/** The icon a category wears, or null when the tab names one this app cannot
 *  draw — a name can be mistyped in a browser, and a blank square is not an
 *  answer to "what kind of expense is this". */
export function iconOfCategory(name: string, categories: readonly Category[]): IconName | null {
  if (!name) return null
  const key = fold(name)
  const found = categories.find(category => fold(category.name) === key)
  return found && isIconName(found.icon) ? found.icon : null
}

/**
 * The icon for a row, from the best answer available.
 *
 * 1. What somebody chose by hand for this concept, which nothing may overrule.
 * 2. The icon of its category, which is the point of having categories.
 * 3. The app's own keyword guess from the concept, for the rows — currently all
 *    of them — that have no category yet.
 */
export function iconOf(entry: { concept: string; category?: string },
                       categories: readonly Category[],
                       chosen: Record<string, string> = {}): IconName | null {
  const hand = chosen[fold(entry.concept)]
  if (hand && isIconName(hand)) return hand
  return iconOfCategory(entry.category ?? '', categories) ?? iconFor(entry.concept)
}

/** The categories that already wear an icon, other than the one being edited.
 *  Several categories may share an icon; the app says so rather than refusing. */
export function alsoWearing(icon: string, categories: readonly Category[],
                            except: string): string[] {
  const skip = fold(except)
  return categories
    .filter(category => category.icon === icon && fold(category.name) !== skip)
    .map(category => category.name)
}
