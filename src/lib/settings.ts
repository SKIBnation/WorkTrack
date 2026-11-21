import type { Settings } from '../types.ts'
import { parseTaxCode } from './tax.ts'

export const SETTINGS_ID = 'app' as const

export function defaultSettings(): Settings {
  return {
    id: SETTINGS_ID,
    hourlyRate: 12,
    currency: 'GBP',
    overtimeMode: 'multiplier',
    overtimeMultiplier: 1.5,
    overtimeRate: 18,
    overtimeMethod: 'weekly',
    normalDailyHours: 8,
    normalWeeklyHours: 40,
    defaultBreakMinutes: 30,
    weeklyHoursTarget: 40,
    weeklyEarningsTarget: 480,
    monthlyEarningsTarget: 2000,
    taxCode: '1257L',
    theme: 'dark',
    timeFormat: '24',
    weekStartsOn: 1,
    timezone: 'Europe/London',
    notifications: {
      clockInReminder: false,
      clockOutReminder: false,
      clockInTime: '09:00',
      clockOutTime: '17:00',
      weeklySummary: false,
      weeklyHoursTarget: false,
      monthlyEarningsTarget: false,
    },
    notificationState: {
      clockInDate: null,
      clockOutDate: null,
      weeklySummaryWeek: null,
      weeklyTargetWeek: null,
      monthlyTargetMonth: null,
    },
    installHintDismissed: false,
  }
}

export function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const base = defaultSettings()
  if (!input) return base
  return {
    ...base,
    ...input,
    id: SETTINGS_ID,
    taxCode: parseTaxCode(input.taxCode)?.canonical ?? base.taxCode,
    notifications: { ...base.notifications, ...input.notifications },
    notificationState: { ...base.notificationState, ...input.notificationState },
  }
}
