import type { BackgroundPreset } from '../lib/backgrounds.ts'
import type { ThemeMode } from '../types.ts'

export function Wallpaper({
  preset,
  theme,
  preview = false,
}: {
  preset: BackgroundPreset
  theme: ThemeMode
  preview?: boolean
}) {
  if (preset.orbs.length === 0) {
    return <div className="absolute inset-0" style={{ background: theme === 'light' ? preset.light : preset.dark }} />
  }

  const base = theme === 'light' ? preset.light : preset.dark
  return (
    <div className={`wallpaper pointer-events-none absolute inset-0 overflow-hidden ${preview ? 'wallpaper-preview' : ''}`} aria-hidden="true">
      <div className="absolute inset-0" style={{ background: base }} />
      {preset.orbs.map((item, index) => (
        <span
          key={index}
          className="wallpaper-orb"
          style={{
            background: `radial-gradient(circle, ${theme === 'light' ? item.light : item.dark} 0%, transparent 74%)`,
            width: item.size,
            height: item.size,
            left: item.x,
            top: item.y,
            ['--drift' as string]: item.drift,
            ['--delay' as string]: item.delay,
            ['--dx' as string]: item.dx,
            ['--dy' as string]: item.dy,
          }}
        />
      ))}
      {!preview && (
        <svg className="wallpaper-grain absolute inset-0 h-full w-full" aria-hidden="true">
          <filter id="worktrack-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#worktrack-grain)" />
        </svg>
      )}
      <div className={`wallpaper-vignette absolute inset-0 ${theme === 'light' ? 'wallpaper-vignette-light' : ''}`} />
    </div>
  )
}
