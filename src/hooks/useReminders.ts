import { useEffect, useState } from 'react'
import { DateTime } from 'luxon'
import type { Settings } from '../types.ts'
import type { WorkSummary } from '../lib/calc.ts'
import { updateSettings } from '../lib/db.ts'
import { evaluateReminders, showSystemNotification, type ReminderToast } from '../lib/reminders.ts'
import { resolveZone } from '../lib/time.ts'

const seen = new Set<string>()
const written = new Set<string>()

export function useReminders(settings: Settings | null, summary: WorkSummary | null): {
  toast: ReminderToast | null
  dismiss: () => void
} {
  const [toast, setToast] = useState<ReminderToast | null>(null)

  useEffect(() => {
    if (!settings || !summary) return
    const decision = evaluateReminders({
      settings,
      status: summary.status,
      todayPaidMs: summary.today.paidMs,
      todayShiftCount: summary.today.shiftCount,
      weekPaidHours: summary.week.paidHours,
      weekKey: summary.weekKey,
      monthEarnings: summary.month.totalEarnings,
      monthKey: summary.monthKey,
      lastWeekEarnings: summary.lastWeek.totalEarnings,
      lastWeekHours: summary.lastWeek.paidHours,
      now: DateTime.fromMillis(Date.now(), { zone: resolveZone(settings.timezone) }),
    })
    const fresh = decision.toasts.filter((item) => !seen.has(item.id))
    for (const item of fresh) seen.add(item.id)
    const stateKey = JSON.stringify(decision.nextState)
    if (decision.changed && !written.has(stateKey)) {
      written.add(stateKey)
      void updateSettings({ notificationState: decision.nextState })
    }
    if (fresh[0]) {
      setToast(fresh[0])
      for (const item of fresh) showSystemNotification(item.title, item.body)
    }
  }, [settings, summary])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 8000)
    return () => window.clearTimeout(id)
  }, [toast])

  return { toast, dismiss: () => setToast(null) }
}
