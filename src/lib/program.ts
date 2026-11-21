import type { ExerciseLog, LiftSession } from './types';

export type ExKind = 'main' | 'range' | 'bodyweight';

export interface ExerciseDef {
  key: string;
  name: string;
  kind: ExKind;
  sets: number;
  repsMin: number;
  repsMax: number;
  start: number; // starting working weight (0 = bodyweight)
  inc: number; // increment when progression earned
  variants?: string[];
  note?: string;
}

const squat: ExerciseDef = { key: 'squat', name: 'Squat', kind: 'main', sets: 3, repsMin: 5, repsMax: 5, start: 230, inc: 5 };

export const PROGRAM: Record<'A' | 'B', ExerciseDef[]> = {
  A: [
    squat,
    { key: 'cable_row', name: 'Seated Cable Row', kind: 'range', sets: 3, repsMin: 8, repsMax: 12, start: 80, inc: 5 },
    { key: 'curl', name: 'Barbell Curl', kind: 'range', sets: 3, repsMin: 10, repsMax: 10, start: 65, inc: 5 },
    { key: 'bench', name: 'Bench Press', kind: 'main', sets: 3, repsMin: 5, repsMax: 5, start: 135, inc: 5 },
    {
      key: 'vertical_pull', name: 'Pull-ups', kind: 'range', sets: 3, repsMin: 6, repsMax: 10, start: 0, inc: 5,
      variants: ['Pull-ups', 'Lat Pulldown'],
    },
    { key: 'decline_crunch', name: 'Decline Crunch', kind: 'bodyweight', sets: 3, repsMin: 25, repsMax: 25, start: 0, inc: 0 },
  ],
  B: [
    squat,
    { key: 'calf_raise', name: 'Standing Calf Raise', kind: 'range', sets: 3, repsMin: 10, repsMax: 10, start: 230, inc: 10 },
    { key: 'ohp', name: 'Overhead Press', kind: 'main', sets: 3, repsMin: 5, repsMax: 5, start: 95, inc: 5 },
    { key: 'deadlift', name: 'Deadlift', kind: 'main', sets: 3, repsMin: 5, repsMax: 5, start: 205, inc: 10 },
    { key: 'lateral_raise', name: 'Lateral Raise', kind: 'range', sets: 3, repsMin: 10, repsMax: 15, start: 15, inc: 2.5, note: 'Strict' },
    { key: 'knee_raise', name: "Captain's Chair Knee Raise", kind: 'bodyweight', sets: 3, repsMin: 25, repsMax: 25, start: 0, inc: 0 },
  ],
};

export function allDefs(): ExerciseDef[] {
  const seen = new Map<string, ExerciseDef>();
  for (const d of [...PROGRAM.A, ...PROGRAM.B]) seen.set(d.key, d);
  return [...seen.values()];
}

export function repLabel(d: ExerciseDef): string {
  const r = d.repsMin === d.repsMax ? `${d.repsMin}` : `${d.repsMin}–${d.repsMax}`;
  return `${d.sets}×${r}`;
}

const byDateDesc = (a: LiftSession, b: LiftSession) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export function nextWorkout(sessions: LiftSession[]): 'A' | 'B' {
  const last = [...sessions].sort(byDateDesc)[0];
  if (!last) return 'A';
  return last.workout === 'A' ? 'B' : 'A';
}

/** Logs of one exercise, newest first, skipping skipped/empty entries. */
export function history(sessions: LiftSession[], key: string): { date: string; log: ExerciseLog }[] {
  const out: { date: string; log: ExerciseLog }[] = [];
  for (const s of [...sessions].sort(byDateDesc)) {
    const log = s.exercises.find((e) => e.key === key);
    if (log && !log.skipped && log.sets.length) out.push({ date: s.date, log });
  }
  return out;
}

export interface Suggestion {
  weight: number;
  reason: string;
}

const topWeight = (log: ExerciseLog) => Math.max(...log.sets.map((s) => s.weight));

export function suggest(def: ExerciseDef, sessions: LiftSession[], variant?: string): Suggestion {
  let h = history(sessions, def.key);
  if (def.variants && variant) h = h.filter((x) => x.log.name === variant);
  if (def.kind === 'bodyweight') return { weight: 0, reason: `Target ${repLabel(def)}` };
  if (!h.length) {
    if (def.variants && variant && variant !== def.variants[0]) return { weight: 0, reason: 'Enter a starting weight' };
    return { weight: def.start, reason: def.start ? 'Starting weight' : 'Bodyweight' };
  }

  const last = h[0].log;
  const w = topWeight(last);
  const setsDone = last.sets.filter((s) => s.weight >= w);
  const enoughSets = setsDone.length >= def.sets;

  if (def.kind === 'main') {
    const allReps = enoughSets && setsDone.every((s) => s.reps >= def.repsMin);
    if (!allReps) return { weight: w, reason: `Repeat ${w} — not all reps completed last time` };
    if (def.key === 'deadlift') {
      // +10 per session until reps slow down; from then on +5.
      const everSlowed = h.some((x) => x.log.slowed);
      const step = everSlowed ? 5 : 10;
      return { weight: w + step, reason: everSlowed ? '+5 (reps have slowed before)' : '+10 (reps still moving well)' };
    }
    if (last.slowed) return { weight: w, reason: `Repeat ${w} — reps weren't clean last time` };
    return { weight: w + def.inc, reason: `+${def.inc} — all reps clean last time` };
  }

  // range: double progression — add weight once every set hits the top of the range
  if (w === 0) {
    const allTop = enoughSets && setsDone.every((s) => s.reps >= def.repsMax);
    return { weight: 0, reason: allTop ? 'All sets at 10 — consider adding weight' : 'Build toward 3×10' };
  }
  const allTop = enoughSets && setsDone.every((s) => s.reps >= def.repsMax);
  if (allTop) return { weight: w + def.inc, reason: `+${def.inc} — top of range on all sets` };
  return { weight: w, reason: `Stay at ${w} until all sets reach ${def.repsMax}` };
}
