import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearFault, fault, progress, report, subscribe } from './progress'

/**
 * The store behind the splash screen. Small, but it is the thing that will
 * report the next hang, so the parts that would silently stop reporting are
 * worth pinning: the identity of the snapshot, and the fault outliving the step.
 */
describe('progress', () => {
  beforeEach(() => {
    report('start')
    clearFault()
  })

  it('reports the step it is on', () => {
    report('sheet')
    expect(progress().step).toBe('sheet')
  })

  it('publishes a new snapshot, so a subscriber sees the change', () => {
    // A mutated snapshot compares equal to itself and repaints nothing, which
    // would be a splash screen that reports the first step for ever.
    const before = progress()
    report('google')
    expect(progress()).not.toBe(before)
  })

  it('tells its subscribers, and only when something changed', () => {
    report('sheet')
    const listener = vi.fn()
    const stop = subscribe(listener)

    report('sheet')
    expect(listener).not.toHaveBeenCalled()

    report('ready')
    expect(listener).toHaveBeenCalledTimes(1)
    stop()

    report('cache')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('restarts the clock on every step, so the seconds are the step\'s own', () => {
    vi.useFakeTimers()
    try {
      report('queue')
      const first = progress().since
      vi.advanceTimersByTime(5000)
      report('sheet')
      expect(progress().since).toBe(first + 5000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the fault across the steps that follow it', () => {
    fault('NETWORK: fetch failed')
    report('sheet')
    // The retry is also slow; the reason the first attempt died is still what
    // the person looking at the screen needs to read.
    expect(progress().fault).toBe('NETWORK: fetch failed')
  })

  it('drops an empty message rather than showing a blank error', () => {
    fault('   ')
    expect(progress().fault).toBe('error')
  })

  it('forgets the fault once something has worked', () => {
    fault('boom')
    clearFault()
    expect(progress().fault).toBeNull()
  })
})
