import type { DateTime } from 'luxon'
import type { NotificationState, Settings } from '../types.ts'
import { formatHours, formatMoney } from './format.ts'
import { applyTime } from './time.ts'

export interface ReminderInput {
  settings: Settings
  status: 'off' | 'working' | 'break'
  todayPaidMs: number
  todayShiftCount: number
  weekPaidHours: number
  weekKey: string
  monthEarnings: number
  monthKey: string
  lastWeekEarnings: number
  lastWeekHours: number
  now: DateTime
}

export interface ReminderToast {
  id: string
  title: string
  body: string
}

export function evaluateReminders(input: ReminderInput): { toasts: ReminderToast[]; nextState: NotificationState; changed: boolean } {
  const { settings, now } = input
  const flags: NotificationState = { ...settings.notificationState }
  const toasts: ReminderToast[] = []
  const today = now.toISODate() ?? ''
  const notifications = settings.notifications

  if (notifications.clockInReminder && input.status === 'off' && input.todayPaidMs <= 0 && input.todayShiftCount === 0) {
    const start = applyTime(now.startOf('day'), notifications.clockInTime)
    if (now >= start && now < start.plus({ hours: 1 }) && flags.clockInDate !== today) {
      toasts.push({ id: `clock-in:${today}`, title: 'Time to clock in', body: 'Your clock-in reminder is due.' })
      flags.clockInDate = today
    }
  }

  if (notifications.clockOutReminder && input.status !== 'off') {
    const start = applyTime(now.startOf('day'), notifications.clockOutTime)
    if (now >= start && flags.clockOutDate !== today) {
      toasts.push({
        id: `clock-out:${today}`,
        title: 'Still clocked in',
        body: 'Remember to clock out when your shift ends.',
      })
      flags.clockOutDate = today
    }
  }

  if (notifications.weeklyHoursTarget && settings.weeklyHoursTarget > 0 && input.weekPaidHours >= settings.weeklyHoursTarget) {
    if (flags.weeklyTargetWeek !== input.weekKey) {
      toasts.push({
        id: `week-target:${input.weekKey}`,
        title: 'Weekly hours reached',
        body: `You’ve reached ${formatHours(settings.weeklyHoursTarget)} this week.`,
      })
      flags.weeklyTargetWeek = input.weekKey
    }
  }

  if (
    notifications.monthlyEarningsTarget &&
    settings.monthlyEarningsTarget > 0 &&
    input.monthEarnings >= settings.monthlyEarningsTarget
  ) {
    if (flags.monthlyTargetMonth !== input.monthKey) {
      toasts.push({
        id: `month-target:${input.monthKey}`,
        title: 'Monthly target reached',
        body: `You’ve earned ${formatMoney(input.monthEarnings, settings.currency)} this month.`,
      })
      flags.monthlyTargetMonth = input.monthKey
    }
  }

  if (notifications.weeklySummary && flags.weeklySummaryWeek !== input.weekKey) {
    if (input.lastWeekEarnings > 0 || input.lastWeekHours > 0) {
      toasts.push({
        id: `week-summary:${input.weekKey}`,
        title: 'Last week',
        body: `You earned ${formatMoney(input.lastWeekEarnings, settings.currency)} across ${formatHours(input.lastWeekHours)}.`,
      })
    }
    flags.weeklySummaryWeek = input.weekKey
  }

  const changed = JSON.stringify(flags) !== JSON.stringify(settings.notificationState)
  return { toasts, nextState: flags, changed }
}

export function notificationSupport(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'unsupported'
  }
}

export function showSystemNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: 'pwa-192x192.png' })
  } catch {
    void navigator.serviceWorker?.getRegistration().then((registration) => {
      void registration?.showNotification(title, { body, icon: 'pwa-192x192.png' })
    })
  }
}
