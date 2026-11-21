import { useState } from 'react'
import { DateTime } from 'luxon'
import { ShiftEditor } from '../components/ShiftEditor.tsx'
import { Button, Card, PageHeader, StatusPill } from '../components/ui.tsx'
import { useWakeLock } from '../hooks/useWakeLock.ts'
import { useWorkData } from '../hooks/useWorkData.ts'
import { samePayRules, totalsFromSlices } from '../lib/calc.ts'
import {
  addDurationBreak,
  applyCurrentPay,
  clockIn,
  clockOut,
  endBreak,
  removeBreak,
  startBreak,
} from '../lib/db.ts'
import { formatHours, formatMoney, formatTime, formatTimer, parseNumber } from '../lib/format.ts'
import { instantInZone, resolveZone } from '../lib/time.ts'
import { fieldClass } from '../components/ui.tsx'

export function TrackPage() {
  const { ready, settings, shifts, summary, now } = useWorkData()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [addingBreak, setAddingBreak] = useState(false)
  const [breakText, setBreakText] = useState('')
  const [editing, setEditing] = useState(false)

  const active = shifts.find((shift) => shift.id === summary?.activeShiftId) ?? null
  useWakeLock(summary?.status === 'working' || summary?.status === 'break')

  if (!ready || !settings || !summary) return <p className="py-16 text-center text-muted">Loading…</p>

  const zone = resolveZone(settings.timezone)
  const currency = active?.currency ?? settings.currency
  const status = summary.status
  const longShift = summary.activeGrossMs > 16 * 3_600_000

  const run = async (action: () => Promise<string | null | void>) => {
    setBusy(true)
    setError(null)
    try {
      const message = await action()
      if (typeof message === 'string') setError(message)
    } finally {
      setBusy(false)
    }
  }

  const todayKey = DateTime.fromMillis(now, { zone }).toISODate()
  const todayShifts = [...shifts].reverse().filter((shift) => instantInZone(shift.clockIn, zone).toISODate() === todayKey)

  return (
    <div>
      <PageHeader title="Track" action={<StatusPill status={status} />} />

      <div className="pt-4 text-center">
        <p className="text-[56px] leading-none font-semibold tracking-tight tabular-nums">{formatTimer(summary.activePaidMs)}</p>
        <p className="mt-2 text-sm text-muted">{status === 'break' ? 'Paid time paused' : 'Paid time'}</p>
        <p className="mt-5 text-[34px] leading-none font-semibold text-gain tabular-nums">
          {formatMoney(summary.activeEarnings, currency)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {formatMoney(active?.hourlyRate ?? settings.hourlyRate, currency)}/hour
          {summary.activeOvertimeEarnings > 0 ? ' · includes overtime' : ''}
        </p>
        {status === 'break' && <p className="mt-3 text-sm text-amber">Break {formatTimer(summary.activeOpenBreakMs)}</p>}
        {active && (
          <p className="mt-3 text-sm text-muted">
            Started {formatTime(instantInZone(active.clockIn, zone), settings.timeFormat)}
            {summary.activeGrossMs - summary.activePaidMs >= 60_000
              ? ` · ${formatHours((summary.activeGrossMs - summary.activePaidMs) / 3_600_000)} unpaid`
              : ''}
          </p>
        )}
        {longShift && (
          <p className="mx-auto mt-3 max-w-xs text-sm leading-5 text-amber">
            This shift is longer than 16 hours. Adjust the clock-out time if you forgot to clock out.
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-3">
        {status === 'break' && (
          <Button disabled={busy} onClick={() => void run(async () => active && endBreak(active))}>
            End break
          </Button>
        )}
        <Button variant={status === 'off' ? 'primary' : 'secondary'} disabled={busy || status !== 'off'} onClick={() => void run(() => clockIn(settings))}>
          Clock in
        </Button>
        <Button
          variant={status === 'working' ? 'primary' : 'secondary'}
          disabled={busy || status === 'off' || !active}
          onClick={() => void run(async () => active && clockOut(active.id))}
        >
          Clock out
        </Button>
        {active && status === 'working' && (
          <Button variant="secondary" disabled={busy} onClick={() => void run(async () => startBreak(active))}>
            Start break
          </Button>
        )}
        {active && (
          <Button
            variant="secondary"
            onClick={() => {
              setBreakText(String(settings.defaultBreakMinutes))
              setAddingBreak((open) => !open)
            }}
          >
            Add unpaid break
          </Button>
        )}
        {active && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Adjust times
          </Button>
        )}
      </div>

      {addingBreak && active && (
        <Card className="mt-3">
          <label className="text-sm text-muted">
            Break minutes
            <input className={`${fieldClass} mt-1`} inputMode="numeric" value={breakText} onChange={(event) => setBreakText(event.target.value)} />
          </label>
          <p className="mt-2 text-xs leading-5 text-muted">This unpaid time is deducted from the end of the shift.</p>
          <Button
            className="mt-3"
            onClick={() =>
              void run(async () => {
                const minutes = parseNumber(breakText)
                if (minutes == null || minutes <= 0) return 'Enter a break longer than zero.'
                await addDurationBreak(active, minutes)
                setAddingBreak(false)
                return null
              })
            }
          >
            Add break
          </Button>
        </Card>
      )}

      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

      {active && !samePayRules(active, settings) && (
        <button type="button" className="mt-4 w-full text-center text-sm font-medium text-gain" onClick={() => void applyCurrentPay(active, settings)}>
          Apply current pay settings to this shift
        </button>
      )}

      {active && active.breaks.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Breaks</h2>
          {active.breaks.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-stroke bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium">{breakTitle(entry, zone, settings.timeFormat, summary.activeOpenBreakMs)}</p>
                <p className="text-sm text-muted">{breakLength(entry, summary.activeOpenBreakMs)}</p>
              </div>
              <button type="button" className="text-sm text-danger" onClick={() => void removeBreak(active, entry.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {todayShifts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Today</h2>
          <div className="space-y-2">
            {todayShifts.map((shift) => {
              const totals = totalsFromSlices(summary.slices.filter((slice) => slice.shiftId === shift.id))
              const start = instantInZone(shift.clockIn, zone)
              const end = shift.clockOut ? instantInZone(shift.clockOut, zone) : null
              return (
                <div key={shift.id} className="rounded-2xl border border-stroke bg-card px-4 py-3">
                  <p className="text-sm font-medium">
                    {formatTime(start, settings.timeFormat)} – {end ? formatTime(end, settings.timeFormat) : 'now'}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatHours(totals.paidHours)} · {formatMoney(totals.totalEarnings, shift.currency)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && active && <ShiftEditor shift={active} isNew={false} onClose={() => setEditing(false)} />}
    </div>
  )
}

function breakTitle(
  entry: { start: string | null; end: string | null },
  zone: string,
  timeFormat: '12' | '24',
  openMs: number,
): string {
  if (entry.start && !entry.end) return `On break · ${formatTimer(openMs)}`
  if (entry.start && entry.end) {
    return `${formatTime(instantInZone(entry.start, zone), timeFormat)} – ${formatTime(instantInZone(entry.end, zone), timeFormat)}`
  }
  return 'Unpaid break'
}

function breakLength(entry: { minutes: number; start: string | null; end: string | null }, openMs: number): string {
  if (entry.start && !entry.end) return formatTimer(openMs)
  if (entry.start && entry.end) return formatHours((Date.parse(entry.end) - Date.parse(entry.start)) / 3_600_000)
  return formatHours(entry.minutes / 60)
}
