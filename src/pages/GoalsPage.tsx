import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Confirm, PageHeader, ProgressBar, Sheet, fieldClass } from '../components/ui.tsx'
import { useWorkData } from '../hooks/useWorkData.ts'
import { addDeposit, deleteDeposit, deleteGoal, saveGoal, uid } from '../lib/db.ts'
import { formatDay, formatMoney, formatPercent, parseNumber } from '../lib/format.ts'
import { paceLine, totalsForGoal } from '../lib/goals.ts'
import { instantInZone, resolveZone } from '../lib/time.ts'
import type { Goal, GoalDeposit } from '../types.ts'

export function GoalsPage() {
  const { ready, settings, goals, deposits, summary, now } = useWorkData()
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!ready || !settings || !summary) return <p className="py-16 text-center text-muted">Loading…</p>

  const currency = settings.currency
  const zone = resolveZone(settings.timezone)
  const selected = goals.find((goal) => goal.id === selectedId) ?? null
  const ordered = [...goals].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const saving = ordered.filter((goal) => !totalsForGoal(goal, deposits).reached)
  const reached = ordered.filter((goal) => totalsForGoal(goal, deposits).reached)
  const weekTakeHome = summary.takeHome.week.takeHome

  return (
    <div>
      <PageHeader
        title="Goals"
        action={
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-gain text-[var(--gain-ink)]" aria-label="Add a goal" onClick={() => setCreating(true)}>
            <Plus size={20} />
          </button>
        }
      />

      {goals.length === 0 ? (
        <Card>
          <p className="text-[17px] font-semibold tracking-tight">Save up for something</p>
          <p className="mt-2 text-sm leading-6 text-muted">A trip, a phone, a day off. Add what it costs, then put money aside as you earn it.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            Add a goal
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {saving.length > 0 && (
            <GoalList title="Saving" goals={saving} deposits={deposits} currency={currency} weekTakeHome={weekTakeHome} onOpen={setSelectedId} />
          )}
          {reached.length > 0 && (
            <GoalList title="Reached" goals={reached} deposits={deposits} currency={currency} weekTakeHome={weekTakeHome} onOpen={setSelectedId} />
          )}
        </div>
      )}

      {creating && (
        <GoalDraft
          currency={currency}
          onClose={() => setCreating(false)}
          onSave={async (name, target, alreadySaved) => {
            const id = uid()
            const createdAt = new Date(now).toISOString()
            await saveGoal({ id, name, targetAmount: target, createdAt })
            if (alreadySaved > 0) await addDeposit(id, alreadySaved)
            setCreating(false)
            setSelectedId(id)
          }}
        />
      )}

      {selected && (
        <GoalDetail
          goal={selected}
          deposits={deposits.filter((deposit) => deposit.goalId === selected.id)}
          currency={currency}
          zone={zone}
          weekTakeHome={weekTakeHome}
          onClose={() => {
            setSelectedId(null)
            setConfirmDelete(false)
          }}
          onSave={(name, target) => void saveGoal({ ...selected, name, targetAmount: target })}
          onAdd={(amount) => void addDeposit(selected.id, amount)}
          onRemoveDeposit={(id) => void deleteDeposit(id)}
          onAskDelete={() => setConfirmDelete(true)}
        />
      )}

      {confirmDelete && selected && (
        <Confirm
          title={`Delete ${selected.name}?`}
          body="This removes the goal and the money you logged toward it. It does not change your shifts."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            void deleteGoal(selected.id)
            setConfirmDelete(false)
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}

function GoalList({
  title,
  goals,
  deposits,
  currency,
  weekTakeHome,
  onOpen,
}: {
  title: string
  goals: Goal[]
  deposits: GoalDeposit[]
  currency: string
  weekTakeHome: number
  onOpen: (id: string) => void
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="space-y-3">
        {goals.map((goal) => {
          const totals = totalsForGoal(goal, deposits)
          const pace = paceLine(totals.remaining, weekTakeHome)
          return (
            <button key={goal.id} type="button" className="block w-full text-left" onClick={() => onOpen(goal.id)}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[17px] font-semibold tracking-tight">{goal.name}</p>
                  <p className="shrink-0 text-sm tabular-nums text-muted">{formatPercent(totals.progress)}</p>
                </div>
                <p className="mt-2 text-[28px] leading-none font-semibold tracking-tight text-gain tabular-nums">{formatMoney(totals.saved, currency)}</p>
                <p className="mt-2 text-sm text-muted tabular-nums">of {formatMoney(goal.targetAmount, currency)}</p>
                <div className="mt-4">
                  <ProgressBar value={totals.progress} label={`${goal.name} saved`} />
                </div>
                <p className="mt-3 text-sm text-muted">{totals.reached ? 'Saved.' : `${formatMoney(totals.remaining, currency)} still to save.${pace ? ` ${pace}` : ''}`}</p>
              </Card>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function GoalDraft({
  currency,
  onClose,
  onSave,
}: {
  currency: string
  onClose: () => void
  onSave: (name: string, target: number, alreadySaved: number) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const trimmed = name.trim()
    const targetAmount = parseNumber(target)
    const already = saved.trim() ? parseNumber(saved) : 0
    if (!trimmed) {
      setError('Name what you’re saving for.')
      return
    }
    if (targetAmount == null || targetAmount <= 0) {
      setError('Enter a target above zero.')
      return
    }
    if (already == null || already < 0) {
      setError('Saved so far needs to be zero or more.')
      return
    }
    void onSave(trimmed, targetAmount, already)
  }

  return (
    <Sheet title="New goal" onClose={onClose}>
      <label className="mb-3 block text-sm">
        <span className="mb-1.5 block text-muted">Saving for</span>
        <input className={fieldClass} value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} placeholder="New phone" />
      </label>
      <label className="mb-3 block text-sm">
        <span className="mb-1.5 block text-muted">Target ({currency})</span>
        <input className={fieldClass} inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0.00" />
      </label>
      <label className="mb-3 block text-sm">
        <span className="mb-1.5 block text-muted">Already saved, if any</span>
        <input className={fieldClass} inputMode="decimal" value={saved} onChange={(event) => setSaved(event.target.value)} placeholder="0.00" />
      </label>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <Button onClick={submit}>Save goal</Button>
    </Sheet>
  )
}

function GoalDetail({
  goal,
  deposits,
  currency,
  zone,
  weekTakeHome,
  onClose,
  onSave,
  onAdd,
  onRemoveDeposit,
  onAskDelete,
}: {
  goal: Goal
  deposits: GoalDeposit[]
  currency: string
  zone: string
  weekTakeHome: number
  onClose: () => void
  onSave: (name: string, target: number) => void
  onAdd: (amount: number) => void
  onRemoveDeposit: (id: string) => void
  onAskDelete: () => void
}) {
  const totals = totalsForGoal(goal, deposits)
  const [name, setName] = useState(goal.name)
  const [target, setTarget] = useState(String(goal.targetAmount))
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pace = paceLine(totals.remaining, weekTakeHome)
  const ordered = [...deposits].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

  const saveDetails = () => {
    const trimmed = name.trim()
    const targetAmount = parseNumber(target)
    if (!trimmed || targetAmount == null || targetAmount <= 0) {
      setError('Keep a name and a target above zero.')
      return
    }
    setError(null)
    onSave(trimmed, targetAmount)
  }

  const add = (next: string) => {
    const parsed = parseNumber(next)
    if (parsed == null || parsed <= 0) {
      setError('Enter an amount above zero.')
      return
    }
    setError(null)
    setAmount('')
    onAdd(parsed)
  }

  return (
    <Sheet title={goal.name} onClose={onClose}>
      <p className="text-[32px] leading-none font-semibold tracking-tight text-gain tabular-nums">{formatMoney(totals.saved, currency)}</p>
      <p className="mt-2 text-sm text-muted tabular-nums">
        of {formatMoney(goal.targetAmount, currency)}
        {totals.reached ? ' · saved' : ` · ${formatMoney(totals.remaining, currency)} to go`}
      </p>
      <div className="mt-4 mb-2">
        <ProgressBar value={totals.progress} label={`${goal.name} saved`} />
      </div>
      {pace && <p className="mb-4 text-sm text-muted">{pace}</p>}

      <label className="mb-3 block text-sm">
        <span className="mb-1.5 block text-muted">Add money</span>
        <input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
      </label>
      <div className="mb-4 grid grid-cols-1 gap-2">
        <Button onClick={() => add(amount)}>Add to {goal.name}</Button>
        {weekTakeHome > 0.5 && (
          <Button variant="secondary" onClick={() => add(String(Math.round(weekTakeHome * 100) / 100))}>
            Add this week’s take-home, {formatMoney(weekTakeHome, currency)}
          </Button>
        )}
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {ordered.length > 0 && (
        <ul className="mb-5 divide-y divide-stroke border-y border-stroke">
          {ordered.map((deposit) => (
            <li key={deposit.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium tabular-nums">{formatMoney(deposit.amount, currency)}</p>
                <p className="text-xs text-muted">{formatDay(instantInZone(deposit.createdAt, zone))}</p>
              </div>
              <button type="button" className="text-sm font-medium text-danger" onClick={() => onRemoveDeposit(deposit.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mb-3 block text-sm">
        <span className="mb-1.5 block text-muted">Name</span>
        <input className={fieldClass} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="mb-3 block text-sm">
        <span className="mb-1.5 block text-muted">Target ({currency})</span>
        <input className={fieldClass} inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
      </label>
      <Button variant="secondary" onClick={saveDetails}>
        Save changes
      </Button>
      <button type="button" className="mt-4 block w-full py-2 text-sm font-medium text-danger" onClick={onAskDelete}>
        Delete goal
      </button>
    </Sheet>
  )
}
