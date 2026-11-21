import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useMemo } from 'react'
import type { Schedule, Settings, Shift } from '../types.ts'
import { summarize, type WorkSummary } from '../lib/calc.ts'
import { db, SETTINGS_ID } from '../lib/db.ts'
import { normalizeSettings } from '../lib/settings.ts'
import { useNow } from './useNow.ts'

export interface WorkData {
  ready: boolean
  settings: Settings | null
  shifts: Shift[]
  schedules: Schedule[]
  summary: WorkSummary | null
  now: number
}

export const WorkContext = createContext<WorkData | null>(null)

export function useLiveWorkData(): WorkData {
  const settingsRow = useLiveQuery(() => db.settings.get(SETTINGS_ID))
  const shifts = useLiveQuery(() => db.shifts.orderBy('clockIn').toArray())
  const schedules = useLiveQuery(() => db.schedules.toArray())
  const now = useNow()
  const ready = settingsRow !== undefined && shifts !== undefined && schedules !== undefined
  const settings = useMemo(() => (settingsRow ? normalizeSettings(settingsRow) : null), [settingsRow])

  const summary = useMemo(() => {
    if (!settings || !shifts || !schedules) return null
    return summarize({ shifts, settings, schedules, asOfMs: now })
  }, [settings, shifts, schedules, now])

  return {
    ready,
    settings,
    shifts: shifts ?? [],
    schedules: schedules ?? [],
    summary,
    now,
  }
}

export function useWorkData(): WorkData {
  const data = useContext(WorkContext)
  if (!data) throw new Error('WorkTrack data is unavailable.')
  return data
}
