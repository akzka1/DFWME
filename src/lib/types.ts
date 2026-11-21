export type ISODate = string; // 'YYYY-MM-DD', local calendar date

export interface WaistEntry {
  id: string;
  date: ISODate;
  r1: number;
  r2: number;
  value: number; // average of r1, r2
  official: boolean;
}

export interface WeightEntry {
  id: string;
  date: ISODate;
  lb: number;
}

export interface LiftSet {
  weight: number;
  reps: number;
}

export interface ExerciseLog {
  key: string; // stable exercise key, e.g. 'squat'
  name: string; // display name (may be variant, e.g. 'Lat Pulldown')
  sets: LiftSet[];
  slowed?: boolean; // reps slowed / grindy (used for deadlift progression)
  skipped?: boolean;
}

export interface LiftSession {
  id: string;
  date: ISODate;
  workout: 'A' | 'B';
  exercises: ExerciseLog[];
  note?: string;
}

export interface Run {
  id: string;
  date: ISODate;
  distance: number; // miles
  timeSec: number; // total moving time
  hr?: number;
  elevFt?: number;
  tempF?: number;
  splits: number[]; // pace per mile in seconds; last may be a partial mile (still pace)
  kind: 'easy' | 'hard';
  carbSnack?: boolean; // undefined = not recorded
  note?: string;
}

export interface HabitDay {
  date: ISODate;
  breakfast: boolean;
  lunch: boolean; // real lunch
  carbs: boolean; // carbs with meals (training days)
  preSnack: boolean; // pre-workout snack
  shake: boolean;
  steps?: number;
  treat: boolean; // planned treat
  note?: string;
}

export interface Settings {
  minimumPlan: boolean;
}

export interface AppData {
  waist: WaistEntry[];
  weight: WeightEntry[];
  lifts: LiftSession[];
  runs: Run[];
  habits: HabitDay[];
  settings: Settings;
}
