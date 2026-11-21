# DFWME — local-first fitness log

A phone-first PWA for logging waist, weight, lifts, runs and daily habits, built around **weekly trends**.
All data lives in IndexedDB on the device. No accounts, no server.

## Screens
- **Week** — official waist, weekly average weight, lift sessions vs. target, runs (easy/hard), minimum-plan days, and the last 6 weeks in a table. Includes the Minimum Plan mode toggle.
- **Waist** — Thursday check-in: two tape readings are averaged and saved. Each Mon–Sun week gets one official reading; others are saved as unofficial and left off the chart. Shows a trend line, the pace over the last 3 weeks (4 readings) and milestones (37/36/35).
- **Weight** — morning weigh-ins. The headline is the weekly average and the change from the previous week with data; single readings are shown small. The chart marks the creatine change (~Oct 6).
- **Lift** — alternates Workout A and B. Prefills suggested weights: deadlift +10 per session until you tick "reps slowed", then +5. Other main lifts +5 after a clean 3×5. Accessories go up once every set reaches the top of the rep range.
- **Run** — distance, time, HR, elevation, temperature, splits and carb snack. Calculates pace. Flags mile 1 when it's more than 15 s faster than the average pace. Shows a note when no run in the past 7 days averaged 9:30/mi or slower.
- **Habits** — per-day checkboxes, steps, a meal note and a planned-treat tag. The week strip outlines training days with light eating (fewer than 2 of breakfast / real lunch / carbs with meals).
- **Settings (gear)** — JSON export/import and Minimum Plan mode.

Weeks run Monday–Sunday.

## Develop
```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (calculations, progression, storage, backup)
npm run build && npx vite preview --port 4173 &
npm run e2e          # drives every screen in a phone-sized headless Chromium
```

## Deploy
`.github/workflows/deploy.yml` builds and publishes to GitHub Pages. Enable it once under
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
