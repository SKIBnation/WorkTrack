import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, backgroundById } from '../lib/backgrounds.ts'
import { defaultSettings, normalizeSettings } from '../lib/settings.ts'

describe('backgrounds', () => {
  it('offers ten presets and keeps plain as the default', () => {
    expect(BACKGROUNDS).toHaveLength(10)
    expect(new Set(BACKGROUNDS.map((preset) => preset.id)).size).toBe(10)
    expect(defaultSettings().background).toBe('plain')
  })

  it('keeps a known background and falls back when one is missing', () => {
    expect(normalizeSettings({ background: 'aurora' }).background).toBe('aurora')
    expect(normalizeSettings({}).background).toBe('plain')
    expect(normalizeSettings({ background: 'nope' as 'plain' }).background).toBe('plain')
    expect(backgroundById('ocean').name).toBe('Ocean')
    expect(backgroundById('aurora').orbs.length).toBeGreaterThanOrEqual(4)
    expect(backgroundById('plain').orbs).toHaveLength(0)
  })
})