import { addDays, daysBetween, inWeek, weekDays, weekStart } from './dates';
import type { AppData, HabitDay, ISODate, Run, WaistEntry, WeightEntry } from './types';

const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Least-squares fit; x in days. Returns slope (per day) and intercept. */
export function linreg(pts: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

/* ---------------- Waist ---------------- */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function officialWaist(waist: WaistEntry[]): WaistEntry[] {
  return waist.filter((w) => w.official).sort(byDate);
}

export function officialForWeek(waist: WaistEntry[], start: ISODate): WaistEntry | undefined {
  return waist.find((w) => w.official && inWeek(w.date, start));
}

/** Pace in inches/week from official readings within 21 days of the latest one (≈ last 3–4 weekly readings). */
export function waistPace(waist: WaistEntry[]): { perWeek: number; n: number; from: ISODate; to: ISODate } | null {
  const off = officialWaist(waist);
  if (off.length < 2) return null;
  const last = off[off.length - 1];
  const win = off.filter((w) => daysBetween(w.date, last.date) <= 21);
  if (win.length < 2) return null;
  const fit = linreg(win.map((w) => ({ x: daysBetween(win[0].date, w.date), y: w.value })));
  if (!fit) return null;
  return { perWeek: fit.slope * 7, n: win.length, from: win[0].date, to: last.date };
}

export const WAIST_MILESTONES = [37, 36, 35];

/* ---------------- Weight ---------------- */

export interface WeekAvg {
  start: ISODate;
  avg: number;
  n: number;
}

export function weeklyWeight(weight: WeightEntry[]): WeekAvg[] {
  const m = new Map<ISODate, number[]>();
  for (const w of weight) {
    const k = weekStart(w.date);
    m.set(k, [...(m.get(k) ?? []), w.lb]);
  }
  return [...m.entries()]
    .map(([start, v]) => ({ start, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
}

/** Weekly average for the given week and the change from the closest earlier week that has data. */
export function weightWeek(weight: WeightEntry[], start: ISODate) {
  const weeks = weeklyWeight(weight);
  const cur = weeks.find((w) => w.start === start);
  const prev = [...weeks].reverse().find((w) => w.start < start);
  return {
    cur,
    prev,
    delta: cur && prev ? cur.avg - prev.avg : undefined,
    gapWeeks: cur && prev ? daysBetween(prev.start, cur.start) / 7 : undefined,
  };
}

export const CREATINE_DATE: ISODate = '2026-10-06';

/* ---------------- Runs ---------------- */

export const EASY_PACE_SEC = 9 * 60 + 30;
export const MILE1_FLAG_SEC = 15;

export const avgPace = (r: Run) => (r.distance > 0 ? r.timeSec / r.distance : NaN);

/** Mile 1 more than 15 s/mi faster than the run's average pace. Returns seconds faster, or null. */
export function mile1Fast(r: Run): number | null {
  if (r.distance < 1 || !r.splits.length) return null;
  const diff = avgPace(r) - r.splits[0];
  return diff > MILE1_FLAG_SEC ? diff : null;
}

export const isEasyPace = (r: Run) => avgPace(r) >= EASY_PACE_SEC;

/** True when no run at ≥ 9:30/mi in the 7 days ending `asOf`. */
export function noRecentEasyRun(runs: Run[], asOf: ISODate): boolean {
  const from = addDays(asOf, -6);
  return !runs.some((r) => r.date >= from && r.date <= asOf && isEasyPace(r));
}

export function carbComparison(runs: Run[]) {
  const group = (v: boolean) => {
    const g = runs.filter((r) => r.carbSnack === v);
    const hr = g.filter((r) => r.hr);
    return {
      n: g.length,
      pace: g.length ? g.reduce((s, r) => s + avgPace(r), 0) / g.length : NaN,
      hr: hr.length ? hr.reduce((s, r) => s + (r.hr ?? 0), 0) / hr.length : NaN,
      mile1Flags: g.filter((r) => mile1Fast(r) !== null).length,
    };
  };
  return { yes: group(true), no: group(false), unknown: runs.filter((r) => r.carbSnack === undefined).length };
}

/* ---------------- Habits ---------------- */

export function trainingDates(data: Pick<AppData, 'lifts' | 'runs'>): Set<ISODate> {
  return new Set([...data.lifts.map((l) => l.date), ...data.runs.map((r) => r.date)]);
}

/** Fewer than 2 of breakfast / real lunch / carbs with meals on a training day. */
export function isLightEating(h: HabitDay | undefined): boolean {
  if (!h) return false;
  return [h.breakfast, h.lunch, h.carbs].filter(Boolean).length < 2;
}

export const hitMinimumPlan = (h: HabitDay | undefined) => !!h && h.shake && h.lunch;

/* ---------------- Weekly summary ---------------- */

export function weekSummary(data: AppData, start: ISODate) {
  const days = weekDays(start);
  const habitsBy = new Map(data.habits.map((h) => [h.date, h]));
  const training = trainingDates(data);
  const lifts = data.lifts.filter((l) => inWeek(l.date, start)).sort(byDate);
  const runs = data.runs.filter((r) => inWeek(r.date, start)).sort(byDate);
  const habitDays = days.map((d) => habitsBy.get(d)).filter(Boolean) as HabitDay[];
  const steps = habitDays.filter((h) => h.steps).map((h) => h.steps as number);
  return {
    days,
    waist: officialForWeek(data.waist, start),
    weight: weightWeek(data.weight, start),
    lifts,
    runs,
    easyRuns: runs.filter((r) => r.kind === 'easy').length,
    hardRuns: runs.filter((r) => r.kind === 'hard').length,
    daysLogged: habitDays.length,
    minPlanDays: days.filter((d) => hitMinimumPlan(habitsBy.get(d))).length,
    shakeDays: habitDays.filter((h) => h.shake).length,
    lunchDays: habitDays.filter((h) => h.lunch).length,
    trainingDays: days.filter((d) => training.has(d)),
    lightTrainingDays: days.filter((d) => training.has(d) && isLightEating(habitsBy.get(d))),
    avgSteps: steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : undefined,
    treats: habitDays.filter((h) => h.treat).length,
  };
}
