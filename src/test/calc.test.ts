import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import type { Schedule, Settings, Shift } from '../types.ts'
import { summarize, totalsFromSlices, validateShift } from '../lib/calc.ts'
import { parseBackup } from '../lib/backup.ts'
import { evaluateReminders } from '../lib/reminders.ts'
import { defaultSettings } from '../lib/settings.ts'
import { instantInZone } from '../lib/time.ts'

const zone = 'Europe/London'

function at(local: string): string {
  const dt = DateTime.fromISO(local, { zone })
  if (!dt.isValid) throw new Error(dt.invalidReason ?? local)
  return dt.toUTC().toISO() ?? ''
}

function ms(local: string): number {
  return DateTime.fromISO(local, { zone }).toMillis()
}

function makeShift(partial: Partial<Shift> & Pick<Shift, 'id' | 'clockIn' | 'clockOut'>): Shift {
  return {
    breaks: [],
    hourlyRate: 12,
    currency: 'GBP',
    overtimeMode: 'multiplier',
    overtimeMultiplier: 1.5,
    overtimeRate: 18,
    overtimeMethod: 'daily',
    normalDailyHours: 8,
    normalWeeklyHours: 40,
    createdAt: partial.clockIn,
    updatedAt: partial.clockIn,
    ...partial,
  }
}

function run(shifts: Shift[], settings: Partial<Settings> = {}, localNow = '2026-11-21T18:00', schedules: Schedule[] = []) {
  return summarize({
    shifts,
    settings: defaultSettings() && { ...defaultSettings(), ...settings, notifications: { ...defaultSettings().notifications, ...settings.notifications }, notificationState: { ...defaultSettings().notificationState, ...settings.notificationState } },
    schedules,
    asOfMs: ms(localNow),
  })
}

describe('paid time', () => {
  it('deducts one unpaid break', () => {
    const summary = run([
      makeShift({
        id: 'a',
        clockIn: at('2026-11-16T09:00'),
        clockOut: at('2026-11-16T17:00'),
        breaks: [{ id: 'b', minutes: 30, start: null, end: null }],
      }),
    ])
    expect(summary.lifetime.paidHours).toBeCloseTo(7.5)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(90)
  })

  it('deducts a timed break and ignores the stored minutes', () => {
    const summary = run([
      makeShift({
        id: 'a',
        clockIn: at('2026-11-16T09:00'),
        clockOut: at('2026-11-16T17:00'),
        breaks: [{ id: 'b', minutes: 999, start: at('2026-11-16T12:00'), end: at('2026-11-16T12:30') }],
      }),
    ])
    expect(summary.lifetime.paidHours).toBeCloseTo(7.5)
  })

  it('counts overlapping breaks once', () => {
    const summary = run([
      makeShift({
        id: 'a',
        clockIn: at('2026-11-16T09:00'),
        clockOut: at('2026-11-16T17:00'),
        breaks: [
          { id: 'b1', minutes: 30, start: at('2026-11-16T12:00'), end: at('2026-11-16T12:30') },
          { id: 'b2', minutes: 30, start: at('2026-11-16T12:15'), end: at('2026-11-16T12:45') },
        ],
      }),
    ])
    expect(summary.lifetime.paidHours).toBeCloseTo(7.25)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(87)
  })

  it('never returns negative pay when breaks exceed the shift', () => {
    const summary = run([
      makeShift({
        id: 'a',
        clockIn: at('2026-11-16T09:00'),
        clockOut: at('2026-11-16T12:00'),
        breaks: [{ id: 'b', minutes: 300, start: null, end: null }],
      }),
    ])
    expect(summary.lifetime.paidHours).toBe(0)
    expect(summary.lifetime.totalEarnings).toBe(0)
  })

  it('pauses pay during an open break and keeps the shift rate', () => {
    const summary = run(
      [
        makeShift({
          id: 'live',
          clockIn: at('2026-11-16T09:00'),
          clockOut: null,
          hourlyRate: 12,
          breaks: [{ id: 'b', minutes: 0, start: at('2026-11-16T11:30'), end: null }],
        }),
      ],
      { hourlyRate: 99 },
      '2026-11-16T12:00',
    )
    expect(summary.status).toBe('break')
    expect(summary.activePaidMs).toBeCloseTo(2.5 * 3_600_000)
    expect(summary.activeEarnings).toBeCloseTo(30)
    expect(summary.activeOpenBreakMs).toBeCloseTo(30 * 60_000)
  })
})

