import { useCallback, useEffect, useState } from 'react'
import { idb } from './db'
import { isAvatarName, type AvatarName } from '../components/Avatar'

/**
 * Which face stands for which of the two people, on this device.
 *
 * Local, and the same reasoning as the concept icons next door: the sheet is the
 * ledger, and this is a preference about how a button looks. It also has no
 * right answer to share — if one of them wants a beard on the other one's
 * button, that is between them and their own phone.
 *
 * Stored in the `icons` store under its own key, which is why this needed no
 * database version: that store is key to value, and a fifth store for two
 * strings would be an upgrade for nothing.
 */
const KEY = 'avatars'

/**
 * Where it starts before anybody chooses. Two portraits that are nothing like
 * each other at button size, which is the only property a default needs: nobody
 * is being told they look like a Leonardo or a Van Gogh, and one tap in the icons
 * menu changes either of them.
 */
const DEFAULTS: [AvatarName, AvatarName] = ['monalisa', 'vangogh']

export interface Avatars {
  /** By person index, always a face this set draws. */
  faces: [AvatarName, AvatarName]
  ready: boolean
  choose: (person: 0 | 1, face: AvatarName) => void
}

export function useAvatars(): Avatars {
  const [faces, setFaces] = useState<[AvatarName, AvatarName]>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await idb.get<unknown>('icons', KEY)
      if (cancelled) return
      setFaces(sanitise(stored))
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  const choose = useCallback((person: 0 | 1, face: AvatarName) => {
    setFaces(current => {
      const next: [AvatarName, AvatarName] = [...current]
      next[person] = face
      // Not awaited, like the icon choices and the draft: a picker that waited
      // for IndexedDB before repainting would look like it was thinking about a
      // decision already made on screen.
      void idb.set('icons', KEY, next)
      return next
    })
  }, [])

  return { faces, ready, choose }
}

/** A stored pair is only trusted as far as the drawings go: a name that was
 *  renamed or removed has to fall back to the default rather than leave an empty
 *  square on the button that says who paid. */
function sanitise(stored: unknown): [AvatarName, AvatarName] {
  const pair = Array.isArray(stored) ? stored : []
  return [
    typeof pair[0] === 'string' && isAvatarName(pair[0]) ? pair[0] : DEFAULTS[0],
    typeof pair[1] === 'string' && isAvatarName(pair[1]) ? pair[1] : DEFAULTS[1],
  ]
}
