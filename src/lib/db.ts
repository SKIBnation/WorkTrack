import Dexie, { type EntityTable } from 'dexie'
import type { BreakEntry, Goal, GoalDeposit, Schedule, Settings, Shift } from '../types.ts'
import { validateShift } from './calc.ts'
import { defaultSettings, normalizeSettings, SETTINGS_ID } from './settings.ts'

export { defaultSettings, normalizeSettings, SETTINGS_ID }

const globalStore = globalThis as unknown as { __worktrackDb?: WorkDatabase }

type WorkDatabase = Dexie & {
  shifts: EntityTable<Shift, 'id'>
  settings: EntityTable<Settings, 'id'>
  schedules: EntityTable<Schedule, 'id'>
  goals: EntityTable<Goal, 'id'>
  deposits: EntityTable<GoalDeposit, 'id'>
}

function createDatabase(): WorkDatabase {
  const database = new Dexie('WorkTrack') as WorkDatabase
  database.version(1).stores({
    shifts: 'id, clockIn, clockOut',
    settings: 'id',
    schedules: 'id, weekday',
  })
  database.version(2).stores({
    shifts: 'id, clockIn, clockOut',
    settings: 'id',
    schedules: 'id, weekday',
    goals: 'id, createdAt',
    deposits: 'id, goalId, createdAt',
  })
  database.on('ready', async () => {
    const existing = await database.settings.get(SETTINGS_ID)
    if (!existing) await database.settings.put(defaultSettings())
  })
  return database
}

export const db = globalStore.__worktrackDb ?? createDatabase()
globalStore.__worktrackDb = db

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createShift(settings: Settings, clockInIso: string, clockOutIso: string | null = null): Shift {
  const now = new Date().toISOString()
  return {
    id: uid(),
    clockIn: clockInIso,
    clockOut: clockOutIso,
    breaks: [],
    hourlyRate: settings.hourlyRate,
    currency: settings.currency,
    overtimeMode: settings.overtimeMode,
    overtimeMultiplier: settings.overtimeMultiplier,
    overtimeRate: settings.overtimeRate,
    overtimeMethod: settings.overtimeMethod,
    normalDailyHours: settings.normalDailyHours,
    normalWeeklyHours: settings.normalWeeklyHours,
    createdAt: now,
    updatedAt: now,
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = normalizeSettings(await db.settings.get(SETTINGS_ID))
  const next = normalizeSettings({ ...current, ...patch, id: SETTINGS_ID })
  await db.settings.put(next)
  rememberTheme(next.theme)
}

export async function clockIn(settings: Settings): Promise<string | null> {
  const open = await db.shifts.filter((shift) => shift.clockOut == null).first()
  if (open) return 'You are already clocked in.'
  await db.shifts.add(createShift(settings, new Date().toISOString()))
  return null
}

export async function clockOut(id: string): Promise<void> {
  const shift = await db.shifts.get(id)
  if (!shift || shift.clockOut) return
  const now = new Date().toISOString()
  const nowMs = Date.parse(now)
  const breaks = shift.breaks.map((entry) => closeOpenBreak(entry, now, nowMs))
  await db.shifts.update(id, { clockOut: now, breaks, updatedAt: now })
}

export async function startBreak(shift: Shift): Promise<void> {
  if (shift.clockOut || shift.breaks.some((entry) => entry.start && !entry.end)) return
  const now = new Date().toISOString()
  const breaks: BreakEntry[] = [...shift.breaks, { id: uid(), minutes: 0, start: now, end: null }]
  await db.shifts.update(shift.id, { breaks, updatedAt: now })
}

export async function endBreak(shift: Shift): Promise<void> {
  const now = new Date().toISOString()
  const nowMs = Date.parse(now)
  const breaks = shift.breaks.map((entry) => closeOpenBreak(entry, now, nowMs))
  await db.shifts.update(shift.id, { breaks, updatedAt: now })
}

export async function addDurationBreak(shift: Shift, minutes: number): Promise<void> {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  const now = new Date().toISOString()
  const breaks: BreakEntry[] = [...shift.breaks, { id: uid(), minutes, start: null, end: null }]
  await db.shifts.update(shift.id, { breaks, updatedAt: now })
}

export async function removeBreak(shift: Shift, breakId: string): Promise<void> {
  const now = new Date().toISOString()
  await db.shifts.update(shift.id, {
    breaks: shift.breaks.filter((entry) => entry.id !== breakId),
    updatedAt: now,
  })
}

export async function applyCurrentPay(shift: Shift, settings: Settings): Promise<void> {
  const now = new Date().toISOString()
  await db.shifts.update(shift.id, {
    hourlyRate: settings.hourlyRate,
    currency: settings.currency,
    overtimeMode: settings.overtimeMode,
    overtimeMultiplier: settings.overtimeMultiplier,
    overtimeRate: settings.overtimeRate,
    overtimeMethod: settings.overtimeMethod,
    normalDailyHours: settings.normalDailyHours,
    normalWeeklyHours: settings.normalWeeklyHours,
    updatedAt: now,
  })
}

export async function saveShift(shift: Shift, others: Shift[], asOfMs: number): Promise<string | null> {
  const error = validateShift(shift, others, asOfMs)
  if (error) return error
  const now = new Date().toISOString()
  await db.shifts.put({ ...shift, updatedAt: now })
  return null
}

export async function deleteShift(id: string): Promise<void> {
  await db.shifts.delete(id)
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  await db.schedules.put(schedule)
}

export async function deleteSchedule(id: string): Promise<void> {
  await db.schedules.delete(id)
}

export async function saveGoal(goal: Goal): Promise<void> {
  const name = goal.name.trim()
  const targetAmount = roundMoney(goal.targetAmount)
  if (!name || targetAmount <= 0) return
  await db.goals.put({ ...goal, name, targetAmount })
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.deposits, async () => {
    await db.deposits.where('goalId').equals(id).delete()
    await db.goals.delete(id)
  })
}

