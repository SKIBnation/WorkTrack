import type { BackgroundId } from './lib/backgrounds.ts'

export type ThemeMode = 'dark' | 'light'
export type TimeFormat = '12' | '24'
export type WeekStart = 0 | 1
export type OvertimeMethod = 'daily' | 'weekly'
export type OvertimeMode = 'multiplier' | 'custom'

export interface BreakEntry {
  id: string
  /** Unpaid length. Timed breaks also store the exact start and end. */
  minutes: number
  start: string | null
  end: string | null
}

export interface Shift {
  id: string
  clockIn: string
  clockOut: string | null
  breaks: BreakEntry[]
  hourlyRate: number
  currency: string
  overtimeMode: OvertimeMode
  overtimeMultiplier: number
  overtimeRate: number
  overtimeMethod: OvertimeMethod
  normalDailyHours: number
  normalWeeklyHours: number
  createdAt: string
  updatedAt: string
}

export interface Schedule {
  id: string
  /** Luxon weekday: Monday is 1 and Sunday is 7. */
  weekday: number
  startTime: string
  endTime: string
  enabled: boolean
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  createdAt: string
}

/** Money put aside toward a goal. The saved total is the sum of these amounts. */
export interface GoalDeposit {
  id: string
  goalId: string
  amount: number
  createdAt: string
}

export interface NotificationPreferences {
  clockInReminder: boolean
  clockOutReminder: boolean
  clockInTime: string
  clockOutTime: string
  weeklySummary: boolean
  weeklyHoursTarget: boolean
  monthlyEarningsTarget: boolean
}

export interface NotificationState {
  clockInDate: string | null
  clockOutDate: string | null
  weeklySummaryWeek: string | null
  weeklyTargetWeek: string | null
  monthlyTargetMonth: string | null
}

export interface Settings {
  id: 'app'
  hourlyRate: number
  currency: string
  overtimeMode: OvertimeMode
  overtimeMultiplier: number
  overtimeRate: number
  overtimeMethod: OvertimeMethod
  normalDailyHours: number
  normalWeeklyHours: number
  defaultBreakMinutes: number
  weeklyHoursTarget: number
  weeklyEarningsTarget: number
  monthlyEarningsTarget: number
  /** UK PAYE code, such as 1257L. Used only to estimate take-home pay. */
  taxCode: string
  theme: ThemeMode
  background: BackgroundId
  timeFormat: TimeFormat
  weekStartsOn: WeekStart
  timezone: string
  notifications: NotificationPreferences
  notificationState: NotificationState
  installHintDismissed: boolean
}
