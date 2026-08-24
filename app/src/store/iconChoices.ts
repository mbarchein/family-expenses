import { useCallback, useEffect, useState } from 'react'
import { idb } from './db'
import { fold } from '../lib/icons'

/**
 * The icons chosen by hand, on this device.
 *
 * One record, concept to icon name, keyed by the folded concept so that "Super"
 * and "super" are one thing — the same fold the concept search uses, for the
 * same reason.
 *
 * Local and not in the spreadsheet, which is a choice worth naming: the sheet is
 * the ledger and this is a preference about how a button looks. Putting it there
 * would mean a column, a round trip and a queue for something that has to happen
 * the instant a thumb lifts, and would give the two of them one shared answer to
 * a question that has no wrong answer. Each phone keeps its own.
 */
export interface IconChoices {
  /** Folded concept → icon name. */
  chosen: Record<string, string>
  ready: boolean
  /** `null` forgets the choice, which is not the same as choosing nothing: the
   *  guess from the keywords comes back. */
  choose: (concept: string, icon: string | null) => void
}

const KEY = 'chosen'

export function useIconChoices(): IconChoices {
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await idb.get<Record<string, string>>('icons', KEY)
      if (cancelled) return
      setChosen(stored && typeof stored === 'object' ? stored : {})
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  const choose = useCallback((concept: string, icon: string | null) => {
    const key = fold(concept)
    if (!key) return
    setChosen(current => {
      const next = { ...current }
      if (icon) next[key] = icon
      else delete next[key]
      // Not awaited, like the draft: a picker that waited for IndexedDB before
      // repainting would feel like it was thinking about a decision that is
      // already made on screen.
      void idb.set('icons', KEY, next)
      return next
    })
  }, [])

  return { chosen, ready, choose }
}
