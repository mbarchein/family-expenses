/**
 * Subsequence matching, for filtering the concept chips as somebody types.
 *
 * Not a library. What is needed here is small and specific: two lists of
 * concepts, at most a few dozen entries, matched against three or four letters
 * typed with a thumb. A dependency for that would be more code shipped to a
 * phone than the code it replaces.
 *
 * The scoring is what makes it feel like search rather than filtering. Typing
 * `sup` has to put "supermercado" above "compra suelta" — both contain those
 * letters in order — so runs of adjacent characters and matches at the start of
 * a word are worth more than scattered hits, and a short entry that used most of
 * itself beats a long one that used a corner.
 */

/** Lowercased and stripped of accents: nobody searching on a phone types the
 *  accent, and `café` and `cafe` are the same concept. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * The items whose text contains the query as a subsequence, best match first.
 *
 * An empty query returns everything, unchanged: the order it arrived in already
 * means something — frequency × recency for the history, and the order the two
 * of them wrote it down for the Sugerencias tab.
 */
export function fuzzyFilter<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  const needle = fold(query.trim())
  if (!needle) return [...items]

  return items
    .map((item, index) => ({ item, index, score: score(fold(text(item)), needle) }))
    .filter(entry => entry.score !== null)
    // Ties fall back to the incoming order rather than to whatever sort() feels
    // like, so the ranking is stable across keystrokes.
    .sort((a, b) => (b.score! - a.score!) || (a.index - b.index))
    .map(entry => entry.item)
}

/** How well `haystack` matches, or null when it does not contain the needle in
 *  order at all. */
function score(haystack: string, needle: string): number | null {
  let total = 0
  let from = 0
  let previous = -2

  for (const character of needle) {
    const at = haystack.indexOf(character, from)
    if (at === -1) return null

    total += 1
    if (at === previous + 1) total += 3     // part of a run
    if (at === 0 || haystack[at - 1] === ' ') total += 2  // start of a word
    from = at + 1
    previous = at
  }

  // Length as a mild penalty, not a decision: it separates "luz" from
  // "lavandería y luz" without ever outweighing a run.
  return total - haystack.length * 0.05
}
