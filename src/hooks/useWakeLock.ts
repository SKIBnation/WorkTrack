import { useEffect } from 'react'

type ScreenLock = { release: () => Promise<void> }

async function requestWakeLock(): Promise<ScreenLock | null> {
  const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<ScreenLock> } }
  if (!nav.wakeLock) return null
  try {
    return await nav.wakeLock.request('screen')
  } catch {
    return null
  }
}

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let lock: ScreenLock | null = null
    let cancelled = false

    const request = async () => {
      const next = await requestWakeLock()
      if (cancelled) {
        await next?.release()
        return
      }
      lock = next
    }

    void request()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !lock) void request()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [enabled])
}
