import { describe, expect, it } from 'vitest'
import { allocateTakeHome, parseTaxCode, sumTakeHome, weeklyNationalInsurance } from '../lib/tax.ts'

function oneWeek(dateKey: string, earnings: number, code: string) {
  const parts = allocateTakeHome([{ key: 'a', dateKey, startMs: 0, earnings }], code)
  return parts.get('a')
}

describe('tax codes', () => {
  it('reads a standard allowance code', () => {
    const code = parseTaxCode(' 1257l ')
    expect(code?.canonical).toBe('1257L')
    expect(code?.annualAmount).toBe(12570)
    expect(code?.region).toBe('england')
  })

  it('reads Scottish, Welsh, flat, K, and emergency codes', () => {
    expect(parseTaxCode('S1257L')?.region).toBe('scotland')
    expect(parseTaxCode('C1257L')?.region).toBe('wales')
    expect(parseTaxCode('BR')?.flatRate).toBe(0.2)
    expect(parseTaxCode('D0')?.flatRate).toBe(0.4)
    expect(parseTaxCode('D1')?.flatRate).toBe(0.45)
    expect(parseTaxCode('NT')?.treatment).toBe('none')
    expect(parseTaxCode('0T')?.treatment).toBe('bands')
    expect(parseTaxCode('K497')?.annualAmount).toBe(4970)
    expect(parseTaxCode('1257L W1')?.basis).toBe('week1')
    expect(parseTaxCode('not a code')).toBeNull()
  })

  it('charges week 1 of 1257L on pay above £242', () => {
    const part = oneWeek('2026-04-06', 480, '1257L')
    expect(part?.tax).toBe(47.6)
    expect(part?.nationalInsurance).toBe(19.04)
    expect(part?.takeHome).toBe(413.36)
  })

  it('takes nothing from a week inside both allowances', () => {
    const part = oneWeek('2026-04-06', 166.74, '1257L')
    expect(part?.tax).toBe(0)
    expect(part?.nationalInsurance).toBe(0)
    expect(part?.takeHome).toBe(166.74)
  })

  it('keeps National Insurance when the tax code removes income tax', () => {
    const part = oneWeek('2026-04-06', 480, 'NT')
    expect(part?.tax).toBe(0)
    expect(part?.nationalInsurance).toBe(19.04)
    expect(part?.takeHome).toBe(460.96)
  })

  it('taxes a BR code at 20% and still deducts National Insurance', () => {
    const part = oneWeek('2026-04-06', 480, 'BR')
    expect(part?.tax).toBe(96)
    expect(part?.nationalInsurance).toBe(19.04)
    expect(part?.takeHome).toBe(364.96)
  })

  it('uses Scottish bands for an S code', () => {
    const part = oneWeek('2026-04-06', 480, 'S1257L')
    expect(part?.tax).toBe(46.84)
    expect(part?.nationalInsurance).toBe(19.04)
    expect(part?.takeHome).toBe(414.12)
  })

  it('charges National Insurance when the tax-free amount is higher than the NI threshold', () => {
    const part = oneWeek('2026-04-06', 270, '1500L')
    expect(part?.tax).toBe(0)
    expect(part?.nationalInsurance).toBe(2.24)
    expect(weeklyNationalInsurance(270)).toBe(2.24)
  })

  it('caps a K code at half the week’s gross', () => {
    const part = oneWeek('2026-04-06', 100, 'K5000')
    expect(part?.tax).toBe(50)
    expect(part?.nationalInsurance).toBe(0)
    expect(part?.takeHome).toBe(50)
  })

  it('refunds earlier tax when a later cumulative week is still inside the allowance', () => {
    const parts = allocateTakeHome(
      [
        { key: 'w1', dateKey: '2026-04-06', startMs: 1, earnings: 480 },
        { key: 'w10', dateKey: '2026-06-08', startMs: 2, earnings: 480 },
      ],
      '1257L',
    )
    expect(parts.get('w1')?.tax).toBe(47.6)
    expect(parts.get('w10')?.tax).toBe(-47.6)
    expect(sumTakeHome([parts.get('w1')!, parts.get('w10')!]).tax).toBe(0)
  })

  it('taxes each week on its own when the code is week 1', () => {
    const parts = allocateTakeHome(
      [
        { key: 'w1', dateKey: '2026-04-06', startMs: 1, earnings: 480 },
        { key: 'w10', dateKey: '2026-06-08', startMs: 2, earnings: 480 },
      ],
      '1257L W1',
    )
    expect(parts.get('w1')?.tax).toBe(47.6)
    expect(parts.get('w10')?.tax).toBe(47.6)
  })
})
