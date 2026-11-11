import type { Gender } from './calculator';

export interface ExpenditureHour {
  hour: number;
  steps?: number;
  distanceMeters?: number;
  realActiveKcal?: number;
  realBasalKcal?: number;
}

export interface ExpenditureWorkout {
  kcal: number;
  startHour: number;
  endHour: number;
}

export interface ExpenditureInput {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  hoursElapsed: number;
  hourly: ExpenditureHour[];
  workouts: ExpenditureWorkout[];
}

export interface ExpenditureResult {
  bmr: number;
  tef: number;
  neat: number;
  eee: number;
  tdee: number;
}

export const mifflinBMR = (weightKg: number, heightCm: number, age: number, gender: Gender): number => {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
};

export const strideMetersFromHeight = (heightCm: number): number => (0.414 * heightCm) / 100;

export function calculateNEAT(input: {
  weightKg: number;
  distanceMeters?: number;
  steps?: number;
  heightCm?: number;
}): number {
  const { weightKg, distanceMeters, steps, heightCm } = input;
  let km: number;
  if (typeof distanceMeters === 'number' && distanceMeters > 0) km = distanceMeters / 1000;
  else if (steps && steps > 0 && heightCm) km = (steps * strideMetersFromHeight(heightCm)) / 1000;
  else return 0;
  return weightKg * km * 0.95;
}

export const isValidExpenditureInput = (body: Partial<ExpenditureInput> | null): boolean =>
  body != null &&
  [body.age, body.weightKg, body.heightCm].every(n => typeof n === 'number' && !isNaN(n) && n > 0) &&
  !!body.gender;

export function calculateExpenditure(input: ExpenditureInput): ExpenditureResult {
  const { age, gender, weightKg, heightCm, hourly = [], workouts = [] } = input;
  const bmr = mifflinBMR(weightKg, heightCm, age, gender);
  const workoutHours = new Set<number>();
  for (const workout of workouts) {
    const end = workout.endHour >= workout.startHour ? workout.endHour : workout.endHour + 24;
    for (let hour = workout.startHour; hour <= end; hour++) workoutHours.add(hour % 24);
  }
  let neat = 0;
  for (const hour of hourly) {
    if (workoutHours.has(hour.hour)) continue;
    const estimated = calculateNEAT({ weightKg, distanceMeters: hour.distanceMeters, steps: hour.steps, heightCm });
    neat += Math.max(0, estimated - (hour.realActiveKcal ?? 0));
  }
  const eee = workouts.reduce((sum, workout) => sum + Math.max(0, workout.kcal), 0);
  const tef = (bmr + neat + eee) * 0.1;
  return { bmr, tef, neat, eee, tdee: bmr + tef + neat + eee };
}
