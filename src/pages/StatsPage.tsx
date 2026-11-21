import { useState } from 'react'
import { DateTime } from 'luxon'
import { TrendCharts } from '../components/Charts.tsx'
import { Card, PageHeader } from '../components/ui.tsx'
import { useWorkData } from '../hooks/useWorkData.ts'
import { buildSeries } from '../lib/calc.ts'
import { formatHours, formatMoney, formatPercent, formatSignedMoney } from '../lib/format.ts'
import { resolveZone } from '../lib/time.ts'

type Mode = 'day' | 'week' | 'month' | 'year'

const captions: Record<Mode, string> = {
  day: 'Each day this week',
  week: 'Compared with previous weeks',
  month: 'Compared with previous months',
  year: 'Compared with previous years',
}

export function StatsPage() {
  const { ready, settings, summary, now } = useWorkData()
  const [mode, setMode] = useState<Mode>('day')
  if (!ready || !settings || !summary) return <p className="py-16 text-center text-muted">Loading…</p>

  const zone = resolveZone(settings.timezone)
  const currency = summary.mixedCurrency ? settings.currency : (summary.currencies[0] ?? settings.currency)
  const series = buildSeries(summary.slices, mode, DateTime.fromMillis(now, { zone }), settings.weekStartsOn)
  const current = mode === 'month' ? summary.month : mode === 'year' ? summary.year : summary.week
  const previous = mode === 'month' ? summary.lastMonth : mode === 'year' ? summary.lastYear : summary.lastWeek
  const previousName = mode === 'month' ? 'last month' : mode === 'year' ? 'last year' : 'last week'
  const summaryTitle = mode === 'month' ? 'This month' : mode === 'year' ? 'This year' : 'This week'

  return (
    <div>
      <PageHeader title="Statistics" />
      <div className="mb-4 flex rounded-xl bg-[var(--field)] p-1">
        {(['day', 'week', 'month', 'year'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`h-9 flex-1 rounded-lg text-sm font-medium capitalize ${mode === item ? 'bg-card text-fg' : 'text-muted'}`}
            onClick={() => setMode(item)}
          >
            {item === 'day' ? 'Daily' : item === 'week' ? 'Weekly' : item === 'month' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted">{captions[mode]}</p>

      <Card className="mb-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{summaryTitle}</p>
        <p className="mt-2 text-[32px] leading-none font-semibold text-gain tabular-nums">{formatMoney(current.totalEarnings, currency)}</p>
        <p className="mt-2 text-sm text-muted">
          {formatHours(current.paidHours)} · {formatHours(current.overtimeHours)} overtime
        </p>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {formatMoney(
            (mode === 'month' ? summary.takeHome.month : mode === 'year' ? summary.takeHome.year : summary.takeHome.week).takeHome,
            currency,
          )}{' '}
          after tax and NI
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stroke pt-4 text-sm">
          <div>
            <p className="text-muted">Normal</p>
            <p className="mt-1 font-medium tabular-nums">{formatMoney(current.normalEarnings, currency)}</p>
          </div>
          <div>
            <p className="text-muted">Overtime</p>
            <p className="mt-1 font-medium text-amber tabular-nums">{formatMoney(current.overtimeEarnings, currency)}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Against {previousName}</p>
        <p className="mt-2 text-lg font-semibold tabular-nums">{formatMoney(previous.totalEarnings, currency)}</p>
        <p className={`mt-1 text-sm ${current.totalEarnings >= previous.totalEarnings ? 'text-gain' : 'text-danger'}`}>
          {comparison(current.totalEarnings, previous.totalEarnings, currency)}
        </p>
      </Card>

      <TrendCharts series={series} currency={currency} />

      <Card className="mt-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">All time</p>
        <p className="mt-2 text-2xl font-semibold text-gain tabular-nums">{formatMoney(summary.lifetime.totalEarnings, currency)}</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          {formatHours(summary.lifetime.paidHours)} worked · {formatHours(summary.lifetime.overtimeHours)} overtime ·{' '}
          {formatMoney(summary.avgHourly, currency)} average per hour · {summary.shiftsCompleted} shifts
        </p>
        <p className="mt-2 text-sm text-muted">
          Projected this year {formatMoney(summary.projectedYear, currency)}
          {summary.projectedMonth > 0 ? ` · this month ${formatMoney(summary.projectedMonth, currency)}` : ''}
        </p>
      </Card>
    </div>
  )
}

function comparison(current: number, previous: number, currency: string): string {
  if (previous <= 0 && current <= 0) return 'No earnings to compare yet'
  if (previous <= 0) return 'Nothing recorded in the previous period'
  const fraction = (current - previous) / previous
  const direction = fraction >= 0 ? 'higher' : 'lower'
  return `${formatSignedMoney(current - previous, currency)} · ${formatPercent(Math.abs(fraction))} ${direction}`
}
