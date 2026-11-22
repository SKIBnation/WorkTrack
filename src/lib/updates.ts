export type AppUpdate = {
  at: string
  title: string
  detail: string
}

/** Newest first. Times are the moment each change was published, in UTC. */
export const UPDATES: readonly AppUpdate[] = [
  {
    at: '2026-11-22T09:46:33.000Z',
    title: 'Updates list',
    detail: 'Settings shows what changed, with the date and time of each one.',
  },
  {
    at: '2026-11-22T09:37:59.000Z',
    title: 'Tab bar on the bottom',
    detail: 'The bar reaches the bottom of the screen, so the black strip underneath is gone.',
  },
  {
    at: '2026-11-22T09:26:45.000Z',
    title: 'Pay stays accurate',
    detail: 'Overlapping shifts and hours in the future no longer count. An overnight shift is split across the days it covers. A backup download finishes on iPhone.',
  },
  {
    at: '2026-11-22T01:07:50.000Z',
    title: 'Clock-out card',
    detail: 'After you clock out, the finished shift stays on screen until you tap Done.',
  },
  {
    at: '2026-11-22T00:50:32.000Z',
    title: 'Forgotten clock-out',
    detail: 'If a shift is left running, WorkTrack asks whether you are still working.',
  },
  {
    at: '2026-11-22T00:34:55.000Z',
    title: 'Moving backgrounds',
    detail: 'The colour presets drift slowly behind the app.',
  },
  {
    at: '2026-11-22T00:27:04.000Z',
    title: 'Background presets',
    detail: 'Settings can set a colour behind the app, or leave it plain.',
  },
  {
    at: '2026-11-22T00:19:48.000Z',
    title: 'Opening intro',
    detail: 'A short watch-style intro plays when WorkTrack opens.',
  },
  {
    at: '2026-11-22T00:08:39.000Z',
    title: 'Swipe to close',
    detail: 'Sheets close when you pull them downward.',
  },
  {
    at: '2026-11-21T23:31:10.000Z',
    title: 'Goals',
    detail: 'A Goals tab for saving toward something.',
  },
  {
    at: '2026-11-21T22:17:02.000Z',
    title: 'Tax and National Insurance',
    detail: 'Take-home pay is estimated from your UK tax code.',
  },
  {
    at: '2026-11-21T10:54:52.000Z',
    title: 'WorkTrack',
    detail: 'Hours, earnings, and shifts, kept on this phone.',
  },
]
