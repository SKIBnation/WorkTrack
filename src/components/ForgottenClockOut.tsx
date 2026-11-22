import { useState } from 'react'
import { DateTime } from 'luxon'
import { Button } from './ui.tsx'
import { saveShift } from '../lib/db.ts'
import { isForgottenClockOut, shiftEndedAt, suggestedClockOut } from '../lib/forgotten.ts'
import { formatHours, formatTime } from '../lib/format.ts'
import { instantInZone, resolveZone, zonedDateTime } from '../lib/time.ts'
import type { Settings, Shift } from '../types.ts'

const SNOOZE_MS = 2 * 3_600_000

export function ForgottenClockOut({
  shift,
  shifts,
  settings,
  now,
}: {
  shift: Shift
  shifts: Shift[]
  settings: Settings
  now: number
}) {
  const [snoozeUntil, setSnoozeUntil] = useState(0)
  const [snoozedId, setSnoozedId] = useState<string | null>(null)
  const due = isForgottenClockOut(shift.clockIn, shift.normalDailyHours, now)
  const snoozed = snoozedId === shift.id && snoozeUntil > now
  if (!due || snoozed) return null

  return (
    <Prompt
      key={shift.id}
      shift={shift}
      shifts={shifts}
      settings={settings}
      now={now}
      onSnooze={() => {
        setSnoozedId(shift.id)
        setSnoozeUntil(Date.now() + SNOOZE_MS)
      }}
    />
  )
}

function Prompt({
  shift,
  shifts,
  settings,
  now,
  onSnooze,
}: {
  shift: Shift
  shifts: Shift[]
  settings: Settings
  now: number
  onSnooze: () => void
}) {
  const zone = resolveZone(settings.timezone)
  const suggested = DateTime.fromMillis(suggestedClockOut(shift.clockIn, shift.normalDailyHours, now), { zone })
  const [date, setDate] = useState(suggested.toFormat('yyyy-MM-dd'))
  const [time, setTime] = useState(suggested.toFormat('HH:mm'))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const started = instantInZone(shift.clockIn, zone)
  const elapsedHours = Math.max(0, (now - started.toMillis()) / 3_600_000)
  const onBreak = shift.breaks.some((entry) => entry.start && !entry.end)

  const endShift = async () => {
    const end = zonedDateTime(date, time, zone)
    if (!end.isValid) {
      setError('Enter a valid finish time.')
      return
    }
    if (end.toMillis() > now) {
      setError('Finish time can’t be in the future.')
      return
    }
    if (end.toMillis() <= Date.parse(shift.clockIn)) {
      setError('Finish time has to be after you clocked in.')
      return
    }
    setBusy(true)
    setError(null)
    const message = await saveShift(shiftEndedAt(shift, end.toMillis()), shifts, now)
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Still working" onClick={onSnooze} />
      <div role="dialog" aria-modal="true" aria-labelledby="forgotten-title" className="relative w-full max-w-sm rounded-[28px] border border-stroke bg-card p-5">
        <h2 id="forgotten-title" className="text-xl font-semibold tracking-tight">
          Still clocked in?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          You started at {formatTime(started, settings.timeFormat)}, {formatHours(elapsedHours)} ago. If you already left, set the time you finished so the extra hours aren’t saved.
          {onBreak ? ' Ending the shift also ends the break.' : ''}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-sm text-muted">
            Date
            <input className="mt-1 w-full rounded-xl bg-[var(--field)] px-3 py-3 text-fg outline-none" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="text-sm text-muted">
            Finished at
            <input className="mt-1 w-full rounded-xl bg-[var(--field)] px-3 py-3 text-fg outline-none" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 grid gap-2">
          <Button disabled={busy} onClick={() => void endShift()}>
            End the shift
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onSnooze}>
            I’m still working
          </Button>
        </div>
      </div>
    </div>
  )
}
