import { isStandalone } from './platform.ts'

/** Pick a height that reaches the bottom of a home-screen app when iOS reports a short viewport. */
export function chooseAppHeight(input: {
  innerHeight: number
  visualHeight: number
  screenHeight: number
  standalone: boolean
}): number {
  const inner = positive(input.innerHeight)
  const visual = positive(input.visualHeight) || inner
  const screen = positive(input.screenHeight)
  if (inner - visual > 120) return visual
  if (input.standalone && screen > inner && screen - inner < 160) return screen
  return Math.max(inner, visual)
}

export function installViewportHeight(): void {
  const apply = () => {
    const root = document.documentElement
    const standalone = isStandalone()
    if (standalone) root.dataset.standalone = 'true'
    else delete root.dataset.standalone
    const height = chooseAppHeight({
      innerHeight: window.innerHeight,
      visualHeight: window.visualViewport?.height ?? window.innerHeight,
      screenHeight: window.screen.height,
      standalone,
    })
    if (height > 0) root.style.setProperty('--app-height', `${height}px`)
  }

  apply()
  const timers = [100, 400, 1000].map((delay) => window.setTimeout(apply, delay))
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  window.addEventListener('pageshow', apply)
  document.addEventListener('visibilitychange', apply)
  window.visualViewport?.addEventListener('resize', apply)
  window.visualViewport?.addEventListener('scroll', apply)

  const stop = () => {
    for (const timer of timers) window.clearTimeout(timer)
  }
  window.addEventListener('pagehide', stop, { once: true })
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}
