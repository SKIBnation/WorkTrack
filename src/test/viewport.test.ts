import { describe, expect, it } from 'vitest'
import { chooseAppHeight } from '../lib/viewport.ts'

describe('chooseAppHeight', () => {
  it('fills a home-screen gap when iOS reports the window short of the screen', () => {
    expect(
      chooseAppHeight({ innerHeight: 750, visualHeight: 750, screenHeight: 812, standalone: true }),
    ).toBe(812)
  })

  it('keeps the measured window when the home-screen height is already correct', () => {
    expect(
      chooseAppHeight({ innerHeight: 812, visualHeight: 812, screenHeight: 812, standalone: true }),
    ).toBe(812)
  })

  it('follows the visible area while the keyboard is open', () => {
    expect(
      chooseAppHeight({ innerHeight: 812, visualHeight: 420, screenHeight: 812, standalone: true }),
    ).toBe(420)
  })

  it('does not stretch a normal browser window to the whole screen', () => {
    expect(
      chooseAppHeight({ innerHeight: 700, visualHeight: 700, screenHeight: 812, standalone: false }),
    ).toBe(700)
  })
})
