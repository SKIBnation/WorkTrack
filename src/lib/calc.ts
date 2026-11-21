import { DateTime } from 'luxon'
import type { OvertimeMethod, Schedule, Settings, Shift, WeekStart } from '../types.ts'
import { applyTime, instantInZone, resolveZone, splitByLocalDay, startOfWeek, toUtcIso, weekId } from './time.ts'

const HOUR_MS = 3_600_000
const OPEN_SHIFT_LIMIT_MS = 18 * HOUR_MS

interface Interval {
  startMs: number
  endMs: number
}

interface RawSlice {
  shiftId: string
  dateKey: string
  weekKey: string
  monthKey: string
  yearKey: string
  startMs: number
  endMs: number
  method: OvertimeMethod
  normalDailyHours: number
  normalWeeklyHours: number
  hourlyRate: number
  overtimeHourlyRate: number
  currency: string
}

export interface ClassifiedSlice {
  shiftId: string
  dateKey: string
  weekKey: string
  monthKey: string
  yearKey: string
  startMs: number
  endMs: number
  normalMs: number
  overtimeMs: number
  hourlyRate: number
  overtimeHourlyRate: number
  currency: string
  normalEarnings: number
  overtimeEarnings: number
}

export interface PeriodTotals {
  paidMs: number
  normalMs: number
  overtimeMs: number
  paidHours: number
  normalHours: number
  overtimeHours: number
  normalEarnings: number
  overtimeEarnings: number
  totalEarnings: number
  shiftCount: number
  daysWorked: number
}

export interface WorkSummary {
  status: 'off' | 'working' | 'break'
  activeShiftId: string | null
  activePaidMs: number
  activeGrossMs: number
  activeOpenBreakMs: number
  activeEarnings: number
  activeNormalEarnings: number
  activeOvertimeEarnings: number
  today: PeriodTotals
  week: PeriodTotals
  month: PeriodTotals
  year: PeriodTotals
  lifetime: PeriodTotals
  lastWeek: PeriodTotals
  lastMonth: PeriodTotals
  lastYear: PeriodTotals
  projectedMonth: number
  projectedYear: number
  estimatedMonth: number
  avgHourly: number
  avgDailyMonth: number
  shiftsCompleted: number
  shiftsCompletedThisMonth: number
  nextShift: { startIso: string; endIso: string } | null
  weekKey: string
  monthKey: string
  slices: ClassifiedSlice[]
  currencies: string[]
  mixedCurrency: boolean
}

export interface SeriesPoint {
  key: string
  label: string
  paidHours: number
  normalHours: number
  overtimeHours: number
  totalEarnings: number
}

export function overtimeHourlyRate(source: {
  hourlyRate: number
  overtimeMode: Shift['overtimeMode']
  overtimeMultiplier: number
  overtimeRate: number
}): number {
  if (source.overtimeMode === 'custom') return Math.max(0, source.overtimeRate)
  return Math.max(0, source.hourlyRate) * Math.max(0, source.overtimeMultiplier)
}

export function samePayRules(shift: Shift, settings: Settings): boolean {
  return (
    shift.hourlyRate === settings.hourlyRate &&
    shift.currency === settings.currency &&
    shift.overtimeMode === settings.overtimeMode &&
    shift.overtimeMultiplier === settings.overtimeMultiplier &&
    shift.overtimeRate === settings.overtimeRate &&
    shift.overtimeMethod === settings.overtimeMethod &&
    shift.normalDailyHours === settings.normalDailyHours &&
    shift.normalWeeklyHours === settings.normalWeeklyHours
  )
}

export function emptyPeriod(): PeriodTotals {
  return {
    paidMs: 0,
    normalMs: 0,
    overtimeMs: 0,
    paidHours: 0,
    normalHours: 0,
    overtimeHours: 0,
    normalEarnings: 0,
    overtimeEarnings: 0,
    totalEarnings: 0,
    shiftCount: 0,
    daysWorked: 0,
  }
}

