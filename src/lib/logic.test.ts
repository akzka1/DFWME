import { describe, expect, it } from 'vitest';
import { avgPace, hitMinimumPlan, isLightEating, mile1Fast, noRecentEasyRun, waistPace, weekSummary, weightWeek } from './calc';
import { fmtPace, weekStart } from './dates';
import { PROGRAM, nextWorkout, suggest } from './program';
import { seedData } from './seed';
import type { AppData, LiftSession } from './types';

const seed = seedData();
const data: AppData = { ...seed, settings: { minimumPlan: false } };

describe('waist', () => {
  it('pace over the last 4 official readings', () => {
    const p = waistPace(seed.waist)!;
    expect(p.n).toBe(4);
    expect(p.perWeek).toBeCloseTo(-0.315, 3);
  });
});

describe('weight', () => {
  it('weekly average and change vs closest earlier week', () => {
    const w = weightWeek(seed.weight, weekStart('2026-11-18'));
    expect(w.cur!.avg).toBe(206);
    expect(w.delta).toBeCloseTo(0.5);
    expect(w.gapWeeks).toBe(1);
    const earlier = weightWeek(seed.weight, weekStart('2026-11-13'));
    expect(earlier.delta).toBeCloseTo(-3.5);
    expect(earlier.gapWeeks).toBe(4);
  });
});

describe('runs', () => {
  it('derives pace from total time', () => {
    expect(seed.runs.map((r) => fmtPace(avgPace(r)))).toEqual(['8:16', '8:12', '8:18', '8:11']);
  });
  it('flags mile 1 > 15s faster than average', () => {
    expect(seed.runs.map((r) => mile1Fast(r) !== null)).toEqual([true, true, true, false]);
  });
  it('easy-run note', () => {
    expect(noRecentEasyRun(seed.runs, '2026-11-21')).toBe(true);
    const easy = { ...seed.runs[0], id: 'e', date: '2026-11-20', distance: 5, timeSec: 5 * 600 };
    expect(noRecentEasyRun([...seed.runs, easy], '2026-11-21')).toBe(false);
    expect(noRecentEasyRun([...seed.runs, easy], '2026-11-28')).toBe(true);
  });
});

describe('lifting', () => {
  const sess = (date: string, workout: 'A' | 'B', ex: LiftSession['exercises']): LiftSession => ({ id: date, date, workout, exercises: ex });
  const sets = (w: number, reps: number[]) => reps.map((r) => ({ weight: w, reps: r }));
  const dl = PROGRAM.B.find((d) => d.key === 'deadlift')!;
  const bench = PROGRAM.A.find((d) => d.key === 'bench')!;
  const row = PROGRAM.A.find((d) => d.key === 'cable_row')!;

  it('rotation alternates A/B', () => {
    expect(nextWorkout([])).toBe('A');
    expect(nextWorkout([sess('2026-11-16', 'A', [])])).toBe('B');
    expect(nextWorkout([sess('2026-11-16', 'A', []), sess('2026-11-20', 'B', [])])).toBe('A');
  });
  it('deadlift +10 until slowed, then +5', () => {
    expect(suggest(dl, []).weight).toBe(205);
    const s1 = sess('2026-11-01', 'B', [{ key: 'deadlift', name: 'Deadlift', sets: sets(205, [5, 5, 5]) }]);
    expect(suggest(dl, [s1]).weight).toBe(215);
    const s2 = sess('2026-11-05', 'B', [{ key: 'deadlift', name: 'Deadlift', sets: sets(215, [5, 5, 5]), slowed: true }]);
    expect(suggest(dl, [s1, s2]).weight).toBe(220);
    const s3 = sess('2026-11-09', 'B', [{ key: 'deadlift', name: 'Deadlift', sets: sets(220, [5, 5, 5]) }]);
    expect(suggest(dl, [s1, s2, s3]).weight).toBe(225);
    const s4 = sess('2026-11-12', 'B', [{ key: 'deadlift', name: 'Deadlift', sets: sets(225, [5, 4, 3]) }]);
    expect(suggest(dl, [s1, s2, s3, s4]).weight).toBe(225);
  });
  it('main lifts +5 only when all reps clean', () => {
    const ok = sess('2026-11-01', 'A', [{ key: 'bench', name: 'Bench Press', sets: sets(135, [5, 5, 5]) }]);
    expect(suggest(bench, [ok]).weight).toBe(140);
    const grind = sess('2026-11-01', 'A', [{ key: 'bench', name: 'Bench Press', sets: sets(135, [5, 5, 5]), slowed: true }]);
    expect(suggest(bench, [grind]).weight).toBe(135);
    const miss = sess('2026-11-01', 'A', [{ key: 'bench', name: 'Bench Press', sets: sets(135, [5, 5, 4]) }]);
    expect(suggest(bench, [miss]).weight).toBe(135);
  });
  it('accessories progress at the top of the range', () => {
    const mid = sess('2026-11-01', 'A', [{ key: 'cable_row', name: 'Seated Cable Row', sets: sets(80, [12, 11, 10]) }]);
    expect(suggest(row, [mid]).weight).toBe(80);
    const top = sess('2026-11-01', 'A', [{ key: 'cable_row', name: 'Seated Cable Row', sets: sets(80, [12, 12, 12]) }]);
    expect(suggest(row, [top]).weight).toBe(85);
  });
});

describe('habits + summary', () => {
  it('light eating and minimum plan', () => {
    const base = { date: '2026-11-17', breakfast: false, lunch: true, carbs: false, preSnack: false, shake: true, treat: false };
    expect(isLightEating(base)).toBe(true);
    expect(isLightEating({ ...base, carbs: true })).toBe(false);
    expect(hitMinimumPlan(base)).toBe(true);
    expect(hitMinimumPlan({ ...base, shake: false })).toBe(false);
  });
  it('week summary for Nov 16–22', () => {
    const habits = [{ date: '2026-11-17', breakfast: false, lunch: true, carbs: false, preSnack: false, shake: true, treat: false }];
    const s = weekSummary({ ...data, habits }, '2026-11-16');
    expect(s.waist!.value).toBe(37);
    expect(s.weight.cur!.avg).toBe(206);
    expect(s.runs.length).toBe(1);
    expect(s.hardRuns).toBe(1);
    expect(s.minPlanDays).toBe(1);
    expect(s.lightTrainingDays).toEqual(['2026-11-17']);
  });
});
