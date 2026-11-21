import type { ReactNode } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SeriesPoint } from '../lib/calc.ts'
import { formatHours, formatMoney } from '../lib/format.ts'

export function TrendCharts({ series, currency }: { series: SeriesPoint[]; currency: string }) {
  const hasHours = series.some((point) => point.paidHours > 0)
  const hasEarnings = series.some((point) => point.totalEarnings > 0)
  if (!hasHours && !hasEarnings) {
    return <p className="py-8 text-center text-sm text-muted">No paid hours in this range yet.</p>
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="space-y-3">
      <ChartCard title="Hours">
        <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide />
            <Tooltip content={<MoneyTip currency={currency} />} cursor={{ fill: 'var(--field)' }} />
            <Bar dataKey="paidHours" name="Hours" fill="var(--gain)" radius={[6, 6, 0, 0]} isAnimationActive={!reduceMotion} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>
      <ChartCard title="Earnings">
        <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide />
            <Tooltip content={<MoneyTip currency={currency} />} cursor={{ fill: 'var(--field)' }} />
            <Bar dataKey="totalEarnings" name="Earnings" fill="var(--gain)" radius={[6, 6, 0, 0]} isAnimationActive={!reduceMotion} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </ChartCard>
      <ChartCard title="Normal and overtime">
        <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis hide />
            <Tooltip content={<MoneyTip currency={currency} />} cursor={{ fill: 'var(--field)' }} />
            <Bar dataKey="normalHours" name="Normal hours" stackId="hours" fill="var(--gain)" isAnimationActive={!reduceMotion} />
            <Bar dataKey="overtimeHours" name="Overtime hours" stackId="hours" fill="var(--amber)" radius={[6, 6, 0, 0]} isAnimationActive={!reduceMotion} />
          </BarChart>
        </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gain" /> Normal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber" /> Overtime
          </span>
        </div>
      </ChartCard>
      <table className="sr-only">
        <caption>Chart values</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Hours</th>
            <th>Earnings</th>
            <th>Overtime hours</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.key}>
              <td>{point.label}</td>
              <td>{formatHours(point.paidHours)}</td>
              <td>{formatMoney(point.totalEarnings, currency)}</td>
              <td>{formatHours(point.overtimeHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-stroke bg-card p-4">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {children}
    </section>
  )
}

function MoneyTip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string }>
  label?: string | number
  currency: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-stroke bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-muted">{label}</p>
      {payload.map((item) => {
        const numeric = typeof item.value === 'number' ? item.value : Number(item.value ?? 0)
        const name = item.name ?? ''
        const text = name.toLowerCase().includes('earn') ? formatMoney(numeric, currency) : formatHours(numeric)
        return (
          <p key={name} style={{ color: item.color }}>
            {name}: {text}
          </p>
        )
      })}
    </div>
  )
}
