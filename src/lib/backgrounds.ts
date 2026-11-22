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

export interface WallpaperOrb {
  dark: string
  light: string
  x: string
  y: string
  size: string
  drift: string
  delay: string
  dx: string
  dy: string
}

export interface BackgroundPreset {
  id: BackgroundId
  name: string
  /** Solid colour behind the lights, also used outside the phone column. */
  dark: string
  light: string
  orbs: readonly WallpaperOrb[]
}

function orb(
  dark: string,
  light: string,
  x: string,
  y: string,
  size: string,
  drift: string,
  delay: string,
  dx: string,
  dy: string,
): WallpaperOrb {
  return { dark, light, x, y, size, drift, delay, dx, dy }
}

export const BACKGROUNDS: readonly BackgroundPreset[] = [
  { id: 'plain', name: 'Plain', dark: '#000000', light: '#f2f2f7', orbs: [] },
  {
    id: 'midnight',
    name: 'Midnight',
    dark: 'linear-gradient(165deg, #1d4ed8 0%, #312e81 46%, #082f49 100%)',
    light: 'linear-gradient(165deg, #bfdbfe 0%, #c7d2fe 48%, #e0f2fe 100%)',
    orbs: [
      orb('rgba(96, 165, 250, 0.95)', 'rgba(37, 99, 235, 0.55)', '78%', '8%', '115%', '26s', '0s', '28px', '36px'),
      orb('rgba(129, 140, 248, 0.9)', 'rgba(99, 102, 241, 0.45)', '12%', '72%', '108%', '32s', '-6s', '-34px', '-22px'),
      orb('rgba(224, 242, 254, 0.7)', 'rgba(14, 165, 233, 0.4)', '40%', '28%', '62%', '18s', '-2s', '18px', '24px'),
      orb('rgba(56, 189, 248, 0.55)', 'rgba(125, 211, 252, 0.7)', '88%', '92%', '90%', '28s', '-10s', '-16px', '-30px'),
    ],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    dark: 'linear-gradient(155deg, #059669 0%, #4c1d95 48%, #0e7490 100%)',
    light: 'linear-gradient(155deg, #bbf7d0 0%, #ddd6fe 50%, #a5f3fc 100%)',
    orbs: [
      orb('rgba(74, 222, 128, 0.95)', 'rgba(22, 163, 74, 0.4)', '16%', '12%', '120%', '24s', '0s', '30px', '28px'),
      orb('rgba(167, 139, 250, 0.9)', 'rgba(109, 40, 217, 0.4)', '90%', '22%', '110%', '30s', '-8s', '-26px', '20px'),
      orb('rgba(45, 212, 191, 0.85)', 'rgba(13, 148, 136, 0.35)', '42%', '88%', '120%', '34s', '-4s', '16px', '-36px'),
      orb('rgba(186, 230, 253, 0.55)', 'rgba(14, 165, 233, 0.35)', '70%', '46%', '58%', '16s', '-12s', '-20px', '14px'),
    ],
  },
  {
    id: 'ember',
    name: 'Ember',
    dark: 'linear-gradient(160deg, #ea580c 0%, #9f1239 48%, #7c2d12 100%)',
    light: 'linear-gradient(160deg, #fed7aa 0%, #fecdd3 48%, #fde68a 100%)',
    orbs: [
      orb('rgba(251, 146, 60, 0.95)', 'rgba(234, 88, 12, 0.45)', '88%', '6%', '120%', '22s', '0s', '-32px', '26px'),
      orb('rgba(248, 113, 113, 0.85)', 'rgba(225, 29, 72, 0.35)', '8%', '80%', '115%', '30s', '-7s', '24px', '-28px'),
      orb('rgba(253, 224, 71, 0.7)', 'rgba(202, 138, 4, 0.4)', '48%', '30%', '70%', '15s', '-3s', '14px', '22px'),
      orb('rgba(254, 215, 170, 0.45)', 'rgba(255, 237, 213, 0.8)', '70%', '92%', '80%', '26s', '-11s', '-18px', '16px'),
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    dark: 'linear-gradient(165deg, #0e7490 0%, #0f766e 46%, #1e3a8a 100%)',
    light: 'linear-gradient(165deg, #a5f3fc 0%, #99f6e4 50%, #bfdbfe 100%)',
    orbs: [
      orb('rgba(103, 232, 249, 0.95)', 'rgba(8, 145, 178, 0.4)', '10%', '12%', '120%', '28s', '0s', '34px', '18px'),
      orb('rgba(45, 212, 191, 0.9)', 'rgba(13, 148, 136, 0.4)', '92%', '86%', '120%', '33s', '-9s', '-28px', '-24px'),
      orb('rgba(96, 165, 250, 0.7)', 'rgba(37, 99, 235, 0.35)', '72%', '24%', '80%', '20s', '-2s', '-16px', '26px'),
      orb('rgba(224, 242, 254, 0.55)', 'rgba(255, 255, 255, 0.7)', '30%', '58%', '55%', '17s', '-14s', '20px', '-18px'),
    ],
  },
  {
    id: 'dusk',
    name: 'Dusk',
    dark: 'linear-gradient(160deg, #6d28d9 0%, #be185d 46%, #312e81 100%)',
    light: 'linear-gradient(160deg, #ddd6fe 0%, #fbcfe8 48%, #e9d5ff 100%)',
    orbs: [
      orb('rgba(196, 181, 253, 0.95)', 'rgba(109, 40, 217, 0.4)', '82%', '6%', '120%', '25s', '0s', '-24px', '30px'),
      orb('rgba(244, 114, 182, 0.9)', 'rgba(219, 39, 119, 0.4)', '8%', '78%', '120%', '31s', '-6s', '30px', '-26px'),
      orb('rgba(251, 207, 232, 0.65)', 'rgba(244, 114, 182, 0.45)', '46%', '32%', '70%', '18s', '-3s', '16px', '18px'),
      orb('rgba(129, 140, 248, 0.75)', 'rgba(167, 139, 250, 0.55)', '74%', '90%', '90%', '27s', '-12s', '-14px', '-20px'),
    ],
  },
  {
    id: 'forest',
    name: 'Forest',
    dark: 'linear-gradient(160deg, #15803d 0%, #14532d 42%, #3f6212 100%)',
    light: 'linear-gradient(160deg, #bbf7d0 0%, #d9f99d 50%, #a7f3d0 100%)',
    orbs: [
      orb('rgba(74, 222, 128, 0.95)', 'rgba(21, 128, 61, 0.4)', '40%', '8%', '120%', '27s', '0s', '20px', '32px'),
      orb('rgba(190, 242, 100, 0.7)', 'rgba(101, 163, 13, 0.4)', '88%', '28%', '80%', '16s', '-4s', '-22px', '16px'),
      orb('rgba(16, 185, 129, 0.85)', 'rgba(5, 150, 105, 0.35)', '16%', '86%', '115%', '32s', '-8s', '-26px', '-24px'),
      orb('rgba(253, 224, 71, 0.4)', 'rgba(202, 138, 4, 0.28)', '68%', '70%', '50%', '19s', '-13s', '18px', '-14px'),
    ],
  },
  {
    id: 'graphite',
    name: 'Graphite',
    dark: 'linear-gradient(165deg, #475569 0%, #0f172a 52%, #1e293b 100%)',
    light: 'linear-gradient(165deg, #f8fafc 0%, #cbd5e1 52%, #e2e8f0 100%)',
    orbs: [
      orb('rgba(241, 245, 249, 0.7)', 'rgba(255, 255, 255, 0.95)', '12%', '8%', '110%', '29s', '0s', '26px', '22px'),
      orb('rgba(100, 116, 139, 0.95)', 'rgba(71, 85, 105, 0.4)', '90%', '80%', '115%', '34s', '-7s', '-30px', '-18px'),
      orb('rgba(186, 230, 253, 0.45)', 'rgba(56, 189, 248, 0.35)', '64%', '18%', '60%', '18s', '-2s', '-12px', '20px'),
      orb('rgba(15, 23, 42, 0.8)', 'rgba(203, 213, 225, 0.85)', '24%', '96%', '90%', '24s', '-11s', '16px', '-28px'),
    ],
  },
  {
    id: 'rose',
    name: 'Rose',
    dark: 'linear-gradient(160deg, #e11d48 0%, #9d174d 46%, #4c0519 100%)',
    light: 'linear-gradient(160deg, #fecdd3 0%, #fbcfe8 48%, #ffe4e6 100%)',
    orbs: [
      orb('rgba(251, 113, 133, 0.95)', 'rgba(225, 29, 72, 0.4)', '86%', '8%', '120%', '23s', '0s', '-28px', '24px'),
      orb('rgba(255, 228, 230, 0.6)', 'rgba(255, 255, 255, 0.75)', '22%', '32%', '70%', '17s', '-5s', '18px', '16px'),
      orb('rgba(190, 18, 60, 0.9)', 'rgba(244, 63, 94, 0.35)', '8%', '90%', '115%', '30s', '-9s', '26px', '-30px'),
      orb('rgba(244, 114, 182, 0.7)', 'rgba(219, 39, 119, 0.3)', '70%', '64%', '60%', '14s', '-12s', '-12px', '12px'),
    ],
  },
  {
    id: 'sand',
    name: 'Sand',
    dark: 'linear-gradient(160deg, #d97706 0%, #9a3412 48%, #44403c 100%)',
    light: 'linear-gradient(160deg, #fde68a 0%, #fed7aa 50%, #f5f5f4 100%)',
    orbs: [
      orb('rgba(252, 211, 77, 0.95)', 'rgba(217, 119, 6, 0.4)', '14%', '8%', '120%', '26s', '0s', '30px', '22px'),
      orb('rgba(251, 146, 60, 0.75)', 'rgba(234, 88, 12, 0.35)', '84%', '24%', '85%', '18s', '-4s', '-20px', '18px'),
      orb('rgba(120, 53, 15, 0.85)', 'rgba(254, 215, 170, 0.8)', '90%', '92%', '110%', '32s', '-8s', '-24px', '-26px'),
      orb('rgba(255, 251, 235, 0.45)', 'rgba(255, 255, 255, 0.7)', '42%', '48%', '55%', '15s', '-13s', '12px', '-16px'),
    ],
  },
]

const byId = new Map(BACKGROUNDS.map((preset) => [preset.id, preset]))

export function backgroundById(id: string | null | undefined): BackgroundPreset {
  return byId.get(id as BackgroundId) ?? BACKGROUNDS[0]
}
