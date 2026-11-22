import type { BreakEntry, Shift } from '../types.ts'

const HOUR_MS = 3_600_000

/** How long an open shift can run before WorkTrack asks if it was left running. */
export function forgottenAfterMs(normalDailyHours: number): number {
  const base = Number.isFinite(normalDailyHours) && normalDailyHours > 0 ? normalDailyHours : 8
  const hours = Math.min(16, Math.max(8, base + 2))
  return hours * HOUR_MS
}

export function isForgottenClockOut(clockInIso: string, normalDailyHours: number, nowMs: number): boolean {
  const start = Date.parse(clockInIso)
  if (!Number.isFinite(start)) return false
  return nowMs - start >= forgottenAfterMs(normalDailyHours)
}

/** Usual finish time for this shift, never later than now and never before clock-in. */
export function suggestedClockOut(clockInIso: string, normalDailyHours: number, nowMs: number): number {
  const start = Date.parse(clockInIso)
  if (!Number.isFinite(start)) return nowMs
  const usual = Number.isFinite(normalDailyHours) && normalDailyHours > 0 ? normalDailyHours : 8
  const suggested = start + usual * HOUR_MS
  return Math.min(nowMs, Math.max(start + 60_000, suggested))
}

/** Close the shift at a chosen time and keep only break time that falls inside it. */
export function shiftEndedAt(shift: Shift, clockOutMs: number): Shift {
  const clockOut = new Date(clockOutMs).toISOString()
  const breaks: BreakEntry[] = []
  for (const entry of shift.breaks) {
    if (!entry.start) {
      breaks.push(entry)
      continue
    }
    const startMs = Date.parse(entry.start)
    if (!Number.isFinite(startMs) || startMs >= clockOutMs) continue
    const recordedEnd = entry.end ? Date.parse(entry.end) : clockOutMs
    const endMs = Math.min(Number.isFinite(recordedEnd) ? recordedEnd : clockOutMs, clockOutMs)
    if (endMs <= startMs) continue
    breaks.push({ ...entry, end: new Date(endMs).toISOString(), minutes: (endMs - startMs) / 60_000 })
  }
  return { ...shift, clockOut, breaks }
}
