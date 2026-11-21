import type { DateTime } from 'luxon'
import type { TimeFormat } from '../types.ts'

export const CURRENCIES = [
  { code: 'GBP', label: 'British pound (£)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'US dollar ($)' },
  { code: 'CAD', label: 'Canadian dollar ($)' },
  { code: 'AUD', label: 'Australian dollar ($)' },
  { code: 'NZD', label: 'New Zealand dollar ($)' },
  { code: 'CHF', label: 'Swiss franc' },
  { code: 'SEK', label: 'Swedish krona' },
  { code: 'NOK', label: 'Norwegian krone' },
  { code: 'DKK', label: 'Danish krone' },
  { code: 'PLN', label: 'Polish złoty' },
  { code: 'JPY', label: 'Japanese yen (¥)' },
  { code: 'INR', label: 'Indian rupee (₹)' },
] as const

const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0
  try {
    let formatter = moneyFormatters.get(currency)
    if (!formatter) {
      formatter = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      })
      moneyFormatters.set(currency, formatter)
    }
    return formatter.format(safe)
  } catch {
    return `${safe.toFixed(2)} ${currency}`
  }
}

export function formatSignedMoney(amount: number, currency: string): string {
  if (amount > 0.004) return `+${formatMoney(amount, currency)}`
  return formatMoney(amount, currency)
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h'
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes <= 0) return '0h'
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (wholeHours === 0) return `${minutes}m`
  if (minutes === 0) return `${wholeHours}h`
  return `${wholeHours}h ${minutes}m`
}

export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatTime(dt: DateTime, timeFormat: TimeFormat): string {
  if (!dt.isValid) return '—'
  return timeFormat === '12' ? dt.toFormat('h:mm a') : dt.toFormat('HH:mm')
}

export function formatDay(dt: DateTime): string {
  if (!dt.isValid) return '—'
  return dt.toFormat('ccc d LLL')
}

export function formatLongDay(dt: DateTime): string {
  if (!dt.isValid) return '—'
  return dt.toFormat('cccc d LLLL yyyy')
}

export function formatUpcoming(start: DateTime, end: DateTime, now: DateTime, timeFormat: TimeFormat): string {
  const dayLabel = start.hasSame(now, 'day')
    ? 'Today'
    : start.hasSame(now.plus({ days: 1 }), 'day')
      ? 'Tomorrow'
      : start.toFormat('ccc d LLL')
  const endLabel = end.hasSame(start, 'day') ? formatTime(end, timeFormat) : `${end.toFormat('ccc')} ${formatTime(end, timeFormat)}`
  return `${dayLabel} · ${formatTime(start, timeFormat)} – ${endLabel}`
}

export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0%'
  return `${Math.round(fraction * 100)}%`
}

export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!trimmed) return null
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : null
}

export function formatInputNumber(value: number): string {
  if (!Number.isFinite(value)) return ''
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 100) / 100)
}
