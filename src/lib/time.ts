import { DateTime, Settings as LuxonSettings } from 'luxon'

LuxonSettings.defaultLocale = 'en-GB'

export const DEFAULT_ZONE = 'Europe/London'

export const TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'UTC',
] as const

export const WEEKDAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 7, short: 'Sun', long: 'Sunday' },
] as const

export function resolveZone(zone: string | null | undefined): string {
  if (!zone) return DEFAULT_ZONE
  return DateTime.now().setZone(zone).isValid ? zone : DEFAULT_ZONE
}

/** View an absolute timestamp in the app timezone. Never uses the computer's zone. */
export function instantInZone(iso: string, zone: string): DateTime {
  return DateTime.fromISO(iso).setZone(resolveZone(zone))
}

/** Interpret a date and time typed by the user as wall time in the app timezone. */
export function zonedDateTime(date: string, time: string, zone: string): DateTime {
  return DateTime.fromISO(`${date}T${time.slice(0, 5)}`, { zone: resolveZone(zone) })
}

export function toUtcIso(dt: DateTime): string {
  const iso = dt.toUTC().toISO()
  if (!iso) throw new Error('Invalid date')
  return iso
}

export function startOfWeek(dt: DateTime, weekStartsOn: 0 | 1): DateTime {
  const day = dt.startOf('day')
  if (weekStartsOn === 1) return day.minus({ days: day.weekday - 1 })
  return day.minus({ days: day.weekday % 7 })
}

export function weekId(dt: DateTime, weekStartsOn: 0 | 1): string {
  return startOfWeek(dt, weekStartsOn).toISODate() ?? ''
}

export function weekdayHeaders(weekStartsOn: 0 | 1): { value: number; short: string }[] {
  const ordered = weekStartsOn === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)]
  return ordered.map((day) => ({ value: day.value, short: day.short }))
}

export interface DayPart {
  dateKey: string
  startMs: number
  endMs: number
}

/**
 * Split an absolute interval on local midnights.
 * Luxon applies the timezone's real day length, so daylight-saving days stay accurate.
 */
export function splitByLocalDay(startMs: number, endMs: number, zone: string): DayPart[] {
  if (!(endMs > startMs)) return []
  const resolved = resolveZone(zone)
  if (!DateTime.fromMillis(startMs, { zone: resolved }).isValid) return []

  const parts: DayPart[] = []
  let cursorMs = startMs
  let guard = 0
  while (cursorMs < endMs && guard < 1000) {
    guard += 1
    const cursor = DateTime.fromMillis(cursorMs, { zone: resolved })
    if (!cursor.isValid) break
    const nextMidnightMs = cursor.startOf('day').plus({ days: 1 }).toMillis()
    const partEnd = Math.min(nextMidnightMs, endMs)
    const dateKey = cursor.toISODate()
    if (!dateKey || !(partEnd > cursorMs)) break
    parts.push({ dateKey, startMs: cursorMs, endMs: partEnd })
    cursorMs = partEnd
  }
  return parts
}

export function applyTime(day: DateTime, time: string): DateTime {
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  return day.set({
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
    second: 0,
    millisecond: 0,
  })
}
