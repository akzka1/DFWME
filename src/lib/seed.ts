import { parseClock, uid } from './dates';
import type { AppData, Run } from './types';

const run = (date: string, distance: number, pace: string, hr: number, elevFt: number | undefined, splits: string[]): Run => ({
  id: uid(),
  date,
  distance,
  timeSec: Math.round(parseClock(pace) * distance),
  hr,
  elevFt,
  splits: splits.map(parseClock),
  kind: 'hard',
  carbSnack: undefined,
});

const waist = (date: string, v: number) => ({ id: uid(), date, r1: v, r2: v, value: v, official: true });

export function seedData(): Omit<AppData, 'settings'> {
  return {
    waist: [waist('2026-10-29', 38.0), waist('2026-11-05', 37.75), waist('2026-11-12', 37.6), waist('2026-11-19', 37.0)],
    weight: [
      { id: uid(), date: '2026-10-17', lb: 209 },
      { id: uid(), date: '2026-11-13', lb: 205.5 },
      { id: uid(), date: '2026-11-18', lb: 206 },
    ],
    lifts: [],
    runs: [
      run('2026-10-20', 5.28, '8:16', 170, undefined, ['7:48', '8:09', '8:36', '8:30', '8:31', '7:13']),
      run('2026-11-10', 5.3, '8:12', 173, 412, ['7:29', '8:07', '8:26', '8:49', '8:24', '7:09']),
      run('2026-11-12', 5.29, '8:18', 170, 447, ['7:38', '8:19', '8:57', '8:34', '8:20', '7:15']),
      run('2026-11-17', 5.24, '8:11', 172, 412, ['8:05', '8:05', '8:26', '8:19', '8:13', '6:51']),
    ],
    habits: [],
  };
}
