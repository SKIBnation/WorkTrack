import { describe, expect, it } from 'vitest'
import { paceLine, totalsForGoal } from '../lib/goals.ts'
import type { Goal, GoalDeposit } from '../types.ts'

const goal: Goal = { id: 'phone', name: 'New phone', targetAmount: 200, createdAt: '2026-11-01T00:00:00.000Z' }

function deposit(id: string, amount: number, goalId = 'phone'): GoalDeposit {
  return { id, goalId, amount, createdAt: '2026-11-21T00:00:00.000Z' }
}

describe('goal totals', () => {
  it('sums only the deposits for that goal', () => {
    const totals = totalsForGoal(goal, [deposit('a', 40), deposit('b', 10.5), deposit('c', 80, 'trip')])
    expect(totals.saved).toBe(50.5)
    expect(totals.remaining).toBe(149.5)
    expect(totals.reached).toBe(false)
    expect(totals.progress).toBeCloseTo(50.5 / 200)
  })

  it('treats a goal as reached once the saved amount covers the target', () => {
    const totals = totalsForGoal(goal, [deposit('a', 199.996)])
    expect(totals.reached).toBe(true)
    expect(totals.remaining).toBe(0)
  })
})

describe('savings pace', () => {
  it('estimates the remaining amount from this week’s take-home', () => {
    expect(paceLine(149.5, 50)).toBe("About 3 weeks of this week's take-home.")
    expect(paceLine(20, 50)).toBe("Less than a week of this week's take-home.")
    expect(paceLine(50, 50)).toBe("About 1 week of this week's take-home.")
  })

  it('stays quiet until there is both money left and take-home to measure it against', () => {
    expect(paceLine(0, 50)).toBeNull()
    expect(paceLine(100, 0)).toBeNull()
  })
})
