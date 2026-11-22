import { CalendarDays, ChartColumn, House, PiggyBank, Settings, Timer } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { WorkContext, useLiveWorkData, useWorkData } from '../hooks/useWorkData.ts'
import { useReminders } from '../hooks/useReminders.ts'
import { ForgottenClockOut } from './ForgottenClockOut.tsx'
import { Wallpaper } from './Wallpaper.tsx'
import { backgroundById } from '../lib/backgrounds.ts'

const tabs = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/track', label: 'Track', icon: Timer, end: false },
  { to: '/history', label: 'History', icon: CalendarDays, end: false },
  { to: '/goals', label: 'Goals', icon: PiggyBank, end: false },
  { to: '/stats', label: 'Stats', icon: ChartColumn, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

const titles: Record<string, string> = {
  '/': 'Home',
  '/track': 'Track',
  '/history': 'History',
  '/goals': 'Goals',
  '/stats': 'Statistics',
  '/settings': 'Settings',
}

export function AppShell() {
  const data = useLiveWorkData()
  return (
    <WorkContext.Provider value={data}>
      <ShellFrame />
    </WorkContext.Provider>
  )
}

function ShellFrame() {
  const location = useLocation()
  const { settings, shifts, summary, now } = useWorkData()
  const reminders = useReminders(settings, summary)

  useEffect(() => {
    document.title = `${titles[location.pathname] ?? 'WorkTrack'} · WorkTrack`
  }, [location.pathname])

  useEffect(() => {
    if (!settings) return
    const preset = backgroundById(settings.background)
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.background = preset.id
    root.style.setProperty('--wallpaper', settings.theme === 'light' ? preset.light : preset.dark)
    try {
      localStorage.setItem('worktrack-theme', settings.theme)
    } catch {
      /* The theme is still stored in IndexedDB. */
    }
  }, [settings])

  const preset = backgroundById(settings?.background)
  const theme = settings?.theme ?? 'dark'
  const activeShift = shifts.find((shift) => shift.id === summary?.activeShiftId) ?? null

  return (
    <div className="relative mx-auto flex h-dvh max-w-[480px] flex-col overflow-hidden bg-[var(--wallpaper)] text-fg">
      {preset.id !== 'plain' && <Wallpaper preset={preset} theme={theme} />}
      <div className="relative z-10 shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pt-4 pb-8">
          <Outlet />
        </div>
      </main>
      <nav
        aria-label="Primary"
        className="relative z-10 shrink-0 border-t border-stroke bg-nav backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-6">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] leading-none font-medium tracking-tight ${isActive ? 'text-gain' : 'text-muted'}`
              }
            >
              <tab.icon size={22} strokeWidth={2} aria-hidden="true" />
              <span className="max-w-full truncate">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      {settings && activeShift && <ForgottenClockOut shift={activeShift} shifts={shifts} settings={settings} now={now} />}
      {reminders.toast && (
        <div className="pointer-events-none absolute inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30">
          <div className="pointer-events-auto rounded-2xl border border-stroke bg-raised px-4 py-3 shadow-lg">
            <p className="text-sm font-semibold">{reminders.toast.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{reminders.toast.body}</p>
            <button type="button" className="mt-2 text-sm font-medium text-gain" onClick={reminders.dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