export async function addDeposit(goalId: string, amount: number): Promise<void> {
  const rounded = roundMoney(amount)
  if (!goalId || rounded <= 0) return
  await db.deposits.add({ id: uid(), goalId, amount: rounded, createdAt: new Date().toISOString() })
}

export async function deleteDeposit(id: string): Promise<void> {
  await db.deposits.delete(id)
}

export async function replaceAllData(
  settings: Settings,
  shifts: Shift[],
  schedules: Schedule[],
  goals: Goal[] = [],
  deposits: GoalDeposit[] = [],
): Promise<void> {
  await db.transaction('rw', db.settings, db.shifts, db.schedules, db.goals, db.deposits, async () => {
    await db.shifts.clear()
    await db.schedules.clear()
    await db.goals.clear()
    await db.deposits.clear()
    await db.settings.clear()
    if (shifts.length) await db.shifts.bulkAdd(shifts)
    if (schedules.length) await db.schedules.bulkAdd(schedules)
    if (goals.length) await db.goals.bulkAdd(goals)
    if (deposits.length) await db.deposits.bulkAdd(deposits)
    await db.settings.put(normalizeSettings(settings))
  })
  rememberTheme(normalizeSettings(settings).theme)
}

function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function rememberTheme(theme: string): void {
  try {
    localStorage.setItem('worktrack-theme', theme)
  } catch {
    /* Private browsing can block storage. IndexedDB still holds the preference. */
  }
}

function closeOpenBreak(entry: BreakEntry, now: string, nowMs: number): BreakEntry {
  if (!entry.start || entry.end) return entry
  const startMs = Date.parse(entry.start)
  const minutes = Number.isFinite(startMs) ? Math.max(0, (nowMs - startMs) / 60_000) : entry.minutes
  return { ...entry, end: now, minutes }
}
