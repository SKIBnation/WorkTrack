export const BACKGROUND_IDS = [
  'plain',
  'midnight',
  'aurora',
  'ember',
  'ocean',
  'dusk',
  'forest',
  'graphite',
  'rose',
  'sand',
] as const

export type BackgroundId = (typeof BACKGROUND_IDS)[number]

export interface BackgroundPreset {
  id: BackgroundId
  name: string
  dark: string
  light: string
}

export const BACKGROUNDS: readonly BackgroundPreset[] = [
  {
    id: 'plain',
    name: 'Plain',
    dark: '#000000',
    light: '#f2f2f7',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    dark: 'radial-gradient(120% 70% at 100% -10%, #2458a6 0%, transparent 52%), radial-gradient(90% 60% at -10% 110%, #12315f 0%, transparent 50%), #070b14',
    light: 'radial-gradient(120% 70% at 100% -10%, #b9d4f5 0%, transparent 54%), radial-gradient(90% 60% at -10% 110%, #d5e4f6 0%, transparent 52%), #eef3f8',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    dark: 'radial-gradient(80% 50% at 15% -10%, rgba(48, 209, 88, 0.55) 0%, transparent 58%), radial-gradient(70% 55% at 110% 15%, rgba(94, 92, 230, 0.5) 0%, transparent 52%), radial-gradient(80% 45% at 40% 120%, rgba(10, 132, 255, 0.28) 0%, transparent 50%), #050806',
    light: 'radial-gradient(80% 50% at 15% -10%, rgba(48, 209, 88, 0.35) 0%, transparent 58%), radial-gradient(70% 55% at 110% 15%, rgba(125, 122, 255, 0.28) 0%, transparent 52%), radial-gradient(80% 45% at 40% 120%, rgba(10, 132, 255, 0.16) 0%, transparent 50%), #f3f7f4',
  },
  {
    id: 'ember',
    name: 'Ember',
    dark: 'radial-gradient(100% 60% at 110% -10%, #c45a1a 0%, transparent 50%), radial-gradient(70% 50% at -10% 110%, #6b2a12 0%, transparent 48%), #140c09',
    light: 'radial-gradient(100% 60% at 110% -10%, #f3c4a2 0%, transparent 52%), radial-gradient(70% 50% at -10% 110%, #f6ddc8 0%, transparent 50%), #f8f1ea',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    dark: 'radial-gradient(100% 65% at -10% -10%, #0e7490 0%, transparent 52%), radial-gradient(80% 55% at 110% 110%, #115e59 0%, transparent 50%), #041316',
    light: 'radial-gradient(100% 65% at -10% -10%, #b7e4ea 0%, transparent 54%), radial-gradient(80% 55% at 110% 110%, #c9ebe4 0%, transparent 52%), #eef7f7',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    dark: 'radial-gradient(90% 60% at 90% -10%, #7c3aed 0%, transparent 50%), radial-gradient(80% 55% at -10% 110%, #9d174d 0%, transparent 52%), #120818',
    light: 'radial-gradient(90% 60% at 90% -10%, #ddd0fb 0%, transparent 52%), radial-gradient(80% 55% at -10% 110%, #f6d0e0 0%, transparent 54%), #f6f1f8',
  },
  {
    id: 'forest',
    name: 'Forest',
    dark: 'radial-gradient(100% 60% at 50% -15%, #15803d 0%, transparent 52%), radial-gradient(70% 50% at 110% 110%, #14532d 0%, transparent 48%), #07110b',
    light: 'radial-gradient(100% 60% at 50% -15%, #c6e6cf 0%, transparent 54%), radial-gradient(70% 50% at 110% 110%, #d7eadc 0%, transparent 50%), #f1f6f2',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    dark: 'radial-gradient(90% 55% at 0% 0%, #52525b 0%, transparent 48%), radial-gradient(70% 50% at 100% 100%, #3f3f46 0%, transparent 46%), #0c0c0e',
    light: 'radial-gradient(90% 55% at 0% 0%, #ffffff 0%, transparent 48%), radial-gradient(70% 50% at 100% 100%, #d8d8de 0%, transparent 46%), #e8e8ed',
  },
  {
    id: 'rose',
    name: 'Rose',
    dark: 'radial-gradient(90% 60% at 110% 0%, #be123c 0%, transparent 50%), radial-gradient(70% 50% at -10% 110%, #4c0519 0%, transparent 48%), #14060b',
    light: 'radial-gradient(90% 60% at 110% 0%, #f6c2d0 0%, transparent 52%), radial-gradient(70% 50% at -10% 110%, #f8dce4 0%, transparent 50%), #fbf3f5',
  },
  {
    id: 'sand',
    name: 'Sand',
    dark: 'radial-gradient(90% 55% at 0% -10%, #a16207 0%, transparent 48%), radial-gradient(80% 50% at 110% 110%, #57534e 0%, transparent 48%), #1c1410',
    light: 'radial-gradient(90% 55% at 0% -10%, #f3ddb0 0%, transparent 50%), radial-gradient(80% 50% at 110% 110%, #e7d7c3 0%, transparent 50%), #f7f3ec',
  },
]

const byId = new Map(BACKGROUNDS.map((preset) => [preset.id, preset]))

export function backgroundById(id: string | null | undefined): BackgroundPreset {
  return byId.get(id as BackgroundId) ?? BACKGROUNDS[0]
}
