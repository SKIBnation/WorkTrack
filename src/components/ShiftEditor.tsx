import { useState } from 'react'
import type { BreakEntry, OvertimeMethod, OvertimeMode, Shift } from '../types.ts'
import { overtimeHourlyRate, validateShift } from '../lib/calc.ts'
import { deleteShift, saveShift, uid } from '../lib/db.ts'
import { formatInputNumber, formatMoney, parseNumber } from '../lib/format.ts'
import { CURRENCIES } from '../lib/format.ts'
import { instantInZone, toUtcIso, zonedDateTime } from '../lib/time.ts'
import { useWorkData } from '../hooks/useWorkData.ts'
import { Button, Confirm, Sheet, fieldClass } from './ui.tsx'

interface DraftBreak {
  id: string
  minutes: string
  startDate: string
  startTime: string
  open: boolean
}

interface Draft {
  inDate: string
  inTime: string
  outDate: string
  outTime: string
  open: boolean
  hourlyRate: string
  currency: string
  overtimeMode: OvertimeMode
  overtimeMultiplier: string
  overtimeRate: string
  overtimeMethod: OvertimeMethod
  normalDailyHours: string
  normalWeeklyHours: string
  breaks: DraftBreak[]
}

export function ShiftEditor({ shift, isNew, onClose }: { shift: Shift; isNew: boolean; onClose: () => void }) {
  const { settings, shifts, now } = useWorkData()
  const [draft, setDraft] = useState<Draft>(() => toDraft(shift, settings?.timezone ?? 'Europe/London'))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  if (!settings) return null
  const zone = settings.timezone

  const save = async () => {
    const next = fromDraft(draft, shift, zone)
    if ('error' in next) {
      setError(next.error)
      return
    }
    const validation = validateShift(next, shifts, now)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    const result = await saveShift(next, shifts, now)
    setSaving(false)
    if (result) {
      setError(result)
      return
    }
    onClose()
  }

  const addBreak = () => {
    setDraft((current) => ({
      ...current,
      breaks: [
        ...current.breaks,
        {
          id: uid(),
          minutes: String(settings.defaultBreakMinutes),
          startDate: '',
          startTime: '',
          open: false,
        },
      ],
    }))
  }

  return (
    <Sheet title={isNew ? 'Add shift' : 'Edit shift'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">
          Clock in date
          <input className={`${fieldClass} mt-1`} type="date" value={draft.inDate} onChange={(event) => setDraft({ ...draft, inDate: event.target.value })} />
        </label>
        <label className="text-sm text-muted">
          Clock in time
          <input className={`${fieldClass} mt-1`} type="time" value={draft.inTime} onChange={(event) => setDraft({ ...draft, inTime: event.target.value })} />
        </label>
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 text-[15px]">
        Still working
        <input type="checkbox" checked={draft.open} onChange={(event) => setDraft({ ...draft, open: event.target.checked })} />
      </label>
      {draft.open && <p className="mt-1 text-xs text-muted">This shift keeps counting until you clock out.</p>}

      {!draft.open && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            Clock out date
            <input className={`${fieldClass} mt-1`} type="date" value={draft.outDate} onChange={(event) => setDraft({ ...draft, outDate: event.target.value })} />
          </label>
          <label className="text-sm text-muted">
            Clock out time
            <input className={`${fieldClass} mt-1`} type="time" value={draft.outTime} onChange={(event) => setDraft({ ...draft, outTime: event.target.value })} />
          </label>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Unpaid breaks</h3>
          <button type="button" className="text-sm font-medium text-gain" onClick={addBreak}>
            Add break
          </button>
        </div>
        <p className="mb-3 text-xs leading-5 text-muted">A break without a start time is deducted from the end of the shift.</p>
        <div className="space-y-3">
          {draft.breaks.map((entry, index) => (
            <div key={entry.id} className="rounded-2xl bg-[var(--field)] p-3">
              {entry.open ? (
                <p className="text-sm">Break in progress. End it from the Track tab, or remove it here.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted">
                    Minutes
                    <input
                      className={`${fieldClass} mt-1`}
                      inputMode="decimal"
                      value={entry.minutes}
                      onChange={(event) => updateBreak(index, { minutes: event.target.value })}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Start time
                    <input
                      className={`${fieldClass} mt-1`}
                      type="time"
                      value={entry.startTime}
                      onChange={(event) =>
                        updateBreak(index, {
                          startTime: event.target.value,
                          startDate: entry.startDate || draft.inDate,
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <button type="button" className="mt-2 text-sm text-danger" onClick={() => removeDraftBreak(entry.id)}>
                Remove break
              </button>
            </div>
          ))}
          {draft.breaks.length === 0 && <p className="text-sm text-muted">No breaks.</p>}
        </div>
      </div>

      <details className="mt-5 rounded-2xl border border-stroke px-3 py-2">
        <summary className="cursor-pointer py-1 text-sm font-medium">Pay rules for this shift</summary>
        <div className="mt-3 space-y-3 pb-2">
          <label className="block text-sm text-muted">
            Hourly rate
            <input className={`${fieldClass} mt-1`} inputMode="decimal" value={draft.hourlyRate} onChange={(event) => setDraft({ ...draft, hourlyRate: event.target.value })} />
          </label>
          <label className="block text-sm text-muted">
            Currency
            <select className={`${fieldClass} mt-1`} value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}>
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            Overtime
            <select
              className={`${fieldClass} mt-1`}
              value={draft.overtimeMode}
              onChange={(event) => setDraft({ ...draft, overtimeMode: event.target.value as OvertimeMode })}
            >
              <option value="multiplier">Multiplier</option>
              <option value="custom">Custom hourly rate</option>
            </select>
          </label>
          {draft.overtimeMode === 'multiplier' ? (
            <label className="block text-sm text-muted">
              Multiplier
              <input
                className={`${fieldClass} mt-1`}
                inputMode="decimal"
                value={draft.overtimeMultiplier}
                onChange={(event) => setDraft({ ...draft, overtimeMultiplier: event.target.value })}
              />
            </label>
          ) : (
            <label className="block text-sm text-muted">
              Overtime hourly rate
              <input className={`${fieldClass} mt-1`} inputMode="decimal" value={draft.overtimeRate} onChange={(event) => setDraft({ ...draft, overtimeRate: event.target.value })} />
            </label>
          )}
          <p className="text-xs text-muted">
            Overtime pays{' '}
            {formatMoney(
              overtimeHourlyRate({
                hourlyRate: parseNumber(draft.hourlyRate) ?? 0,
                overtimeMode: draft.overtimeMode,
                overtimeMultiplier: parseNumber(draft.overtimeMultiplier) ?? 0,
                overtimeRate: parseNumber(draft.overtimeRate) ?? 0,
              }),
              draft.currency,
            )}
            /hour
          </p>
          <label className="block text-sm text-muted">
            Overtime calculated
            <select
              className={`${fieldClass} mt-1`}
              value={draft.overtimeMethod}
              onChange={(event) => setDraft({ ...draft, overtimeMethod: event.target.value as OvertimeMethod })}
            >
              <option value="daily">Each day</option>
              <option value="weekly">Across the week</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">
              Normal daily hours
              <input
                className={`${fieldClass} mt-1`}
                inputMode="decimal"
                value={draft.normalDailyHours}
                onChange={(event) => setDraft({ ...draft, normalDailyHours: event.target.value })}
              />
            </label>
            <label className="text-sm text-muted">
              Normal weekly hours
              <input
                className={`${fieldClass} mt-1`}
                inputMode="decimal"
                value={draft.normalWeeklyHours}
                onChange={(event) => setDraft({ ...draft, normalWeeklyHours: event.target.value })}
              />
            </label>
          </div>
        </div>
      </details>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-5 grid gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          Save shift
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {!isNew && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete shift
          </Button>
        )}
      </div>

      {confirmDelete && (
        <Confirm
          title="Delete this shift?"
          body="The hours and earnings from this shift will be removed from your totals."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteShift(shift.id).then(onClose)
          }}
        />
      )}
    </Sheet>
  )

  function updateBreak(index: number, patch: Partial<DraftBreak>) {
    setDraft((current) => ({
      ...current,
      breaks: current.breaks.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    }))
  }

  function removeDraftBreak(id: string) {
    setDraft((current) => ({ ...current, breaks: current.breaks.filter((entry) => entry.id !== id) }))
  }
}

function toDraft(shift: Shift, zone: string): Draft {
  const start = instantInZone(shift.clockIn, zone)
  const end = shift.clockOut ? instantInZone(shift.clockOut, zone) : null
  const fallbackEnd = start.isValid ? start.plus({ hours: 8 }) : start
  return {
    inDate: start.isValid ? start.toFormat('yyyy-MM-dd') : '',
    inTime: start.isValid ? start.toFormat('HH:mm') : '',
    outDate: (end ?? fallbackEnd).isValid ? (end ?? fallbackEnd).toFormat('yyyy-MM-dd') : '',
    outTime: (end ?? fallbackEnd).isValid ? (end ?? fallbackEnd).toFormat('HH:mm') : '',
    open: shift.clockOut == null,
    hourlyRate: formatInputNumber(shift.hourlyRate),
    currency: shift.currency,
    overtimeMode: shift.overtimeMode,
    overtimeMultiplier: formatInputNumber(shift.overtimeMultiplier),
    overtimeRate: formatInputNumber(shift.overtimeRate),
    overtimeMethod: shift.overtimeMethod,
    normalDailyHours: formatInputNumber(shift.normalDailyHours),
    normalWeeklyHours: formatInputNumber(shift.normalWeeklyHours),
    breaks: shift.breaks.map((entry) => {
      if (entry.start && !entry.end) {
        const breakStart = instantInZone(entry.start, zone)
        return {
          id: entry.id,
          minutes: '',
          startDate: breakStart.toFormat('yyyy-MM-dd'),
          startTime: breakStart.toFormat('HH:mm'),
          open: true,
        }
      }
      if (entry.start) {
        const breakStart = instantInZone(entry.start, zone)
        return {
          id: entry.id,
          minutes: formatInputNumber(entry.minutes),
          startDate: breakStart.toFormat('yyyy-MM-dd'),
          startTime: breakStart.toFormat('HH:mm'),
          open: false,
        }
      }
      return { id: entry.id, minutes: formatInputNumber(entry.minutes), startDate: '', startTime: '', open: false }
    }),
  }
}

function fromDraft(draft: Draft, original: Shift, zone: string): Shift | { error: string } {
  const clockIn = zonedDateTime(draft.inDate, draft.inTime, zone)
  if (!clockIn.isValid) return { error: 'Enter a valid clock-in time.' }
  let clockOut: string | null = null
  if (!draft.open) {
    const end = zonedDateTime(draft.outDate, draft.outTime, zone)
    if (!end.isValid) return { error: 'Enter a valid clock-out time.' }
    clockOut = toUtcIso(end)
  }

  const hourlyRate = parseNumber(draft.hourlyRate)
  const overtimeMultiplier = parseNumber(draft.overtimeMultiplier)
  const overtimeRate = parseNumber(draft.overtimeRate)
  const normalDailyHours = parseNumber(draft.normalDailyHours)
  const normalWeeklyHours = parseNumber(draft.normalWeeklyHours)
  if (hourlyRate == null || hourlyRate < 0) return { error: 'Enter a valid hourly rate.' }
  if (overtimeMultiplier == null || overtimeMultiplier < 0) return { error: 'Enter a valid overtime multiplier.' }
  if (overtimeRate == null || overtimeRate < 0) return { error: 'Enter a valid overtime rate.' }
  if (normalDailyHours == null || normalDailyHours < 0 || normalWeeklyHours == null || normalWeeklyHours < 0) {
    return { error: 'Enter valid working hours.' }
  }

  const breaks: BreakEntry[] = []
  for (const row of draft.breaks) {
    const existing = original.breaks.find((entry) => entry.id === row.id)
    if (row.open && existing?.start) {
      breaks.push({ id: row.id, start: existing.start, end: null, minutes: 0 })
      continue
    }
    const minutes = parseNumber(row.minutes)
    if (minutes == null || minutes < 0) return { error: 'Enter a valid break length.' }
    if (row.startDate && row.startTime) {
      if (minutes <= 0) return { error: 'Break length must be greater than zero.' }
      const start = zonedDateTime(row.startDate, row.startTime, zone)
      if (!start.isValid) return { error: 'Enter a valid break start.' }
      breaks.push({ id: row.id, minutes, start: toUtcIso(start), end: toUtcIso(start.plus({ minutes })) })
    } else if (minutes > 0) {
      breaks.push({ id: row.id, minutes, start: null, end: null })
    }
  }

  return {
    ...original,
    clockIn: toUtcIso(clockIn),
    clockOut,
    breaks,
    hourlyRate,
    currency: draft.currency,
    overtimeMode: draft.overtimeMode,
    overtimeMultiplier,
    overtimeRate,
    overtimeMethod: draft.overtimeMethod,
    normalDailyHours,
    normalWeeklyHours,
  }
}
