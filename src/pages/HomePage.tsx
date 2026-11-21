import { Link } from 'react-router-dom'
import { DateTime } from 'luxon'
import { Card, Metric, ProgressBar, StatusPill } from '../components/ui.tsx'
import { useInstallPrompt } from '../hooks/useInstallPrompt.ts'
import { useWorkData } from '../hooks/useWorkData.ts'
import { formatHours, formatLongDay, formatMoney, formatPercent, formatUpcoming } from '../lib/format.ts'
import { updateSettings } from '../lib/db.ts'
import { isIos, isStandalone } from '../lib/platform.ts'
import { instantInZone, resolveZone } from '../lib/time.ts'

export function HomePage() {
  const { ready, settings, summary, now } = useWorkData()
  if (!ready || !settings || !summary) return <p className="py-16 text-center text-muted">Loading…</p>

  const zone = resolveZone(settings.timezone)
  const nowDt = DateTime.fromMillis(now, { zone })
  const currency = summary.mixedCurrency ? settings.currency : (summary.currencies[0] ?? settings.currency)
  const earningsProgress = settings.weeklyEarningsTarget > 0 ? summary.week.totalEarnings / settings.weeklyEarningsTarget : 0
  const hasPace = summary.projectedMonth > 0.5
  const hasScheduleEstimate = !hasPace && summary.estimatedMonth > 0.5
  const projection = hasPace ? summary.projectedMonth : summary.estimatedMonth
  const projectionLabel = hasScheduleEstimate ? 'Estimated this month' : 'Projected this month'
  const showSchedule = hasPace && Math.abs(summary.estimatedMonth - summary.projectedMonth) > 0.5
  const next = summary.nextShift
    ? formatUpcoming(
        instantInZone(summary.nextShift.startIso, zone),
        instantInZone(summary.nextShift.endIso, zone),
        nowDt,
        settings.timeFormat,
      )
    : null

  return (
    <div className="space-y-3">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{formatLongDay(nowDt)}</p>
          <h1 className="mt-1 text-[32px] font-semibold tracking-tight">{greeting(nowDt.hour)}</h1>
        </div>
        <StatusPill status={summary.status} />
      </header>

      {summary.shiftsCompleted === 0 && summary.status === 'off' && (
        <p className="text-sm text-muted">Clock in when you start work. Your hours and earnings will appear here.</p>
      )}

      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-gain/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-muted">This week</p>
            <p className="text-sm text-muted tabular-nums">{formatHours(summary.week.paidHours)}</p>
          </div>
          <p className="mt-3 text-[42px] leading-none font-semibold tracking-tight text-gain tabular-nums">
            {formatMoney(summary.week.totalEarnings, currency)}
          </p>
          {settings.weeklyEarningsTarget > 0 ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="text-muted">Weekly earnings</span>
                <span className="tabular-nums">
                  {formatPercent(earningsProgress)} of {formatMoney(settings.weeklyEarningsTarget, currency)}
                </span>
              </div>
              <ProgressBar value={earningsProgress} label="Weekly earnings target" />
            </div>
          ) : (
            <Link to="/settings" className="mt-4 inline-block text-sm font-medium text-gain">
              Set a weekly earnings target
            </Link>
          )}
          <p className="mt-3 text-[13px] text-muted">
            {settings.weeklyHoursTarget > 0
              ? `${formatHours(summary.week.paidHours)} of ${formatHours(settings.weeklyHoursTarget)}`
              : `${formatHours(summary.week.paidHours)} worked`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stroke pt-4 text-sm">
            <div>
              <p className="text-muted">Normal</p>
              <p className="mt-1 font-medium tabular-nums">{formatMoney(summary.week.normalEarnings, currency)}</p>
            </div>
            <div>
              <p className="text-muted">Overtime</p>
              <p className="mt-1 font-medium text-amber tabular-nums">{formatMoney(summary.week.overtimeEarnings, currency)}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Today" value={formatHours(summary.today.paidHours)} detail={formatMoney(summary.today.totalEarnings, currency)} />
        <Metric
          label="This month"
          value={formatHours(summary.month.paidHours)}
          detail={formatMoney(summary.month.totalEarnings, currency)}
          footer={
            settings.monthlyEarningsTarget > 0
              ? `${formatPercent(summary.month.totalEarnings / settings.monthlyEarningsTarget)} of ${formatMoney(settings.monthlyEarningsTarget, currency)}`
              : undefined
          }
        />
        <Metric label="This year" value={formatMoney(summary.year.totalEarnings, currency)} detail={formatHours(summary.year.paidHours)} />
        <Metric
          label={projectionLabel}
          value={formatMoney(projection, currency)}
          footer={[
            summary.projectedYear > 0 ? `${formatMoney(summary.projectedYear, currency)} this year` : '',
            showSchedule ? `${formatMoney(summary.estimatedMonth, currency)} on schedule` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Metric label="Average hourly" value={formatMoney(summary.avgHourly, currency)} footer="Across all paid hours" />
        <Metric
          label="Average daily"
          value={formatMoney(summary.avgDailyMonth, currency)}
          footer="Per day worked this month"
        />
        <Metric
          label="Shifts"
          value={String(summary.shiftsCompleted)}
          footer={`${summary.shiftsCompletedThisMonth} completed this month`}
        />
        <Metric
          label="Overtime"
          value={formatHours(summary.week.overtimeHours)}
          detail={formatMoney(summary.week.overtimeEarnings, currency)}
          footer={`${formatHours(summary.month.overtimeHours)} this month`}
        />
      </div>

      <Card>
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Next shift</p>
        {next ? (
          <p className="mt-2 text-lg font-semibold">{next}</p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted">
            No upcoming shift.{' '}
            <Link to="/settings" className="font-medium text-gain">
              Add your usual hours
            </Link>
          </p>
        )}
      </Card>

      {summary.mixedCurrency && (
        <p className="px-1 text-xs leading-5 text-muted">Totals add amounts recorded in different currencies without converting them.</p>
      )}

      <InstallCard dismissed={settings.installHintDismissed} />
    </div>
  )
}

function InstallCard({ dismissed }: { dismissed: boolean }) {
  const prompt = useInstallPrompt()
  if (dismissed || isStandalone()) return null
  const ios = isIos()

  return (
    <Card>
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Install</p>
      <h2 className="mt-2 text-lg font-semibold">Add WorkTrack to your iPhone</h2>
      {ios ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-6 text-muted">
          <li>Open this page in Safari.</li>
          <li>Tap Share.</li>
          <li>Tap Add to Home Screen.</li>
        </ol>
      ) : prompt ? (
        <ButtonInstall onClick={() => void prompt.prompt()} />
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">
          On iPhone, open the deployed site in Safari and use Share, then Add to Home Screen. Chrome on iPhone can’t install it.
        </p>
      )}
      <button type="button" className="mt-3 text-sm font-medium text-gain" onClick={() => void updateSettings({ installHintDismissed: true })}>
        Dismiss
      </button>
    </Card>
  )
}

function ButtonInstall({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mt-3 h-10 rounded-xl bg-gain px-4 text-sm font-semibold text-[var(--gain-ink)]" onClick={onClick}>
      Install WorkTrack
    </button>
  )
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
