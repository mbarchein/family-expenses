import { describe, expect, it } from 'vitest'
import { AVATARS, AVATAR_NAMES, isAvatarName } from '../components/Avatar'
import { T } from '../i18n/strings'

describe('the portraits', () => {
  it('are eight, and every one of them draws something', () => {
    expect(AVATAR_NAMES).toHaveLength(8)
    for (const name of AVATAR_NAMES) expect(AVATARS[name]).toBeTruthy()
  })

  it('all have a name somebody can read', () => {
    // The picker shows the painting rather than the code name. A face with no
    // entry here would arrive in the list called `monalisa`.
    for (const name of AVATAR_NAMES) {
      expect(T.icons.paintings[name], name).toBeTruthy()
    }
  })

  it('refuses a name it does not draw', () => {
    // What a stored choice becomes after a rename: not an empty square on the
    // button that says who paid.
    expect(isAvatarName('monalisa')).toBe(true)
    expect(isAvatarName('long')).toBe(false)
    expect(isAvatarName('')).toBe(false)
  })
})
