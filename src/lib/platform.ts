export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function isIos(): boolean {
  const nav = navigator as Navigator & { platform?: string; maxTouchPoints?: number }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
}
