import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { DateTime } from 'luxon'
import { Confirm, PageHeader, fieldClass } from '../components/ui.tsx'
import { useWorkData } from '../hooks/useWorkData.ts'
import { createBackup, parseBackup, shareOrDownload, shiftsToCsv } from '../lib/backup.ts'
import { overtimeHourlyRate } from '../lib/calc.ts'
import { deleteSchedule, replaceAllData, saveSchedule, uid, updateSettings } from '../lib/db.ts'
import { CURRENCIES, formatInputNumber, formatMoney, parseNumber } from '../lib/format.ts'
import { notificationSupport, requestNotificationPermission } from '../lib/reminders.ts'
import { parseTaxCode } from '../lib/tax.ts'
import { resolveZone, TIMEZONES, WEEKDAYS } from '../lib/time.ts'
import type { NotificationPreferences, OvertimeMethod, OvertimeMode, Schedule, Settings, Shift, ThemeMode, TimeFormat } from '../types.ts'

export function SettingsPage() {
  const { ready, settings, shifts, schedules, summary } = useWorkData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ settings: Settings; shifts: Shift[]; schedules: Schedule[] } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [permission, setPermission] = useState(notificationSupport())

  useEffect(() => {
    setPermission(notificationSupport())
  }, [settings?.notifications])

  if (!ready || !settings || !summary) return <p className="py-16 text-center text-muted">Loading…</p>

  const currency = settings.currency
  const overtimePay = overtimeHourlyRate(settings)
  const zones = (TIMEZONES as readonly string[]).includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES]
  const orderedSchedules = [...schedules].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))

  const saveNotifications = async (patch: Partial<NotificationPreferences>) => {
    const turningOn = Object.values(patch).some((value) => value === true)
    if (turningOn && notificationSupport() === 'default') {
      const result = await requestNotificationPermission()
      setPermission(result)
    }
    await updateSettings({ notifications: { ...settings.notifications, ...patch } })
    setPermission(notificationSupport())
  }

  const onImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseBackup(String(reader.result ?? ''))
      if ('error' in parsed) setNotice(parsed.error)
      else setPending(parsed)
    }
    reader.readAsText(file)
  }

  const stamp = DateTime.now().setZone(resolveZone(settings.timezone)).toISODate() ?? 'backup'

  return (
    <div>
      <PageHeader title="Settings" />

      <Section title="Pay">
        <NumberRow label="Hourly rate" value={settings.hourlyRate} onCommit={(hourlyRate) => void updateSettings({ hourlyRate })} />
        <SelectRow
          label="Currency"
          value={settings.currency}
          options={CURRENCIES.map((item) => ({ value: item.code, label: item.label }))}
          onChange={(value) => void updateSettings({ currency: value })}
        />
        <ChoiceRow
          label="Overtime pay"
          value={settings.overtimeMode}
          options={[
            { value: 'multiplier', label: 'Multiplier' },
            { value: 'custom', label: 'Custom rate' },
          ]}
          onChange={(overtimeMode: OvertimeMode) => {
            if (overtimeMode === 'custom') {
              void updateSettings({ overtimeMode, overtimeRate: settings.hourlyRate * settings.overtimeMultiplier })
            } else void updateSettings({ overtimeMode })
          }}
        />
        {settings.overtimeMode === 'multiplier' ? (
          <NumberRow label="Multiplier" value={settings.overtimeMultiplier} onCommit={(overtimeMultiplier) => void updateSettings({ overtimeMultiplier })} />
        ) : (
          <NumberRow label="Overtime rate" value={settings.overtimeRate} onCommit={(overtimeRate) => void updateSettings({ overtimeRate })} />
        )}
        <p className="border-b border-stroke py-3 text-sm text-muted">Overtime pays {formatMoney(overtimePay, currency)}/hour.</p>
        <ChoiceRow
          label="Overtime calculated"
          value={settings.overtimeMethod}
          options={[
            { value: 'daily', label: 'Each day' },
            { value: 'weekly', label: 'Each week' },
          ]}
          onChange={(overtimeMethod: OvertimeMethod) => void updateSettings({ overtimeMethod })}
        />
        <p className="py-3 text-xs leading-5 text-muted">
          New shifts keep a copy of these rules. Changing your rate does not change money already recorded on past shifts.
        </p>
      </Section>

      <Section title="Tax">
        <TaxCodeRow value={settings.taxCode} onCommit={(taxCode) => void updateSettings({ taxCode })} />
        <p className="py-3 text-xs leading-5 text-muted">
          {parseTaxCode(settings.taxCode)?.summary} WorkTrack uses the shifts saved since 6 April and the tax week of each one. A week you did not record still
          adds unused allowance on a cumulative code. National Insurance is category A, calculated on each week on its own. Pension contributions and
          student loans are not deducted. Gross pay already recorded on a shift stays as it is.
        </p>
      </Section>

      <Section title="Working time">
        <NumberRow label="Normal daily hours" value={settings.normalDailyHours} onCommit={(normalDailyHours) => void updateSettings({ normalDailyHours })} />
        <NumberRow label="Normal weekly hours" value={settings.normalWeeklyHours} onCommit={(normalWeeklyHours) => void updateSettings({ normalWeeklyHours })} />
        <NumberRow
          label="Default break"
          value={settings.defaultBreakMinutes}
          integer
          suffix="min"
          onCommit={(defaultBreakMinutes) => void updateSettings({ defaultBreakMinutes })}
        />
        <NumberRow label="Weekly hours target" value={settings.weeklyHoursTarget} onCommit={(weeklyHoursTarget) => void updateSettings({ weeklyHoursTarget })} />
        <NumberRow
          label="Weekly earnings target"
          value={settings.weeklyEarningsTarget}
          onCommit={(weeklyEarningsTarget) => void updateSettings({ weeklyEarningsTarget })}
        />
        <NumberRow
          label="Monthly earnings target"
          value={settings.monthlyEarningsTarget}
          onCommit={(monthlyEarningsTarget) => void updateSettings({ monthlyEarningsTarget })}
        />
        <SelectRow label="Timezone" value={settings.timezone} options={zones.map((zone) => ({ value: zone, label: zone }))} onChange={(timezone) => void updateSettings({ timezone })} />
        <p className="py-3 text-xs leading-5 text-muted">Days, weeks, and months are calculated in this timezone, including shifts that pass midnight or a clock change.</p>
      </Section>

      <Section title="Appearance">
        <ChoiceRow
          label="Theme"
          value={settings.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          onChange={(theme: ThemeMode) => void updateSettings({ theme })}
        />
        <ChoiceRow
          label="Time format"
          value={settings.timeFormat}
          options={[
            { value: '24', label: '24-hour' },
            { value: '12', label: '12-hour' },
          ]}
          onChange={(timeFormat: TimeFormat) => void updateSettings({ timeFormat })}
        />
        <ChoiceRow
          label="Week starts"
          value={String(settings.weekStartsOn)}
          options={[
            { value: '1', label: 'Monday' },
            { value: '0', label: 'Sunday' },
          ]}
          onChange={(value: string) => void updateSettings({ weekStartsOn: value === '0' ? 0 : 1 })}
        />
      </Section>

      <Section title="Schedule">
        {orderedSchedules.length === 0 && <p className="py-3 text-sm text-muted">Add the shifts you usually work to see what’s next.</p>}
        {orderedSchedules.map((schedule) => (
          <div key={schedule.id} className="border-b border-stroke py-3 last:border-0">
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Weekday"
                className={fieldClass}
                value={schedule.weekday}
                onChange={(event) => void saveSchedule({ ...schedule, weekday: Number(event.target.value) })}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.long}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-end gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={(event) => void saveSchedule({ ...schedule, enabled: event.target.checked })}
                />
                Enabled
              </label>
              <input
                aria-label="Start time"
                className={fieldClass}
                type="time"
                value={schedule.startTime}
                onChange={(event) => void saveSchedule({ ...schedule, startTime: event.target.value.slice(0, 5) })}
              />
              <input
                aria-label="Finish time"
                className={fieldClass}
                type="time"
                value={schedule.endTime}
                onChange={(event) => void saveSchedule({ ...schedule, endTime: event.target.value.slice(0, 5) })}
              />
            </div>
            {schedule.endTime < schedule.startTime && <p className="mt-2 text-xs text-muted">Ends the next morning.</p>}
            {schedule.endTime === schedule.startTime && <p className="mt-2 text-xs text-amber">Choose a different finish time.</p>}
            <button type="button" className="mt-2 text-sm text-danger" onClick={() => void deleteSchedule(schedule.id)}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="py-3 text-sm font-medium text-gain"
          onClick={() =>
            void saveSchedule({
              id: uid(),
              weekday: 1,
              startTime: '09:00',
              endTime: '17:00',
              enabled: true,
            })
          }
        >
          Add scheduled shift
        </button>
      </Section>

      <Section title="Notifications">
        <ToggleRow label="Clock-in reminder" checked={settings.notifications.clockInReminder} onChange={(clockInReminder) => void saveNotifications({ clockInReminder })} />
        {settings.notifications.clockInReminder && (
          <TimeRow label="Remind me at" value={settings.notifications.clockInTime} onChange={(clockInTime) => void saveNotifications({ clockInTime })} />
        )}
        <ToggleRow label="Clock-out reminder" checked={settings.notifications.clockOutReminder} onChange={(clockOutReminder) => void saveNotifications({ clockOutReminder })} />
        {settings.notifications.clockOutReminder && (
          <TimeRow label="Remind me at" value={settings.notifications.clockOutTime} onChange={(clockOutTime) => void saveNotifications({ clockOutTime })} />
        )}
        <ToggleRow label="Weekly summary" checked={settings.notifications.weeklySummary} onChange={(weeklySummary) => void saveNotifications({ weeklySummary })} />
        <ToggleRow
          label="Weekly hours target"
          checked={settings.notifications.weeklyHoursTarget}
          onChange={(weeklyHoursTarget) => void saveNotifications({ weeklyHoursTarget })}
        />
        <ToggleRow
          label="Monthly earnings target"
          checked={settings.notifications.monthlyEarningsTarget}
          onChange={(monthlyEarningsTarget) => void saveNotifications({ monthlyEarningsTarget })}
        />
        <p className="py-3 text-xs leading-5 text-muted">
          {permissionText(permission)} On iPhone, system notifications work only after you add WorkTrack to the Home Screen, and only while the app is open.
          iOS cannot reliably deliver a scheduled web notification after you leave the app. WorkTrack checks reminders when you open it and shows them in the app.
        </p>
      </Section>

      <Section title="Backup">
        <button type="button" className="block w-full border-b border-stroke py-3 text-left text-[15px]" onClick={() => void shareOrDownload(`worktrack-${stamp}.csv`, shiftsToCsv(shifts, summary.slices, settings.timezone, settings.timeFormat), 'text/csv')}>
          Export shifts as CSV
        </button>
        <button type="button" className="block w-full border-b border-stroke py-3 text-left text-[15px]" onClick={() => void shareOrDownload(`worktrack-backup-${stamp}.json`, createBackup(settings, shifts, schedules), 'application/json')}>
          Download full backup
        </button>
        <button type="button" className="block w-full py-3 text-left text-[15px]" onClick={() => fileRef.current?.click()}>
          Restore a backup
        </button>
        <input ref={fileRef} className="hidden" type="file" accept="application/json" onChange={onImport} />
        <p className="pb-3 text-xs leading-5 text-muted">
          Everything stays on this device. A JSON backup restores shifts, schedules, and settings. CSV is for a spreadsheet. Restoring replaces the data already on this device.
        </p>
        {notice && <p className="pb-3 text-sm text-danger">{notice}</p>}
      </Section>

      <Section title="iPhone">
        <ol className="list-decimal space-y-1 py-3 pl-4 text-sm leading-6 text-muted">
          <li>Open the site in Safari. Chrome on iPhone cannot add it to the Home Screen.</li>
          <li>Tap Share.</li>
          <li>Tap Add to Home Screen, then Add.</li>
          <li>Open WorkTrack from the icon. It uses the full screen, and your shifts stay on the phone.</li>
        </ol>
      </Section>

      {pending && (
        <Confirm
          title="Restore this backup?"
          body="This replaces the shifts, schedule, and settings stored on this device."
          confirmLabel="Restore"
          danger
          onCancel={() => setPending(null)}
          onConfirm={() => {
            void replaceAllData(pending.settings, pending.shifts, pending.schedules).then(() => {
              setPending(null)
              setNotice('Backup restored.')
            })
          }}
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="rounded-[22px] border border-stroke bg-card px-4">{children}</div>
    </section>
  )
}

function NumberRow({
  label,
  value,
  onCommit,
  integer = false,
  suffix,
}: {
  label: string
  value: number
  onCommit: (value: number) => void
  integer?: boolean
  suffix?: string
}) {
  const [text, setText] = useState(formatInputNumber(value))
  useEffect(() => setText(formatInputNumber(value)), [value])
  const commit = () => {
    const parsed = parseNumber(text)
    if (parsed == null || parsed < 0) {
      setText(formatInputNumber(value))
      return
    }
    const next = integer ? Math.round(parsed) : Math.round(parsed * 100) / 100
    if (next !== value) onCommit(next)
    else setText(formatInputNumber(next))
  }
  return (
    <label className="flex items-center justify-between gap-3 border-b border-stroke py-3">
      <span className="text-[15px]">{label}</span>
      <span className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className="w-24 rounded-xl bg-[var(--field)] px-3 py-2 text-right tabular-nums outline-none"
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
    </label>
  )
}

function TaxCodeRow({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setText(value), [value])
  const commit = (next: string) => {
    const parsed = parseTaxCode(next)
    if (!parsed) {
      setError('Enter a UK tax code, such as 1257L, S1257L, BR, or K497.')
      return
    }
    setError(null)
    setText(parsed.canonical)
    if (parsed.canonical !== value) onCommit(parsed.canonical)
  }
  return (
    <label className="block border-b border-stroke py-3">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[15px]">Tax code</span>
        <input
          aria-label="Tax code"
          value={text}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value.toUpperCase())
            setError(null)
          }}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className="w-32 rounded-xl bg-[var(--field)] px-3 py-2 text-right tracking-wide uppercase outline-none"
        />
      </span>
      {error && <span className="mt-2 block text-xs text-danger">{error}</span>}
    </label>
  )
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-stroke py-3">
      <span className="text-[15px]">{label}</span>
      <select className="max-w-[58%] rounded-xl bg-[var(--field)] px-3 py-2 outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="border-b border-stroke py-3">
      <p className="mb-2 text-[15px]">{label}</p>
      <div className="flex rounded-xl bg-[var(--field)] p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`h-9 flex-1 rounded-lg text-sm font-medium ${option.value === value ? 'bg-card text-fg' : 'text-muted'}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stroke py-3">
      <span className="text-[15px]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`h-7 w-12 shrink-0 rounded-full p-0.5 ${checked ? 'bg-gain' : 'bg-[var(--track)]'}`}
      >
        <span className={`block h-6 w-6 rounded-full bg-white shadow ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-stroke py-3">
      <span className="text-[15px]">{label}</span>
      <input className="rounded-xl bg-[var(--field)] px-3 py-2 outline-none" type="time" value={value} onChange={(event) => onChange(event.target.value.slice(0, 5))} />
    </label>
  )
}

function permissionText(permission: ReturnType<typeof notificationSupport>): string {
  if (permission === 'granted') return 'System notifications are allowed.'
  if (permission === 'denied') return 'System notifications are blocked in the browser. In-app reminders still appear.'
  if (permission === 'unsupported') return 'This browser can’t show system notifications. In-app reminders still appear.'
  return 'WorkTrack asks for notification permission when you turn a reminder on.'
}
