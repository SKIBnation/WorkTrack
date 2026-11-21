# WorkTrack

WorkTrack is a personal work-hours and earnings tracker. It runs in the browser on Windows and installs on an iPhone from Safari, without a Mac, Xcode, or the App Store.

Your shifts stay on the device. The app records clock-in and clock-out times, unpaid breaks, normal hours, overtime, and the pay rate that applied to each shift.

## What you need

- Windows 10 or 11
- [Node.js 20 or newer](https://nodejs.org/), which includes npm
- An iPhone with Safari, when you want the home-screen app

## Run it on your PC

Open PowerShell in this folder:

```powershell
cd C:\Users\alica\Projects\WorkTrack
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge.

## Check the calculations

```powershell
npm test
```

The tests cover breaks, daily and weekly overtime, historical pay rates, shifts that cross midnight, month boundaries, daylight-saving changes, and the monthly schedule estimate.

## Build the production app

```powershell
npm run build
npm run preview
```

`npm run build` type-checks the project and writes the site to `dist`. `npm run preview` serves that folder at http://localhost:4173.


## Install it on an iPhone

1. Open the deployed `https://` address in **Safari**. Chrome on iPhone cannot add a web app to the Home Screen.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **WorkTrack** from the new icon.

From the home screen it opens full screen, without Safari’s address bar. The WorkTrack icon is the green clock on black.

Open it once while you are online. That visit stores the app on the phone. After that, clocking in and out works with no connection. Closing the app or restarting the phone does not delete your shifts.

## Offline and backups

Shifts, the active clock-in, pay settings, breaks, schedules, and targets are stored in IndexedDB on the device. The service worker caches the app itself.

There is no account and no server copy. Use **Settings → Backup**:

- **Export shifts as CSV** opens in Excel. The file includes a byte-order mark so the pound sign survives.
- **Download full backup** saves every shift, schedule, and setting as JSON.
- **Restore a backup** replaces the data on that device. Confirm before restoring.

On an iPhone, export uses the share sheet when Safari allows it, so you can save the file to Files or send it to yourself.

Private browsing can block or wipe this storage. Use a normal Safari tab, then add that page to the Home Screen.

## Notifications

Reminders are off until you turn them on in Settings. The browser asks for permission at that moment.

On an iPhone, system notifications are only available after the app is on the Home Screen, and iOS does not reliably deliver a scheduled web notification once WorkTrack is closed. The practical behaviour is:

- While WorkTrack is open, a reminder can appear as a system notification if you allowed it.
- When you open the app, it checks the clock-in time, clock-out time, weekly summary, weekly hours target, and monthly earnings target, and shows an in-app message if one is due.
- Each reminder is shown once for that day, week, or month.

Chrome on Windows can show notifications while the app is open. A closed browser still cannot run a private reminder on a timer without a push server, and this app does not use one.

## How the numbers are calculated

Times are stored as exact instants. Days, weeks, and months are grouped in the timezone from Settings. The default is **Europe/London**, so a Windows PC set to another zone still counts a London workday correctly.

- Paid time is clock-out minus clock-in, minus unpaid breaks.
- A break with a start and finish is removed from that exact period. Overlapping breaks are counted once.
- A break with only a length is removed from the end of the shift.
- A shift that passes midnight is split at local midnight. The same split applies to weeks, months, and the spring and autumn clock changes. The elapsed time uses real time, not the clock face, so the missing hour in March and the repeated hour in October are not invented or dropped.
- Overtime is either the hours beyond the normal daily limit or the hours beyond the normal weekly limit. Each shift remembers which rule it used.
- Normal pay is normal hours times that shift’s hourly rate. Overtime pay is overtime hours times either the custom overtime rate or the rate times the multiplier. £12 at 1.5× is £18.
- Changing the current hourly rate does not change shifts you already worked. Edit a shift if that one shift was saved with the wrong rate.
- The weekly projection is your earnings so far this month, divided by the day of the month, times the number of days in the month. The yearly figure works the same way. If you have a schedule and have not earned anything yet, the month estimate uses the remaining scheduled shifts instead.
- Amounts stay exact in memory and are rounded only when shown. The currency symbol is a label. WorkTrack does not convert between currencies.

The live timer measures from the saved clock-in time. Closing the app does not reset it, and an unpaid break pauses paid time.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local app |
| `npm test` | Run the calculation tests |
| `npm run build` | Type-check and build `dist` |
| `npm run preview` | Serve the production build |
| `npm run icons` | Regenerate the app icons |
