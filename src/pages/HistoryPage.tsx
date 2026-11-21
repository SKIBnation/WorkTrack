import { Plus } from 'lucide-react'
import { useState } from 'react'
import { DateTime } from 'luxon'
import { ShiftEditor } from '../components/ShiftEditor.tsx'
import { Button, PageHeader, Sheet } from '../components/ui.tsx'
import { useWorkData } from '../hooks/useWorkData.ts'
import { grossMs, overtimeHourlyRate, totalsFromSlices, type ClassifiedSlice } from '../lib/calc.ts'
import { createShift } from '../lib/db.ts'
import { formatDay, formatHours, formatLongDay, formatMoney, formatTime } from '../lib/format.ts'
import { instantInZone, resolveZone, startOfWeek, toUtcIso, weekdayHeaders } from '../lib/time.ts'
import type { Shift } from '../types.ts'

type Period = 'day' | 'week' | 'month' | 'year' | 'all'
type View = 'list' | 'calendar'

export function HistoryPage() {
  const data = useWorkData()
  const { ready, settings, shifts, summary, now } = data
  const [period, setPeriod] = useState<Period>('month')
  const [view, setView] = useState<View>('list')
  const [anchorMs, setAnchorMs] = useState(now)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Shift | null>(null)
  const [creating, setCreating] = useState(false)
  const [calendarDay, setCalendarDay] = useState<string | null>(null)

  if (!ready || !settings || !summary) return <p className="py-16 text-center text-muted">Loading…</p>

  const zone = resolveZone(settings.timezone)
  const anchor = DateTime.fromMillis(anchorMs, { zone })
  const selected = shifts.find((shift) => shift.id === selectedId) ?? null
  const visible = [...shifts]
    .reverse()
    .filter((shift) => shiftOverlaps(shift, period, anchor, settings.weekStartsOn, now))

  const newShift = () => {
    const start = DateTime.fromMillis(now, { zone }).startOf('hour')
    const hours = settings.normalDailyHours > 0 ? settings.normalDailyHours : 8
    setCreating(true)
    setEditing(createShift(settings, toUtcIso(start), toUtcIso(start.plus({ hours }))))
  }

  return (
    <div>
      <PageHeader
        title="History"
        action={
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-gain text-[var(--gain-ink)]" aria-label="Add shift" onClick={newShift}>
            <Plus size={20} />
          </button>
        }
      />

      <div className="mb-3 flex rounded-xl bg-[var(--field)] p-1">
        {(['list', 'calendar'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`h-9 flex-1 rounded-lg text-sm font-medium capitalize ${view === item ? 'bg-card text-fg' : 'text-muted'}`}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {view === 'list' ? (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {(['day', 'week', 'month', 'year', 'all'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`h-8 shrink-0 rounded-full px-3 text-sm capitalize ${period === item ? 'bg-gain text-[var(--gain-ink)]' : 'bg-[var(--field)] text-muted'}`}
                onClick={() => setPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {period !== 'all' && (
            <div className="mb-4 flex items-center justify-between">
              <button type="button" className="text-sm font-medium text-gain" onClick={() => setAnchorMs(moveAnchor(anchor, period, -1).toMillis())}>
                Previous
              </button>
              <p className="text-sm font-medium">{periodLabel(period, anchor, settings.weekStartsOn)}</p>
              <button type="button" className="text-sm font-medium text-gain" onClick={() => setAnchorMs(moveAnchor(anchor, period, 1).toMillis())}>
                Next
              </button>
            </div>
          )}
          <ShiftList shifts={visible} zone={zone} timeFormat={settings.timeFormat} slices={summary.slices} onOpen={setSelectedId} />
        </>
      ) : (
        <Calendar
          anchor={anchor}
          weekStartsOn={settings.weekStartsOn}
          worked={new Set(summary.slices.filter((slice) => slice.normalMs + slice.overtimeMs > 0).map((slice) => slice.dateKey))}
          selected={calendarDay ?? anchor.toISODate() ?? ''}
          onSelect={(day) => setCalendarDay(day)}
          onMonth={(next) => setAnchorMs(next.toMillis())}
          shifts={shifts}
          zone={zone}
          timeFormat={settings.timeFormat}
          slices={summary.slices}
          onOpen={setSelectedId}
        />
      )}

      {selected && !editing && (
        <ShiftDetail
          shift={selected}
          zone={zone}
          timeFormat={settings.timeFormat}
          asOf={now}
          totals={totalsFromSlices(summary.slices.filter((slice) => slice.shiftId === selected.id))}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(selected)}
        />
      )}
      {editing && (
        <ShiftEditor
          shift={editing}
          isNew={creating}
          onClose={() => {
            setEditing(null)
            setCreating(false)
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}

function ShiftList({
  shifts,
  zone,
  timeFormat,
  slices,
  onOpen,
}: {
  shifts: Shift[]
  zone: string
  timeFormat: '12' | '24'
  slices: ClassifiedSlice[]
  onOpen: (id: string) => void
}) {
  if (shifts.length === 0) return <p className="py-10 text-center text-sm text-muted">No shifts in this period.</p>
  return (
    <div className="space-y-2">
      {shifts.map((shift) => {
        const totals = totalsFromSlices(slices.filter((slice) => slice.shiftId === shift.id))
        const start = instantInZone(shift.clockIn, zone)
        const end = shift.clockOut ? instantInZone(shift.clockOut, zone) : null
        return (
          <button key={shift.id} type="button" className="w-full rounded-[22px] border border-stroke bg-card px-4 py-3 text-left" onClick={() => onOpen(shift.id)}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{formatDay(start)}</p>
              <p className="font-semibold text-gain tabular-nums">{formatMoney(totals.totalEarnings, shift.currency)}</p>
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatTime(start, timeFormat)} – {end ? `${formatTime(end, timeFormat)}${end.hasSame(start, 'day') ? '' : ` ${end.toFormat('d LLL')}`}` : 'now'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {formatHours(totals.paidHours)} paid
              {totals.overtimeHours > 0 ? ` · ${formatHours(totals.overtimeHours)} overtime` : ''}
            </p>
          </button>
        )
      })}
    </div>
  )
}

function Calendar({
  anchor,
  weekStartsOn,
  worked,
  selected,
  onSelect,
  onMonth,
  shifts,
  zone,
  timeFormat,
  slices,
  onOpen,
}: {
  anchor: DateTime
  weekStartsOn: 0 | 1
  worked: Set<string>
  selected: string
  onSelect: (day: string) => void
  onMonth: (next: DateTime) => void
  shifts: Shift[]
  zone: string
  timeFormat: '12' | '24'
  slices: ClassifiedSlice[]
  onOpen: (id: string) => void
}) {
  const headers = weekdayHeaders(weekStartsOn)
  const gridStart = startOfWeek(anchor.startOf('month'), weekStartsOn)
  const cells: DateTime[] = []
  for (let index = 0; index < 42; index += 1) cells.push(gridStart.plus({ days: index }))
  if (cells.slice(-7).every((day) => day.month !== anchor.month)) cells.splice(-7)
  const selectedShifts = shifts.filter(
    (shift) =>
      slices.some((slice) => slice.shiftId === shift.id && slice.dateKey === selected) ||
      instantInZone(shift.clockIn, zone).toISODate() === selected,
  )

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="text-sm font-medium text-gain" onClick={() => onMonth(anchor.minus({ months: 1 }))}>
          Previous
        </button>
        <p className="text-sm font-medium">{anchor.toFormat('LLLL yyyy')}</p>
        <button type="button" className="text-sm font-medium text-gain" onClick={() => onMonth(anchor.plus({ months: 1 }))}>
          Next
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
        {headers.map((day) => (
          <div key={day.value} className="py-1">
            {day.short}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const key = day.toISODate() ?? ''
          const inMonth = day.month === anchor.month
          const isSelected = key === selected
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`flex h-11 flex-col items-center justify-center rounded-xl text-sm ${isSelected ? 'bg-gain text-[var(--gain-ink)]' : inMonth ? 'text-fg' : 'text-faint'}`}
            >
              {day.day}
              {worked.has(key) && <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-[var(--gain-ink)]' : 'bg-gain'}`} />}
            </button>
          )
        })}
      </div>
      <h2 className="mt-5 mb-2 text-sm font-medium">{selected ? formatLongDay(DateTime.fromISO(selected, { zone: anchor.zoneName ?? 'Europe/London' })) : 'Day'}</h2>
      <ShiftList shifts={[...selectedShifts].reverse()} zone={zone} timeFormat={timeFormat} slices={slices} onOpen={onOpen} />
    </div>
  )
}

function ShiftDetail({
  shift,
  zone,
  timeFormat,
  asOf,
  totals,
  onClose,
  onEdit,
}: {
  shift: Shift
  zone: string
  timeFormat: '12' | '24'
  asOf: number
  totals: ReturnType<typeof totalsFromSlices>
  onClose: () => void
  onEdit: () => void
}) {
  const start = instantInZone(shift.clockIn, zone)
  const end = shift.clockOut ? instantInZone(shift.clockOut, zone) : null
  const unpaidHours = Math.max(0, grossMs(shift, asOf) / 3_600_000 - totals.paidHours)
  const rows = [
    ['Date', formatLongDay(start)],
    ['Start', formatTime(start, timeFormat)],
    ['Finish', end ? `${formatTime(end, timeFormat)}${end.hasSame(start, 'day') ? '' : `, ${formatDay(end)}`}` : 'Still working'],
    ['Break', formatHours(unpaidHours)],
    ['Paid hours', formatHours(totals.paidHours)],
    ['Normal hours', formatHours(totals.normalHours)],
    ['Overtime hours', formatHours(totals.overtimeHours)],
    ['Normal pay', formatMoney(totals.normalEarnings, shift.currency)],
    ['Overtime pay', formatMoney(totals.overtimeEarnings, shift.currency)],
    ['Total earned', formatMoney(totals.totalEarnings, shift.currency)],
  ]

  return (
    <Sheet title="Shift" onClose={onClose}>
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-muted">
        Paid at {formatMoney(shift.hourlyRate, shift.currency)}/hour. Overtime at {formatMoney(overtimeHourlyRate(shift), shift.currency)}/hour, calculated{' '}
        {shift.overtimeMethod === 'daily' ? 'each day' : 'across the week'}.
      </p>
      <div className="mt-5 grid gap-2">
        <Button onClick={onEdit}>Edit shift</Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Sheet>
  )
}

function shiftOverlaps(shift: Shift, period: Period, anchor: DateTime, weekStartsOn: 0 | 1, asOf: number): boolean {
  if (period === 'all') return true
  const start = Date.parse(shift.clockIn)
  const end = shift.clockOut ? Date.parse(shift.clockOut) : asOf
  const bounds = periodBounds(period, anchor, weekStartsOn)
  return start < bounds.end && bounds.start < end
}

function periodBounds(period: Exclude<Period, 'all'>, anchor: DateTime, weekStartsOn: 0 | 1): { start: number; end: number } {
  if (period === 'day') {
    const start = anchor.startOf('day')
    return { start: start.toMillis(), end: start.plus({ days: 1 }).toMillis() }
  }
  if (period === 'week') {
    const start = startOfWeek(anchor, weekStartsOn)
    return { start: start.toMillis(), end: start.plus({ weeks: 1 }).toMillis() }
  }
  if (period === 'month') {
    const start = anchor.startOf('month')
    return { start: start.toMillis(), end: start.plus({ months: 1 }).toMillis() }
  }
  const start = anchor.startOf('year')
  return { start: start.toMillis(), end: start.plus({ years: 1 }).toMillis() }
}

function moveAnchor(anchor: DateTime, period: Period, direction: number): DateTime {
  if (period === 'day') return anchor.plus({ days: direction })
  if (period === 'week') return anchor.plus({ weeks: direction })
  if (period === 'month') return anchor.plus({ months: direction })
  if (period === 'year') return anchor.plus({ years: direction })
  return anchor
}

function periodLabel(period: Period, anchor: DateTime, weekStartsOn: 0 | 1): string {
  if (period === 'day') return formatLongDay(anchor)
  if (period === 'week') return `Week of ${formatDay(startOfWeek(anchor, weekStartsOn))}`
  if (period === 'month') return anchor.toFormat('LLLL yyyy')
  if (period === 'year') return anchor.toFormat('yyyy')
  return 'All shifts'
}