export function totalsFromSlices(slices: ClassifiedSlice[]): PeriodTotals {
  const shiftIds = new Set<string>()
  const days = new Set<string>()
  let paidMs = 0
  let normalMs = 0
  let overtimeMs = 0
  let normalEarnings = 0
  let overtimeEarnings = 0

  for (const slice of slices) {
    const ms = slice.normalMs + slice.overtimeMs
    paidMs += ms
    normalMs += slice.normalMs
    overtimeMs += slice.overtimeMs
    normalEarnings += slice.normalEarnings
    overtimeEarnings += slice.overtimeEarnings
    if (ms > 0) {
      shiftIds.add(slice.shiftId)
      days.add(slice.dateKey)
    }
  }

  return {
    paidMs,
    normalMs,
    overtimeMs,
    paidHours: paidMs / HOUR_MS,
    normalHours: normalMs / HOUR_MS,
    overtimeHours: overtimeMs / HOUR_MS,
    normalEarnings,
    overtimeEarnings,
    totalEarnings: normalEarnings + overtimeEarnings,
    shiftCount: shiftIds.size,
    daysWorked: days.size,
  }
}

export function grossMs(shift: Shift, asOfMs: number): number {
  const bounds = shiftBounds(shift, asOfMs)
  return bounds ? bounds.endMs - bounds.startMs : 0
}

export function validateShift(shift: Shift, others: Shift[], asOfMs: number): string | null {
  const start = Date.parse(shift.clockIn)
  if (!Number.isFinite(start)) return 'Enter a valid clock-in time.'
  const open = shift.clockOut == null
  if (open && start > asOfMs) return 'Clock-in can’t be in the future.'
  if (open && asOfMs - start > OPEN_SHIFT_LIMIT_MS) {
    return 'An open shift can’t start more than 18 hours ago. Enter a clock-out time instead.'
  }

  let end = asOfMs
  if (!open) {
    end = Date.parse(shift.clockOut ?? '')
    if (!Number.isFinite(end)) return 'Enter a valid clock-out time.'
    if (end <= start) return 'Clock-out must be after clock-in.'
  }

  if (!Number.isFinite(shift.hourlyRate) || shift.hourlyRate < 0) return 'Enter a valid hourly rate.'
  if (shift.normalDailyHours < 0 || shift.normalWeeklyHours < 0) return 'Working hours can’t be negative.'
  if (shift.overtimeMultiplier < 0 || shift.overtimeRate < 0) return 'Overtime pay can’t be negative.'
  if (shift.breaks.some((entry) => !Number.isFinite(entry.minutes) || entry.minutes < 0)) {
    return 'Break length can’t be negative.'
  }

  if (open && others.some((other) => other.id !== shift.id && other.clockOut == null)) {
    return 'You already have an active shift.'
  }

  for (const other of others) {
    if (other.id === shift.id) continue
    const otherStart = Date.parse(other.clockIn)
    const otherEnd = other.clockOut == null ? asOfMs : Date.parse(other.clockOut)
    if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd)) continue
    if (start < otherEnd && otherStart < end) return 'This shift overlaps another shift.'
  }

  return null
}