describe('overtime and historical rates', () => {
  it('pays daily overtime with the multiplier', () => {
    const summary = run([
      makeShift({
        id: 'a',
        clockIn: at('2026-11-16T09:00'),
        clockOut: at('2026-11-16T19:00'),
      }),
    ])
    expect(summary.lifetime.normalHours).toBeCloseTo(8)
    expect(summary.lifetime.overtimeHours).toBeCloseTo(2)
    expect(summary.lifetime.normalEarnings).toBeCloseTo(96)
    expect(summary.lifetime.overtimeEarnings).toBeCloseTo(36)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(132)
  })

  it('uses a custom overtime rate when that mode is stored on the shift', () => {
    const summary = run([
      makeShift({
        id: 'a',
        clockIn: at('2026-11-16T09:00'),
        clockOut: at('2026-11-16T19:00'),
        overtimeMode: 'custom',
        overtimeRate: 20,
      }),
    ])
    expect(summary.lifetime.overtimeEarnings).toBeCloseTo(40)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(136)
  })

  it('assigns daily overtime to the later shift', () => {
    const summary = run([
      makeShift({ id: 'am', clockIn: at('2026-11-16T09:00'), clockOut: at('2026-11-16T14:00') }),
      makeShift({ id: 'pm', clockIn: at('2026-11-16T14:00'), clockOut: at('2026-11-16T19:00') }),
    ])
    const morning = totalsFromSlices(summary.slices.filter((slice) => slice.shiftId === 'am'))
    const afternoon = totalsFromSlices(summary.slices.filter((slice) => slice.shiftId === 'pm'))
    expect(morning.overtimeHours).toBe(0)
    expect(afternoon.overtimeHours).toBeCloseTo(2)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(132)
  })

  it('keeps weekly overtime at zero when each day is long but the week is exactly the threshold', () => {
    const shifts = [16, 17, 18, 19].map((day) =>
      makeShift({
        id: `d${day}`,
        clockIn: at(`2026-11-${day}T09:00`),
        clockOut: at(`2026-11-${day}T19:00`),
        overtimeMethod: 'weekly',
      }),
    )
    const summary = run(shifts, {}, '2026-11-21T18:00')
    expect(summary.lifetime.paidHours).toBeCloseTo(40)
    expect(summary.lifetime.overtimeHours).toBe(0)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(480)
  })

  it('pays the later hours once a weekly threshold is passed', () => {
    const shifts = [16, 17, 18, 19, 20].map((day) =>
      makeShift({
        id: `d${day}`,
        clockIn: at(`2026-11-${day}T09:00`),
        clockOut: at(`2026-11-${day}T18:00`),
        overtimeMethod: 'weekly',
        normalWeeklyHours: 40,
      }),
    )
    const summary = run(shifts)
    const friday = totalsFromSlices(summary.slices.filter((slice) => slice.dateKey === '2026-11-20'))
    expect(summary.lifetime.overtimeHours).toBeCloseTo(5)
    expect(friday.overtimeHours).toBeCloseTo(5)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(570)
  })

  it('does not let a later rate change rewrite an earlier shift', () => {
    const summary = run(
      [
        makeShift({ id: 'a', clockIn: at('2026-11-16T09:00'), clockOut: at('2026-11-16T10:00'), hourlyRate: 10 }),
        makeShift({ id: 'b', clockIn: at('2026-11-16T10:00'), clockOut: at('2026-11-16T11:00'), hourlyRate: 20 }),
      ],
      { hourlyRate: 99 },
    )
    expect(summary.lifetime.totalEarnings).toBeCloseTo(30)
  })
})

