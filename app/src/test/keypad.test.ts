import { describe, expect, it } from 'vitest'
import { BACKSPACE, pressKey } from '../components/Keypad'

/**
 * The keystroke rules, now that they arrive from two places: the grid of
 * buttons, and a real keyboard on a laptop or paired to the phone. One
 * implementation, so the two cannot disagree about what a third cent is.
 */
describe('pressKey', () => {
  it('appends digits', () => {
    expect(pressKey('', '1')).toBe('1')
    expect(pressKey('12', '5')).toBe('125')
  })

  it('replaces a lone zero rather than growing it', () => {
    expect(pressKey('0', '7')).toBe('7')
  })

  it('opens the cents with a zero when nothing has been typed', () => {
    expect(pressKey('', ',')).toBe('0,')
    expect(pressKey('12', ',')).toBe('12,')
  })

  it('refuses a second separator and a third cent', () => {
    // Returned unchanged, which is how the caller knows not to repaint.
    expect(pressKey('12,5', ',')).toBe('12,5')
    expect(pressKey('12,50', '9')).toBe('12,50')
  })

  it('deletes one character at a time, and stops at empty', () => {
    expect(pressKey('12,5', BACKSPACE)).toBe('12,')
    expect(pressKey('1', BACKSPACE)).toBe('')
    expect(pressKey('', BACKSPACE)).toBe('')
  })
})