export function summarize(input: {
  shifts: Shift[]
  settings: Settings
  schedules: Schedule[]
  asOfMs: number
}): WorkSummary {
  const zone = resolveZone(input.settings.timezone)
  const now = DateTime.fromMillis(input.asOfMs, { zone })
  const weekStartsOn = input.settings.weekStartsOn
  const slices = classifyShifts(input.shifts, input.asOfMs, zone, weekStartsOn)
  const todayKey = now.toISODate() ?? ''
  const currentWeekKey = weekId(now, weekStartsOn)
  const monthKey = now.toFormat('yyyy-MM')
  const yearKey = now.toFormat('yyyy')
  const lastWeekKey = startOfWeek(now, weekStartsOn).minus({ weeks: 1 }).toISODate() ?? ''
  const lastMonthKey = now.minus({ months: 1 }).toFormat('yyyy-MM')
  const lastYearKey = String(now.year - 1)

  const today = totalsFromSlices(slices.filter((slice) => slice.dateKey === todayKey))
  const week = totalsFromSlices(slices.filter((slice) => slice.weekKey === currentWeekKey))
  const month = totalsFromSlices(slices.filter((slice) => slice.monthKey === monthKey))
  const year = totalsFromSlices(slices.filter((slice) => slice.yearKey === yearKey))
  const lifetime = totalsFromSlices(slices)
  const lastWeek = totalsFromSlices(slices.filter((slice) => slice.weekKey === lastWeekKey))
  const lastMonth = totalsFromSlices(slices.filter((slice) => slice.monthKey === lastMonthKey))
  const lastYear = totalsFromSlices(slices.filter((slice) => slice.yearKey === lastYearKey))

  const projectedMonth = paceProjection(month.totalEarnings, now.day, now.daysInMonth ?? 30)
  const projectedYear = paceProjection(year.totalEarnings, now.ordinal, now.daysInYear ?? 365)

  const hypotheticals = buildScheduleShifts(input.schedules, input.settings, input.asOfMs, input.shifts)
  let estimatedMonth = projectedMonth
  if (input.schedules.some((schedule) => schedule.enabled)) {
    const combined = classifyShifts(
      [...input.shifts, ...hypotheticals],
      input.asOfMs,
      zone,
      weekStartsOn,
    )
    estimatedMonth = totalsFromSlices(combined.filter((slice) => slice.monthKey === monthKey)).totalEarnings
  }

  const active = input.shifts.find((shift) => shift.clockOut == null) ?? null
  const activeSlices = active ? slices.filter((slice) => slice.shiftId === active.id) : []
  const activeTotals = totalsFromSlices(activeSlices)
  const activeGross = active ? grossMs(active, input.asOfMs) : 0
  const openBreak = active?.breaks.find((entry) => entry.start && !entry.end)
  const openBreakMs = openBreak?.start ? Math.max(0, input.asOfMs - Date.parse(openBreak.start)) : 0
  const status = !active ? 'off' : openBreak ? 'break' : 'working'

  const completed = input.shifts.filter((shift) => shift.clockOut)
  const currencies = [...new Set(slices.filter((slice) => slice.normalMs + slice.overtimeMs > 0).map((slice) => slice.currency))]

  return {
    status,
    activeShiftId: active?.id ?? null,
    activePaidMs: activeTotals.paidMs,
    activeGrossMs: activeGross,
    activeOpenBreakMs: Number.isFinite(openBreakMs) ? openBreakMs : 0,
    activeEarnings: activeTotals.totalEarnings,
    activeNormalEarnings: activeTotals.normalEarnings,
    activeOvertimeEarnings: activeTotals.overtimeEarnings,
    today,
    week,
    month,
    year,
    lifetime,
    lastWeek,
    lastMonth,
    lastYear,
    projectedMonth,
    projectedYear,
    estimatedMonth,
    avgHourly: lifetime.paidHours > 0 ? lifetime.totalEarnings / lifetime.paidHours : 0,
    avgDailyMonth: month.daysWorked > 0 ? month.totalEarnings / month.daysWorked : 0,
    shiftsCompleted: completed.length,
    shiftsCompletedThisMonth: completed.filter((shift) => {
      const started = instantInZone(shift.clockIn, zone)
      return started.isValid && started.toFormat('yyyy-MM') === monthKey
    }).length,
    nextShift: nextScheduledShift(input.schedules, input.asOfMs, zone),
    weekKey: currentWeekKey,
    monthKey,
    slices,
    currencies,
    mixedCurrency: currencies.length > 1,
  }
}

