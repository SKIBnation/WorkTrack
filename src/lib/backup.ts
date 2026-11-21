import type { Goal, GoalDeposit, Schedule, Settings, Shift, TimeFormat } from '../types.ts'
import type { ClassifiedSlice } from './calc.ts'
import { totalsFromSlices } from './calc.ts'
import { formatTime } from './format.ts'
import { normalizeSettings } from './settings.ts'
import { instantInZone } from './time.ts'

export interface BackupFile {
  app: 'WorkTrack'
  version: 1
  exportedAt: string
  settings: Settings
  shifts: Shift[]
  schedules: Schedule[]
  goals?: Goal[]
  deposits?: GoalDeposit[]
}

export interface RestoredBackup {
  settings: Settings
  shifts: Shift[]
  schedules: Schedule[]
  goals: Goal[]
  deposits: GoalDeposit[]
}

export function createBackup(settings: Settings, shifts: Shift[], schedules: Schedule[], goals: Goal[] = [], deposits: GoalDeposit[] = []): string {
  const payload: BackupFile = {
    app: 'WorkTrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    shifts,
    schedules,
    goals,
    deposits,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseBackup(text: string): RestoredBackup | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'That file isn’t valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object') return { error: 'That file isn’t a WorkTrack backup.' }
  const value = parsed as Partial<BackupFile>
  if (value.app !== 'WorkTrack' || value.version !== 1) return { error: 'That file isn’t a WorkTrack backup.' }
  if (!value.settings || typeof value.settings !== 'object') return { error: 'The backup is missing settings.' }

  const settings = normalizeSettings(value.settings)
  const shifts: Shift[] = []
  for (const item of Array.isArray(value.shifts) ? value.shifts : []) {
    const shift = normalizeShift(item, settings)
    if (shift) shifts.push(shift)
  }
  const schedules: Schedule[] = []
  for (const item of Array.isArray(value.schedules) ? value.schedules : []) {
    const schedule = normalizeSchedule(item)
    if (schedule) schedules.push(schedule)
  }
  const goals: Goal[] = []
  for (const item of Array.isArray(value.goals) ? value.goals : []) {
    const goal = normalizeGoal(item)
    if (goal) goals.push(goal)
  }
  const goalIds = new Set(goals.map((goal) => goal.id))
  const deposits: GoalDeposit[] = []
  for (const item of Array.isArray(value.deposits) ? value.deposits : []) {
    const deposit = normalizeDeposit(item)
    if (deposit && goalIds.has(deposit.goalId)) deposits.push(deposit)
  }
  return {
    settings,
    shifts: uniqueById(shifts),
    schedules: uniqueById(schedules),
    goals: uniqueById(goals),
    deposits: uniqueById(deposits),
  }
}

export function shiftsToCsv(
  shifts: Shift[],
  slices: ClassifiedSlice[],
  zone: string,
  timeFormat: TimeFormat,
): string {
  const header = [
    'date',
    'clock_in',
    'clock_out',
    'break_minutes',
    'paid_hours',
    'normal_hours',
    'overtime_hours',
    'hourly_rate',
    'overtime_rate',
    'normal_earnings',
    'overtime_earnings',
    'total_earnings',
    'currency',
  ]
  const rows = [...shifts]
    .sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn))
    .map((shift) => {
      const start = instantInZone(shift.clockIn, zone)
      const end = shift.clockOut ? instantInZone(shift.clockOut, zone) : null
      const totals = totalsFromSlices(slices.filter((slice) => slice.shiftId === shift.id))
      const grossMinutes = shift.clockOut ? Math.max(0, (Date.parse(shift.clockOut) - Date.parse(shift.clockIn)) / 60_000) : ''
      const breakMinutes = grossMinutes === '' ? '' : Math.max(0, grossMinutes - totals.paidHours * 60)
      return [
        start.toISODate() ?? '',
        formatTime(start, timeFormat),
        end ? formatTime(end, timeFormat) : '',
        breakMinutes === '' ? '' : breakMinutes.toFixed(2),
        totals.paidHours.toFixed(4),
        totals.normalHours.toFixed(4),
        totals.overtimeHours.toFixed(4),
        shift.hourlyRate.toFixed(2),
        (shift.overtimeMode === 'custom' ? shift.overtimeRate : shift.hourlyRate * shift.overtimeMultiplier).toFixed(2),
        totals.normalEarnings.toFixed(2),
        totals.overtimeEarnings.toFixed(2),
        totals.totalEarnings.toFixed(2),
        shift.currency,
      ]
    })

  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}

export async function shareOrDownload(filename: string, content: string, type: string): Promise<void> {
  const blob = new Blob([content], { type })
  const file = new File([blob], filename, { type })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

function normalizeShift(raw: unknown, settings: Settings): Shift | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Shift>
  if (typeof value.id !== 'string' || typeof value.clockIn !== 'string') return null
  if (Number.isNaN(Date.parse(value.clockIn))) return null
  if (value.clockOut != null && typeof value.clockOut !== 'string') return null
  const breaks = Array.isArray(value.breaks)
    ? value.breaks.flatMap((item) => {
        const entry = normalizeBreak(item)
        return entry ? [entry] : []
      })
    : []
  return {
    id: value.id,
    clockIn: value.clockIn,
    clockOut: value.clockOut ?? null,
    breaks,
    hourlyRate: finite(value.hourlyRate, settings.hourlyRate),
    currency: typeof value.currency === 'string' ? value.currency : settings.currency,
    overtimeMode: value.overtimeMode === 'custom' ? 'custom' : 'multiplier',
    overtimeMultiplier: finite(value.overtimeMultiplier, settings.overtimeMultiplier),
    overtimeRate: finite(value.overtimeRate, settings.overtimeRate),
    overtimeMethod: value.overtimeMethod === 'daily' || value.overtimeMethod === 'weekly' ? value.overtimeMethod : settings.overtimeMethod,
    normalDailyHours: finite(value.normalDailyHours, settings.normalDailyHours),
    normalWeeklyHours: finite(value.normalWeeklyHours, settings.normalWeeklyHours),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : value.clockIn,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

function normalizeBreak(raw: unknown): Shift['breaks'][number] | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Shift['breaks'][number]>
  if (typeof value.id !== 'string') return null
  const minutes = finite(value.minutes, 0)
  const start = typeof value.start === 'string' ? value.start : null
  const end = typeof value.end === 'string' ? value.end : null
  if (minutes <= 0 && !start) return null
  return { id: value.id, minutes, start, end }
}

function normalizeSchedule(raw: unknown): Schedule | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Schedule>
  if (typeof value.id !== 'string' || typeof value.weekday !== 'number') return null
  if (typeof value.startTime !== 'string' || typeof value.endTime !== 'string') return null
  return {
    id: value.id,
    weekday: value.weekday,
    startTime: value.startTime,
    endTime: value.endTime,
    enabled: value.enabled !== false,
  }
}

function normalizeGoal(raw: unknown): Goal | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<Goal>
  if (typeof value.id !== 'string') return null
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const targetAmount = finite(value.targetAmount, 0)
  if (!name || targetAmount <= 0) return null
  return {
    id: value.id,
    name,
    targetAmount: Math.round(targetAmount * 100) / 100,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  }
}

function normalizeDeposit(raw: unknown): GoalDeposit | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<GoalDeposit>
  if (typeof value.id !== 'string' || typeof value.goalId !== 'string') return null
  const amount = finite(value.amount, 0)
  if (amount <= 0) return null
  return {
    id: value.id,
    goalId: value.goalId,
    amount: Math.round(amount * 100) / 100,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
