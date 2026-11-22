import { createContext, useContext, useLayoutEffect, useRef } from 'react'
import { Button } from './ui.tsx'
import { useWorkData } from '../hooks/useWorkData.ts'
import { grossMs, totalsFromSlices, type WorkSummary } from '../lib/calc.ts'
import { formatHours, formatMoney, formatTime } from '../lib/format.ts'
import { instantInZone, resolveZone } from '../lib/time.ts'
import type { Settings, Shift } from '../types.ts'

const ClockOutContext = createContext<(shiftId: string) => void>(() => {})

export function useShowClockOut(): (shiftId: string) => void {
  return useContext(ClockOutContext)
}

export const ClockOutContextProvider = ClockOutContext.Provider

export function ClockOutCard({ shiftId, onDone }: { shiftId: string; onDone: () => void }) {
  const { settings, shifts, summary, now } = useWorkData()
  const shift = shifts.find((item) => item.id === shiftId) ?? null
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  if (!settings || !summary || !shift?.clockOut) {
    return <div className="absolute inset-0 z-[80]" style={{ background: 'var(--wallpaper)' }} aria-hidden="true" />
  }

  return (
    <Receipt
      key={shift.id}
      shift={shift}
      settings={settings}
      summary={summary}
      now={now}
      onDone={() => onDoneRef.current()}
    />
  )
}

function Receipt({
  shift,
  settings,
  summary,
  now,
  onDone,
}: {
  shift: Shift
  settings: Settings
  summary: WorkSummary
  now: number
  onDone: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const dismissRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pieces = [...root.querySelectorAll<HTMLElement>('[data-at]')]
    let frame = 0
    let leaving = false

    const stop = () => cancelAnimationFrame(frame)

    const dismiss = () => {
      if (leaving) return
      leaving = true
      stop()
      if (reduce) {
        onDoneRef.current()
        return
      }
      const exitAt = performance.now()
      const step = (time: number) => {
        const p = ease(span(time, exitAt, exitAt + 280))
        root.style.opacity = String(1 - p)
        if (p < 1) frame = requestAnimationFrame(step)
        else onDoneRef.current()
      }
      frame = requestAnimationFrame(step)
    }
    dismissRef.current = dismiss

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    root.querySelector<HTMLButtonElement>('button[data-done]')?.focus()

    if (reduce) {
      root.style.opacity = '1'
      for (const piece of pieces) {
        piece.style.opacity = '1'
        piece.style.transform = 'none'
      }
    } else {
      const started = performance.now()
      const paint = (time: number) => {
        if (leaving) return
        const t = time - started
        root.style.opacity = String(ease(span(t, 0, 220)))
        for (const piece of pieces) {
          const at = Number(piece.dataset.at ?? 0)
          const rise = ease(span(t, at, 480 + at))
          piece.style.opacity = String(rise)
          piece.style.transform = `translateY(${(1 - rise) * 18}px)`
        }
        if (t < 1300) frame = requestAnimationFrame(paint)
      }
      frame = requestAnimationFrame(paint)
    }

    return () => {
      window.removeEventListener('keydown', onKey)
      stop()
      dismissRef.current = () => {}
    }
  }, [])

  const zone = resolveZone(settings.timezone)
  const start = instantInZone(shift.clockIn, zone)
  const end = instantInZone(shift.clockOut ?? '', zone)
  const totals = totalsFromSlices(summary.slices.filter((slice) => slice.shiftId === shift.id))
  const unpaidMs = Math.max(0, grossMs(shift, now) - totals.paidMs)
  const paid = `${formatHours(totals.paidHours)} paid`
  const hours = unpaidMs >= 60_000 ? `${paid} · ${formatHours(unpaidMs / 3_600_000)} unpaid` : paid
  const takeHome = summary.takeHome.byShift[shift.id]?.takeHome ?? totals.totalEarnings
  const showOvertime = totals.overtimeMs >= 60_000 || totals.overtimeEarnings > 0.004
  const sameDay = start.isValid && end.isValid && start.hasSame(end, 'day')
  const range =
    start.isValid && end.isValid
      ? sameDay
        ? `${formatTime(start, settings.timeFormat)} – ${formatTime(end, settings.timeFormat)}`
        : `${formatTime(start, settings.timeFormat)} – ${end.toFormat('ccc d LLL')} ${formatTime(end, settings.timeFormat)}`
      : '—'

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clock-out-title"
      className="absolute inset-0 z-[80] flex flex-col overflow-y-auto px-7 opacity-0"
      style={{
        background: 'var(--wallpaper)',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="m-auto w-full max-w-sm py-8 text-center">
        <p id="clock-out-title" data-at="0" className="text-[12px] font-semibold tracking-[0.16em] text-muted uppercase opacity-0">
          Shift done
        </p>
        <p data-at="80" className="mt-2.5 text-[17px] opacity-0">
          {start.isValid ? start.toFormat('cccc d LLLL') : '—'}
        </p>
        <p data-at="160" className="mt-7 text-xl font-semibold tabular-nums opacity-0">
          {range}
        </p>
        <p data-at="240" className="mt-3.5 text-[56px] leading-none font-semibold tracking-tight text-gain tabular-nums opacity-0">
          {formatMoney(totals.totalEarnings, shift.currency)}
        </p>
        <p data-at="340" className="mt-3 text-[15px] text-muted opacity-0">
          {hours}
        </p>
        <p data-at="420" className="mt-1 text-[15px] tabular-nums opacity-0">
          {formatMoney(takeHome, shift.currency)} after tax and NI
        </p>
        <div className="mt-7 border-t border-stroke text-left">
          <div data-at="500" className="flex items-center justify-between border-b border-stroke py-3.5 text-base tabular-nums opacity-0">
            <span className="text-muted">Normal</span>
            <span>{formatMoney(totals.normalEarnings, shift.currency)}</span>
          </div>
          {showOvertime && (
            <div data-at="560" className="flex items-center justify-between border-b border-stroke py-3.5 text-base tabular-nums opacity-0">
              <span className="text-muted">Overtime</span>
              <span>{formatMoney(totals.overtimeEarnings, shift.currency)}</span>
            </div>
          )}
        </div>
        <Button data-at="680" data-done="true" variant="solid" className="mt-7 opacity-0" onClick={() => dismissRef.current()}>
          Done
        </Button>
      </div>
    </div>
  )
}

function ease(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2
}

function span(time: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (time - start) / (end - start)))
}