export function buildSeries(
  slices: ClassifiedSlice[],
  mode: 'day' | 'week' | 'month' | 'year',
  now: DateTime,
  weekStartsOn: WeekStart,
): SeriesPoint[] {
  if (mode === 'day') {
    const start = startOfWeek(now, weekStartsOn)
    return Array.from({ length: 7 }, (_, index) => {
      const day = start.plus({ days: index })
      const key = day.toISODate() ?? String(index)
      return seriesPoint(key, day.toFormat('ccc'), slices.filter((slice) => slice.dateKey === key))
    })
  }

  if (mode === 'week') {
    const thisWeek = startOfWeek(now, weekStartsOn)
    return Array.from({ length: 8 }, (_, index) => {
      const start = thisWeek.minus({ weeks: 7 - index })
      const key = start.toISODate() ?? String(index)
      return seriesPoint(key, start.toFormat('d LLL'), slices.filter((slice) => slice.weekKey === key))
    })
  }

  if (mode === 'month') {
    const startMonth = now.startOf('month').minus({ months: 5 })
    return Array.from({ length: 6 }, (_, index) => {
      const month = startMonth.plus({ months: index })
      const key = month.toFormat('yyyy-MM')
      return seriesPoint(key, month.toFormat('LLL'), slices.filter((slice) => slice.monthKey === key))
    })
  }

  const startYear = now.year - 4
  return Array.from({ length: 5 }, (_, index) => {
    const year = String(startYear + index)
    return seriesPoint(year, year, slices.filter((slice) => slice.yearKey === year))
  })
}

export function scheduleBounds(
  schedule: Schedule,
  day: DateTime,
): { start: DateTime; end: DateTime } | null {
  if (!schedule.enabled) return null
  if (day.weekday !== schedule.weekday) return null
  const start = applyTime(day.startOf('day'), schedule.startTime)
  let end = applyTime(day.startOf('day'), schedule.endTime)
  if (!start.isValid || !end.isValid) return null
  if (end < start) end = end.plus({ days: 1 })
  if (end <= start) return null
  return { start, end }
}

function seriesPoint(key: string, label: string, slices: ClassifiedSlice[]): SeriesPoint {
  const totals = totalsFromSlices(slices)
  return {
    key,
    label,
    paidHours: totals.paidHours,
    normalHours: totals.normalHours,
    overtimeHours: totals.overtimeHours,
    totalEarnings: totals.totalEarnings,
  }
}

function paceProjection(earned: number, elapsed: number, total: number): number {
  if (earned <= 0 || elapsed <= 0 || total <= 0) return 0
  return (earned / elapsed) * total
}

function classifyShifts(shifts: Shift[], asOfMs: number, zone: string, weekStartsOn: WeekStart): ClassifiedSlice[] {
  const raw: RawSlice[] = []
  for (const shift of shifts) {
    const bounds = shiftBounds(shift, asOfMs)
    if (!bounds) continue
    const paid = paidIntervals(shift, bounds.startMs, bounds.endMs)
    for (const interval of paid) {
      for (const part of splitByLocalDay(interval.startMs, interval.endMs, zone)) {
        const start = DateTime.fromMillis(part.startMs, { zone })
        raw.push({
          shiftId: shift.id,
          dateKey: part.dateKey,
          weekKey: weekId(start, weekStartsOn),
          monthKey: start.toFormat('yyyy-MM'),
          yearKey: start.toFormat('yyyy'),
          startMs: part.startMs,
          endMs: part.endMs,
          method: shift.overtimeMethod,
          normalDailyHours: shift.normalDailyHours,
          normalWeeklyHours: shift.normalWeeklyHours,
          hourlyRate: Math.max(0, shift.hourlyRate),
          overtimeHourlyRate: overtimeHourlyRate(shift),
          currency: shift.currency,
        })
      }
    }
  }
  return classify(raw)
}

