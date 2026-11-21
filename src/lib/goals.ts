import type { Goal, GoalDeposit } from '../types.ts'

export interface GoalTotals {
  saved: number
  remaining: number
  progress: number
  reached: boolean
}

export function totalsForGoal(goal: Goal, deposits: GoalDeposit[]): GoalTotals {
  const saved = roundPence(deposits.filter((deposit) => deposit.goalId === goal.id).reduce((sum, deposit) => sum + deposit.amount, 0))
  const target = roundPence(Math.max(0, goal.targetAmount))
  const remaining = roundPence(Math.max(0, target - saved))
  const progress = target > 0 ? saved / target : 0
  return {
    saved,
    remaining,
    progress,
    reached: target > 0 && saved + 0.004 >= target,
  }
}

/** How long the remainder would take if this week's take-home were set aside. */
export function paceLine(remaining: number, weekTakeHome: number): string | null {
  if (remaining <= 0.004 || weekTakeHome <= 0.5) return null
  const weeks = remaining / weekTakeHome
  if (weeks < 0.5) return "Less than a week of this week's take-home."
  const rounded = Math.max(1, Math.round(weeks))
  const unit = rounded === 1 ? 'week' : 'weeks'
  return `About ${rounded} ${unit} of this week's take-home.`
}

function roundPence(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
}