describe('calendar boundaries', () => {
  it('splits a midnight shift across local days and weeks', () => {
    const summary = run(
      [makeShift({ id: 'night', clockIn: at('2026-11-15T22:00'), clockOut: at('2026-11-16T06:00') })],
      { weekStartsOn: 1 },
      '2026-11-16T12:00',
    )
    const sunday = totalsFromSlices(summary.slices.filter((slice) => slice.dateKey === '2026-11-15'))
    const monday = totalsFromSlices(summary.slices.filter((slice) => slice.dateKey === '2026-11-16'))
    expect(sunday.paidHours).toBeCloseTo(2)
    expect(monday.paidHours).toBeCloseTo(6)
    expect(summary.week.paidHours).toBeCloseTo(6)
    expect(summary.lifetime.paidHours).toBeCloseTo(8)
  })

  it('removes an untimed break from the end when a shift crosses midnight', () => {
    const summary = run([
      makeShift({
        id: 'night',
        clockIn: at('2026-11-15T22:00'),
        clockOut: at('2026-11-16T02:00'),
        breaks: [{ id: 'b', minutes: 60, start: null, end: null }],
      }),
    ])
    const sunday = totalsFromSlices(summary.slices.filter((slice) => slice.dateKey === '2026-11-15'))
    const monday = totalsFromSlices(summary.slices.filter((slice) => slice.dateKey === '2026-11-16'))
    expect(sunday.paidHours).toBeCloseTo(2)
    expect(monday.paidHours).toBeCloseTo(1)
  })

  it('splits a month boundary by local date', () => {
    const summary = run(
      [makeShift({ id: 'night', clockIn: at('2026-01-31T22:00'), clockOut: at('2026-02-01T06:00') })],
      {},
      '2026-02-02T12:00',
    )
    const january = totalsFromSlices(summary.slices.filter((slice) => slice.monthKey === '2026-01'))
    const february = totalsFromSlices(summary.slices.filter((slice) => slice.monthKey === '2026-02'))
    expect(january.paidHours).toBeCloseTo(2)
    expect(january.totalEarnings).toBeCloseTo(24)
    expect(february.paidHours).toBeCloseTo(6)
    expect(summary.month.paidHours).toBeCloseTo(6)
  })

  it('uses the real elapsed time across the spring-forward clock change', () => {
    const start = DateTime.fromISO('2026-03-29T00:30', { zone })
    const end = DateTime.fromISO('2026-03-29T03:30', { zone })
    expect(end.toMillis() - start.toMillis()).toBe(2 * 3_600_000)
    const summary = run([makeShift({ id: 'dst', clockIn: at('2026-03-29T00:30'), clockOut: at('2026-03-29T03:30') })], {}, '2026-03-29T12:00')
    expect(summary.lifetime.paidHours).toBeCloseTo(2)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(24)
  })

  it('uses the real elapsed time across the autumn clock change', () => {
    const start = DateTime.fromISO('2026-10-25T00:30', { zone })
    const end = DateTime.fromISO('2026-10-25T03:30', { zone })
    expect(end.toMillis() - start.toMillis()).toBe(4 * 3_600_000)
    const summary = run([makeShift({ id: 'dst', clockIn: at('2026-10-25T00:30'), clockOut: at('2026-10-25T03:30') })], {}, '2026-10-25T12:00')
    expect(summary.lifetime.paidHours).toBeCloseTo(4)
    expect(summary.lifetime.totalEarnings).toBeCloseTo(48)
  })

  it('groups Sunday with the previous week when the week starts on Monday', () => {
    const shifts = [
      makeShift({ id: 'sun', clockIn: at('2026-11-15T09:00'), clockOut: at('2026-11-15T15:00'), overtimeMethod: 'weekly', normalWeeklyHours: 8 }),
      makeShift({ id: 'mon', clockIn: at('2026-11-16T09:00'), clockOut: at('2026-11-16T15:00'), overtimeMethod: 'weekly', normalWeeklyHours: 8 }),
    ]
    const mondayStart = run(shifts, { weekStartsOn: 1 }, '2026-11-16T18:00')
    const sundayStart = run(shifts, { weekStartsOn: 0 }, '2026-11-16T18:00')
    expect(mondayStart.lifetime.overtimeHours).toBe(0)
    expect(mondayStart.lifetime.totalEarnings).toBeCloseTo(144)
    expect(sundayStart.lifetime.overtimeHours).toBeCloseTo(4)
    expect(sundayStart.lifetime.totalEarnings).toBeCloseTo(168)
  })
})