function classify(raw: RawSlice[]): ClassifiedSlice[] {
  const groups = new Map<string, RawSlice[]>()
  for (const slice of raw) {
    const key = slice.method === 'daily' ? `d:${slice.dateKey}` : `w:${slice.weekKey}`
    const group = groups.get(key)
    if (group) group.push(slice)
    else groups.set(key, [slice])
  }

  const classified: ClassifiedSlice[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => a.startMs - b.startMs || a.shiftId.localeCompare(b.shiftId))
    let usedMs = 0
    for (const slice of group) {
      const sliceMs = Math.max(0, slice.endMs - slice.startMs)
      const thresholdHours = Math.max(0, slice.method === 'daily' ? slice.normalDailyHours : slice.normalWeeklyHours)
      const normalRemaining = Math.max(0, thresholdHours * HOUR_MS - usedMs)
      const normalMs = Math.min(sliceMs, normalRemaining)
      const overtimeMs = sliceMs - normalMs
      usedMs += sliceMs
      classified.push({
        shiftId: slice.shiftId,
        dateKey: slice.dateKey,
        weekKey: slice.weekKey,
        monthKey: slice.monthKey,
        yearKey: slice.yearKey,
        startMs: slice.startMs,
        endMs: slice.endMs,
        normalMs,
        overtimeMs,
        hourlyRate: slice.hourlyRate,
        overtimeHourlyRate: slice.overtimeHourlyRate,
        currency: slice.currency,
        normalEarnings: (normalMs / HOUR_MS) * slice.hourlyRate,
        overtimeEarnings: (overtimeMs / HOUR_MS) * slice.overtimeHourlyRate,
      })
    }
  }

  classified.sort((a, b) => a.startMs - b.startMs || a.shiftId.localeCompare(b.shiftId))
  return classified
}

function shiftBounds(shift: Shift, asOfMs: number): Interval | null {
  const startMs = Date.parse(shift.clockIn)
  if (!Number.isFinite(startMs)) return null
  const endMs = shift.clockOut == null ? asOfMs : Date.parse(shift.clockOut)
  if (!Number.isFinite(endMs) || endMs <= startMs) return null
  return { startMs, endMs }
}

function paidIntervals(shift: Shift, startMs: number, endMs: number): Interval[] {
  const { cuts, durationMs } = breakCuts(shift, startMs, endMs)
  const afterTimed = subtractAll([{ startMs, endMs }], cuts)
  return trimEnd(afterTimed, durationMs)
}

function breakCuts(shift: Shift, startMs: number, endMs: number): { cuts: Interval[]; durationMs: number } {
  const cuts: Interval[] = []
  let durationMs = 0
  for (const entry of shift.breaks) {
    if (entry.start) {
      const breakStart = Date.parse(entry.start)
      const breakEnd = entry.end ? Date.parse(entry.end) : endMs
      if (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd)) continue
      const cutStart = Math.max(breakStart, startMs)
      const cutEnd = Math.min(breakEnd, endMs)
      if (cutEnd > cutStart) cuts.push({ startMs: cutStart, endMs: cutEnd })
    } else if (entry.minutes > 0) {
      durationMs += entry.minutes * 60_000
    }
  }
  return { cuts: mergeIntervals(cuts), durationMs }
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((interval) => interval.endMs > interval.startMs).sort((a, b) => a.startMs - b.startMs)
  const merged: Interval[] = []
  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (!last || interval.startMs > last.endMs) merged.push({ ...interval })
    else last.endMs = Math.max(last.endMs, interval.endMs)
  }
  return merged
}

function subtractAll(base: Interval[], cuts: Interval[]): Interval[] {
  let current = base
  for (const cut of cuts) {
    const next: Interval[] = []
    for (const interval of current) {
      if (cut.endMs <= interval.startMs || cut.startMs >= interval.endMs) {
        next.push(interval)
        continue
      }
      if (cut.startMs > interval.startMs) {
        next.push({ startMs: interval.startMs, endMs: Math.min(cut.startMs, interval.endMs) })
      }
      if (cut.endMs < interval.endMs) {
        next.push({ startMs: Math.max(cut.endMs, interval.startMs), endMs: interval.endMs })
      }
    }
    current = next
  }
  return current.filter((interval) => interval.endMs > interval.startMs)
}

