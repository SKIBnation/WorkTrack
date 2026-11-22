import { describe, expect, it } from 'vitest'
import { isForgottenClockOut, shiftEndedAt, suggestedClockOut } from '../lib/forgotten.ts'
import type { Shift } from '../types.ts'

const HOUR = 3_600_000
const start = Date.parse('2026-11-21T08:00:00.000Z')

function shift(partial: Partial<Shift> = {}): Shift {
  return {
    id: 'open',
    clockIn: new Date(start).toISOString(),
    clockOut: null,
    breaks: [],
    hourlyRate: 12,
    currency: 'GBP',
    overtimeMode: 'multiplier',
    overtimeMultiplier: 1.5,
    overtimeRate: 18,
    overtimeMethod: 'weekly',
    normalDailyHours: 8,
    normalWeeklyHours: 40,
    createdAt: new Date(start).toISOString(),
    updatedAt: new Date(start).toISOString(),
    ...partial,
  }
}

describe('forgotten clock-out', () => {
  it('asks after a normal day plus two hours, and never before 8 or after 16', () => {
    expect(isForgottenClockOut(new Date(start).toISOString(), 8, start + 10 * HOUR - 1)).toBe(false)
    expect(isForgottenClockOut(new Date(start).toISOString(), 8, start + 10 * HOUR)).toBe(true)
    expect(isForgottenClockOut(new Date(start).toISOString(), 12, start + 14 * HOUR)).toBe(true)
    expect(isForgottenClockOut(new Date(start).toISOString(), 12, start + 13 * HOUR)).toBe(false)
    expect(isForgottenClockOut(new Date(start).toISOString(), 4, start + 8 * HOUR)).toBe(true)
    expect(isForgottenClockOut(new Date(start).toISOString(), 20, start + 16 * HOUR)).toBe(true)
    expect(isForgottenClockOut(new Date(start).toISOString(), 0, start + 10 * HOUR)).toBe(true)
  })

  it('suggests the usual finish when that time has already passed', () => {
    expect(suggestedClockOut(new Date(start).toISOString(), 8, start + 12 * HOUR)).toBe(start + 8 * HOUR)
    expect(suggestedClockOut(new Date(start).toISOString(), 12, start + 10 * HOUR)).toBe(start + 10 * HOUR)
  })

  it('ends an open break at the chosen time and drops a break that starts after it', () => {
    const ended = shiftEndedAt(
      shift({
        breaks: [
          { id: 'open', minutes: 0, start: new Date(start + 3 * HOUR).toISOString(), end: null },
          { id: 'late', minutes: 10, start: new Date(start + 9 * HOUR).toISOString(), end: null },
          { id: 'flat', minutes: 15, start: null, end: null },
        ],
      }),
      start + 8 * HOUR,
    )
    expect(ended.clockOut).toBe(new Date(start + 8 * HOUR).toISOString())
    expect(ended.breaks.map((entry) => entry.id)).toEqual(['open', 'flat'])
    expect(ended.breaks[0]?.end).toBe(new Date(start + 8 * HOUR).toISOString())
    expect(ended.breaks[0]?.minutes).toBe(5 * 60)
  })
})