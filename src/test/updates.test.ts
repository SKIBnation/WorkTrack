import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { UPDATES } from '../lib/updates.ts'

describe('updates', () => {
  it('lists each change newest first with a real time', () => {
    expect(UPDATES.length).toBeGreaterThan(1)
    const times = UPDATES.map((update) => DateTime.fromISO(update.at, { zone: 'utc' }))
    for (const time of times) expect(time.isValid).toBe(true)
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index - 1].toMillis()).toBeGreaterThan(times[index].toMillis())
    }
    expect(new Set(UPDATES.map((update) => update.title)).size).toBe(UPDATES.length)
  })
})