/** Untimed breaks have no clock time, so the unpaid minutes are removed from the end of the shift. */
function trimEnd(intervals: Interval[], ms: number): Interval[] {
  if (ms <= 0) return intervals
  let remaining = ms
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs)
  const kept: Interval[] = []
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const interval = sorted[index]
    if (!interval) continue
    if (remaining <= 0) {
      kept.push(interval)
      continue
    }
    const length = interval.endMs - interval.startMs
    if (length <= remaining) {
      remaining -= length
      continue
    }
    kept.push({ startMs: interval.startMs, endMs: interval.endMs - remaining })
    remaining = 0
  }
  return kept.sort((a, b) => a.startMs - b.startMs)
}

function buildScheduleShifts(
  schedules: Schedule[],
  settings: Settings,
  asOfMs: number,
  realShifts: Shift[],
): Shift[] {
  const zone = resolveZone(settings.timezone)
  const now = DateTime.fromMillis(asOfMs, { zone })
  const monthEnd = now.endOf('month')
  const accepted: Shift[] = []

  for (let day = now.startOf('day'); day <= monthEnd; day = day.plus({ days: 1 })) {
    for (const schedule of schedules) {
      const bounds = scheduleBounds(schedule, day)
      if (!bounds || bounds.start.toMillis() <= asOfMs) continue
      const candidate = scheduleToShift(schedule, bounds.start, bounds.end, settings)
      const start = Date.parse(candidate.clockIn)
      const end = Date.parse(candidate.clockOut ?? '')
      const overlaps = [...realShifts, ...accepted].some((shift) => {
        const otherStart = Date.parse(shift.clockIn)
        const otherEnd = shift.clockOut == null ? asOfMs : Date.parse(shift.clockOut)
        return Number.isFinite(otherStart) && Number.isFinite(otherEnd) && start < otherEnd && otherStart < end
      })
      if (!overlaps) accepted.push(candidate)
    }
  }

  return accepted
}

function scheduleToShift(schedule: Schedule, start: DateTime, end: DateTime, settings: Settings): Shift {
  const iso = toUtcIso(start)
  return {
    id: `schedule-${schedule.id}-${iso}`,
    clockIn: iso,
    clockOut: toUtcIso(end),
    breaks:
      settings.defaultBreakMinutes > 0
        ? [{ id: `schedule-break-${schedule.id}-${iso}`, minutes: settings.defaultBreakMinutes, start: null, end: null }]
        : [],
    hourlyRate: settings.hourlyRate,
    currency: settings.currency,
    overtimeMode: settings.overtimeMode,
    overtimeMultiplier: settings.overtimeMultiplier,
    overtimeRate: settings.overtimeRate,
    overtimeMethod: settings.overtimeMethod,
    normalDailyHours: settings.normalDailyHours,
    normalWeeklyHours: settings.normalWeeklyHours,
    createdAt: iso,
    updatedAt: iso,
  }
}

function nextScheduledShift(
  schedules: Schedule[],
  asOfMs: number,
  zone: string,
): { startIso: string; endIso: string } | null {
  const now = DateTime.fromMillis(asOfMs, { zone })
  let best: { start: DateTime; end: DateTime } | null = null
  for (let offset = 0; offset < 8; offset += 1) {
    const day = now.startOf('day').plus({ days: offset })
    for (const schedule of schedules) {
      const bounds = scheduleBounds(schedule, day)
      if (!bounds || bounds.start.toMillis() <= asOfMs) continue
      if (!best || bounds.start < best.start) best = bounds
    }
  }
  if (!best) return null
  return { startIso: toUtcIso(best.start), endIso: toUtcIso(best.end) }
}
