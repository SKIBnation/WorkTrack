import { DateTime } from 'luxon'

/** Taxable-income bands for 6 April 2026 to 5 April 2027, after the tax-code allowance. */
const REST_OF_UK_BANDS: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 37_700, rate: 0.2 },
  { upTo: 125_140, rate: 0.4 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
]

const SCOTLAND_BANDS: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 3_967, rate: 0.19 },
  { upTo: 16_956, rate: 0.2 },
  { upTo: 31_092, rate: 0.21 },
  { upTo: 62_430, rate: 0.42 },
  { upTo: 125_140, rate: 0.45 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.48 },
]

const NI_PRIMARY_WEEK = 242
const NI_UPPER_WEEK = 967

export interface ParsedTaxCode {
  canonical: string
  region: 'england' | 'scotland' | 'wales'
  basis: 'cumulative' | 'week1'
  treatment: 'allowance' | 'k' | 'bands' | 'flat' | 'none'
  /** Annual allowance, or the amount a K code adds across the year. */
  annualAmount: number
  flatRate: number
  summary: string
}

export interface TaxableEarning {
  key: string
  dateKey: string
  startMs: number
  earnings: number
}

export interface TakeHomePart {
  tax: number
  nationalInsurance: number
  takeHome: number
}

export function parseTaxCode(raw: string | null | undefined): ParsedTaxCode | null {
  const compact = (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  if (!compact) return null
  const match = compact.match(/^(?:([SC]) ?)?(?:(NT)|(BR)|(D0)|(D1)|(0T)|(K)(\d{1,4})|(\d{1,4})([LMNT]))(?: (W1|M1|X))?$/)
  if (!match) return null

  const region = match[1] === 'S' ? 'scotland' : match[1] === 'C' ? 'wales' : 'england'
  const basis = match[11] ? 'week1' : 'cumulative'
  const prefix = match[1] ?? ''
  const emergency = match[11] ? ` ${match[11]}` : ''
  const place = region === 'scotland' ? 'Scotland' : region === 'wales' ? 'Wales' : 'England and Northern Ireland'

  if (match[2]) {
    return {
      canonical: `${prefix}NT${emergency}`,
      region,
      basis,
      treatment: 'none',
      annualAmount: 0,
      flatRate: 0,
      summary: `No income tax on this job. National Insurance still applies. ${place}.`,
    }
  }
  if (match[3] || match[4] || match[5]) {
    const flatRate = match[3] ? 0.2 : match[4] ? 0.4 : 0.45
    const body = match[3] ? 'BR' : match[4] ? 'D0' : 'D1'
    return {
      canonical: `${prefix}${body}${emergency}`,
      region,
      basis,
      treatment: 'flat',
      annualAmount: 0,
      flatRate,
      summary: `All pay is taxed at ${flatRate * 100}%, with no tax-free amount. ${place}.`,
    }
  }
  if (match[6]) {
    return {
      canonical: `${prefix}0T${emergency}`,
      region,
      basis,
      treatment: 'bands',
      annualAmount: 0,
      flatRate: 0,
      summary: `No tax-free pay. Income is taxed through the ${place} bands.`,
    }
  }
  if (match[7] && match[8]) {
    const annualAmount = Number(match[8]) * 10
    return {
      canonical: `${prefix}K${match[8]}${emergency}`,
      region,
      basis,
      treatment: 'k',
      annualAmount,
      flatRate: 0,
      summary: `Adds ${pounds(annualAmount)} to taxable pay over the year. Tax in one week cannot exceed half of that week's gross. ${place}.`,
    }
  }

  const annualAmount = Number(match[9]) * 10
  const suffix = match[10] ?? 'L'
  const suffixNote =
    suffix === 'M'
      ? ' Marriage Allowance received is already included in the number.'
      : suffix === 'N'
        ? ' Marriage Allowance transferred is already included in the number.'
        : suffix === 'T'
          ? ' Other items from HMRC are already included in the number.'
          : ''
  const weekFree = Math.round(annualAmount / 52)
  return {
    canonical: `${prefix}${match[9]}${suffix}${emergency}`,
    region,
    basis,
    treatment: 'allowance',
    annualAmount,
    flatRate: 0,
    summary: `Tax-free pay is ${pounds(annualAmount)} a year, ${pounds(weekFree)} in week 1. ${place}.${suffixNote}`,
  }
}

export function allocateTakeHome(entries: TaxableEarning[], taxCode: string | null | undefined): Map<string, TakeHomePart> {
  const parsed = parseTaxCode(taxCode) ?? parseTaxCode('1257L')
  const result = new Map<string, TakeHomePart>()
  if (!parsed) return result

  const byYear = new Map<string, TaxableEarning[]>()
  for (const entry of entries) {
    if (!entry.dateKey) continue
    const year = taxYearStart(entry.dateKey)
    const group = byYear.get(year) ?? []
    group.push(entry)
    byYear.set(year, group)
  }

  for (const group of byYear.values()) {
    allocateYear(group, parsed, result)
  }

  for (const entry of entries) {
    if (!result.has(entry.key)) result.set(entry.key, { tax: 0, nationalInsurance: 0, takeHome: roundPence(entry.earnings) })
  }
  return result
}

export function sumTakeHome(parts: TakeHomePart[]): TakeHomePart {
  let tax = 0
  let nationalInsurance = 0
  let takeHome = 0
  for (const part of parts) {
    tax += part.tax
    nationalInsurance += part.nationalInsurance
    takeHome += part.takeHome
  }
  return { tax: roundPence(tax), nationalInsurance: roundPence(nationalInsurance), takeHome: roundPence(takeHome) }
}

function allocateYear(entries: TaxableEarning[], code: ParsedTaxCode, into: Map<string, TakeHomePart>): void {
  const weeks = new Map<number, TaxableEarning[]>()
  for (const entry of entries) {
    const week = taxWeekNumber(entry.dateKey)
    const group = weeks.get(week) ?? []
    group.push(entry)
    weeks.set(week, group)
  }

  const standalone = code.basis === 'week1' || code.treatment === 'flat' || code.treatment === 'none'
  let yearGross = 0
  let taxPaid = 0

  for (const week of [...weeks.keys()].sort((a, b) => a - b)) {
    const slices = (weeks.get(week) ?? []).slice().sort((a, b) => a.startMs - b.startMs || a.key.localeCompare(b.key))
    let running = 0
    let niRunning = 0
    let taxRunning = 0
    for (const slice of slices) {
      running = roundPence(running + slice.earnings)
      const due = incomeTaxDue(standalone ? running : yearGross + running, standalone ? 1 : week, code)
      let weekTax = roundPence(due - (standalone ? 0 : taxPaid))
      if (code.treatment === 'k' && weekTax > running * 0.5) weekTax = roundPence(running * 0.5)
      const tax = roundPence(weekTax - taxRunning)
      const niNow = weeklyNationalInsurance(running)
      const nationalInsurance = roundPence(niNow - niRunning)
      into.set(slice.key, {
        tax,
        nationalInsurance,
        takeHome: roundPence(slice.earnings - tax - nationalInsurance),
      })
      taxRunning = weekTax
      niRunning = niNow
    }
    if (!standalone) {
      yearGross = roundPence(yearGross + running)
      taxPaid = roundPence(taxPaid + taxRunning)
    }
  }
}

function incomeTaxDue(grossToDate: number, week: number, code: ParsedTaxCode): number {
  if (code.treatment === 'none') return 0
  if (code.treatment === 'flat') return roundPence(grossToDate * code.flatRate)
  const periods = Math.min(53, Math.max(1, week))
  const adjustment =
    code.treatment === 'k'
      ? Math.round((code.annualAmount * periods) / 52)
      : code.treatment === 'bands'
        ? 0
        : Math.round((code.annualAmount * periods) / 52)
  const taxable = Math.max(0, code.treatment === 'k' ? grossToDate + adjustment : grossToDate - adjustment)
  return roundPence(taxOnTaxable(taxable, periods, code.region === 'scotland' ? SCOTLAND_BANDS : REST_OF_UK_BANDS))
}

function taxOnTaxable(taxable: number, week: number, bands: ReadonlyArray<{ upTo: number; rate: number }>): number {
  let tax = 0
  let previous = 0
  for (const band of bands) {
    const limit = Number.isFinite(band.upTo) ? (band.upTo * week) / 52 : Number.POSITIVE_INFINITY
    const slice = Math.max(0, Math.min(taxable, limit) - previous)
    tax += slice * band.rate
    previous = limit
  }
  return tax
}

export function weeklyNationalInsurance(gross: number): number {
  const main = Math.max(0, Math.min(gross, NI_UPPER_WEEK) - NI_PRIMARY_WEEK) * 0.08
  const upper = Math.max(0, gross - NI_UPPER_WEEK) * 0.02
  return roundPence(main + upper)
}

function taxYearStart(dateKey: string): string {
  const year = Number(dateKey.slice(0, 4))
  return dateKey < `${year}-04-06` ? `${year - 1}-04-06` : `${year}-04-06`
}

function taxWeekNumber(dateKey: string): number {
  const start = DateTime.fromISO(taxYearStart(dateKey), { zone: 'utc' })
  const date = DateTime.fromISO(dateKey, { zone: 'utc' })
  const days = Math.floor(date.diff(start, 'days').days)
  return Math.min(53, Math.floor(days / 7) + 1)
}

function roundPence(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function pounds(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}