describe('projections, schedule, and editing', () => {
  it('projects the month from the pace so far', () => {
    const summary = run(
      [makeShift({ id: 'a', clockIn: at('2026-11-02T09:00'), clockOut: at('2026-11-02T14:00'), hourlyRate: 10 })],
      {},
      '2026-11-10T12:00',
    )
    expect(summary.month.totalEarnings).toBeCloseTo(50)
    expect(summary.projectedMonth).toBeCloseTo(150)
  })

  it('estimates the rest of the month from the schedule without counting it as worked', () => {
    const summary = run([], { hourlyRate: 12, defaultBreakMinutes: 30, overtimeMethod: 'daily' }, '2026-11-15T12:00', [
      { id: 'mon', weekday: 1, startTime: '09:00', endTime: '17:00', enabled: true },
    ])
    expect(summary.projectedMonth).toBe(0)
    expect(summary.estimatedMonth).toBeCloseTo(270)
    expect(summary.lifetime.paidHours).toBe(0)
    const next = instantInZone(summary.nextShift?.startIso ?? '', zone)
    expect(next.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-11-16 09:00')
  })

  it('drops a deleted shift from the totals', () => {
    const shift = makeShift({ id: 'a', clockIn: at('2026-11-16T09:00'), clockOut: at('2026-11-16T12:00') })
    expect(run([shift]).lifetime.totalEarnings).toBeCloseTo(36)
    expect(run([]).lifetime.totalEarnings).toBe(0)
  })
})

describe('validation and backup', () => {
  it('rejects overlapping shifts and accepts a shift that starts when another ends', () => {
    const first = makeShift({ id: 'a', clockIn: at('2026-11-16T09:00'), clockOut: at('2026-11-16T12:00') })
    const overlap = makeShift({ id: 'b', clockIn: at('2026-11-16T11:00'), clockOut: at('2026-11-16T13:00') })
    const adjacent = makeShift({ id: 'c', clockIn: at('2026-11-16T12:00'), clockOut: at('2026-11-16T13:00') })
    expect(validateShift(overlap, [first], ms('2026-11-16T18:00'))).toMatch(/overlap/i)
    expect(validateShift(adjacent, [first], ms('2026-11-16T18:00'))).toBeNull()
  })

  it('rejects an open shift that started more than 18 hours ago', () => {
    const shift = makeShift({ id: 'd', clockIn: at('2026-11-15T09:00'), clockOut: null })
    expect(validateShift(shift, [], ms('2026-11-16T12:00'))).toMatch(/18 hours/)
  })

  it('restores a backup without dropping a zero rate and ignores duplicate ids', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'WorkTrack',
        version: 1,
        settings: { hourlyRate: 0 },
        shifts: [
          { id: 'a', clockIn: '2026-11-16T09:00:00.000Z', clockOut: '2026-11-16T12:00:00.000Z', hourlyRate: 15, breaks: [] },
          { id: 'a', clockIn: '2026-11-16T13:00:00.000Z', hourlyRate: 15, breaks: [] },
        ],
        schedules: [],
      }),
    )
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.settings.hourlyRate).toBe(0)
    expect(parsed.settings.timezone).toBe('Europe/London')
    expect(parsed.shifts).toHaveLength(1)
    expect(parsed.shifts[0]?.hourlyRate).toBe(15)
    expect(parsed.goals).toEqual([])
    expect(parsed.deposits).toEqual([])
    expect('error' in parseBackup('{')).toBe(true)
  })
})

describe('reminders', () => {
  const base = defaultSettings()

  function input(nowLocal: string, patch: Partial<Settings> = {}, extra: Partial<Parameters<typeof evaluateReminders>[0]> = {}) {
    return evaluateReminders({
      settings: {
        ...base,
        ...patch,
        notifications: { ...base.notifications, ...patch.notifications },
        notificationState: { ...base.notificationState, ...patch.notificationState },
      },
      status: 'off',
      todayPaidMs: 0,
      todayShiftCount: 0,
      weekPaidHours: 0,
      weekKey: '2026-11-16',
      monthEarnings: 0,
      monthKey: '2026-11',
      lastWeekEarnings: 0,
      lastWeekHours: 0,
      now: DateTime.fromISO(nowLocal, { zone }),
      ...extra,
    })
  }

  it('reminds you to clock in during the hour after the chosen time', () => {
    const due = input('2026-11-16T09:30', { notifications: { ...base.notifications, clockInReminder: true } })
    expect(due.toasts.map((toast) => toast.id)).toContain('clock-in:2026-11-16')
    const later = input('2026-11-16T11:00', { notifications: { ...base.notifications, clockInReminder: true } })
    expect(later.toasts).toHaveLength(0)
    const worked = input('2026-11-16T09:30', { notifications: { ...base.notifications, clockInReminder: true } }, { todayPaidMs: 1 })
    expect(worked.toasts).toHaveLength(0)
  })

  it('fires target and summary reminders once', () => {
    const hours = input('2026-11-16T18:00', { notifications: { ...base.notifications, weeklyHoursTarget: true } }, { weekPaidHours: 40 })
    expect(hours.toasts.map((toast) => toast.id)).toContain('week-target:2026-11-16')
    const again = input(
      '2026-11-16T18:00',
      { notifications: { ...base.notifications, weeklyHoursTarget: true }, notificationState: hours.nextState },
      { weekPaidHours: 41 },
    )
    expect(again.toasts).toHaveLength(0)

    const month = input(
      '2026-11-20T18:00',
      { notifications: { ...base.notifications, monthlyEarningsTarget: true } },
      { monthEarnings: 2000 },
    )
    expect(month.toasts.map((toast) => toast.id)).toContain('month-target:2026-11')

    const summary = input('2026-11-16T08:00', { notifications: { ...base.notifications, weeklySummary: true } }, { lastWeekEarnings: 100, lastWeekHours: 8 })
    expect(summary.toasts[0]?.title).toBe('Last week')
    expect(summary.nextState.weeklySummaryWeek).toBe('2026-11-16')
  })
})
