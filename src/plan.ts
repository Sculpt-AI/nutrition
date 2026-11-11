import {
  calculate,
  kcalPerDayForWeeklyChange,
  toKg,
  type ActivityLevel,
  type BmrEquation,
  type ExerciseFrequency,
  type ExerciseType,
  type HeightUnit,
  type WeightUnit,
} from './calculator';

export const CALORIE_FLOOR_FEMALE = 1200;
export const CALORIE_FLOOR_MALE = 1500;
export const CALORIE_FLOOR_KCAL_PER_KG = 13;
const PER_KG_FLOOR_MAX_KG = 300;

const STRENGTH_SESSION_MET = 4.5;
const MAX_SESSION_MINUTES = 240;

export type Sex = 'male' | 'female';

export const sexOf = (gender: string | null | undefined): Sex => {
  const normalized = gender?.trim().toLowerCase();
  return normalized === 'female' || normalized === 'f' || normalized === 'woman' ? 'female' : 'male';
};

export function calorieFloorFor(gender: string | null | undefined, weightKg?: number | null): number {
  const base = sexOf(gender) === 'female' ? CALORIE_FLOOR_FEMALE : CALORIE_FLOOR_MALE;
  if (weightKg != null && Number.isFinite(weightKg) && weightKg > 0 && weightKg < PER_KG_FLOOR_MAX_KG) {
    return Math.max(base, Math.round(weightKg * CALORIE_FLOOR_KCAL_PER_KG));
  }
  return base;
}

export interface CalorieFloorResult {
  calories: number;
  floor: number;
  clamped: boolean;
}

export function clampCalorieFloor(
  calories: number,
  gender: string | null | undefined,
  weightKg?: number | null
): CalorieFloorResult {
  const floor = calorieFloorFor(gender, weightKg);
  if (!Number.isFinite(calories) || calories < floor) return { calories: floor, floor, clamped: true };
  return { calories, floor, clamped: false };
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function macrosAtFloor(raw: Macros, floorCalories: number): Omit<Macros, 'calories'> {
  const scale = floorCalories / Math.max(raw.calories, 1);
  const fat = raw.fat * scale;
  const carbs = Math.max(0, (floorCalories - raw.protein * 4 - fat * 9) / 4);
  return { protein: raw.protein, carbs, fat };
}

export function eatBackBase(trained: Macros, sedentaryCalories: number, dailyAddBackKcal: number): Macros {
  const addBack = Number.isFinite(dailyAddBackKcal) ? Math.max(0, dailyAddBackKcal) : 0;
  const calories = Math.min(trained.calories, Math.max(trained.calories - addBack, sedentaryCalories));
  const reduction = trained.calories - calories;
  const carbs = Math.max(0, trained.carbs - reduction / 4);
  const fromFat = reduction - (trained.carbs - carbs) * 4;
  const fat = Math.max(0, trained.fat - fromFat / 9);
  return { calories, protein: trained.protein, carbs, fat };
}

export function sessionActiveKcal(minutes: number, weightKg: number): number {
  const duration = Math.min(Math.max(minutes, 1 / 60), MAX_SESSION_MINUTES);
  const gross = Math.round((duration * STRENGTH_SESSION_MET * 3.5 * weightKg) / 200);
  const resting = (minutes * 3.5 * weightKg) / 200;
  return Math.max(0, Math.round(gross - resting));
}

export function estimatedDailyAddBack(args: {
  sessionsPerWeek: number;
  sessionMinutes: number;
  weightKg: number;
}): number {
  return Math.round((args.sessionsPerWeek * sessionActiveKcal(args.sessionMinutes, args.weightKg)) / 7);
}

export interface PlanInput {
  age: number;
  gender: string;
  weight: number;
  height: number;
  weightUnit?: WeightUnit;
  heightUnit?: HeightUnit;
  bodyFatPercentage?: number | null;
  exerciseFrequency?: ExerciseFrequency | number;
  activityLevel?: ActivityLevel;
  exerciseType?: ExerciseType;
  weeklyChangeKg?: number;
  dailyAddBackKcal?: number | null;
}

export interface Plan {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  maintenanceCalories: number;
  bmr: number;
  equation: BmrEquation;
  activityMultiplier: number;
  weeklyChangeKg: number;
  dailyChangeKcal: number;
  calorieFloor: number;
  calorieFloorApplied: boolean;
  eatBack: { dailyAddBackKcal: number; sedentaryCalories: number } | null;
}

const frequencyOf = (value: PlanInput['exerciseFrequency']): ExerciseFrequency => {
  const days = Math.min(7, Math.max(1, Math.round(Number(value ?? 1)) || 1));
  return String(days) as ExerciseFrequency;
};

export function computePlan(input: PlanInput): Plan {
  const weightUnit = input.weightUnit ?? 'kg';
  const heightUnit = input.heightUnit ?? 'cm';
  const weeklyChangeKg = Number.isFinite(input.weeklyChangeKg) ? Number(input.weeklyChangeKg) : 0;
  const gender = sexOf(input.gender);
  const weightKg = toKg(input.weight, weightUnit);
  const base = {
    age: input.age,
    gender,
    weight: input.weight,
    height: input.height,
    weightUnit,
    heightUnit,
    exerciseType: input.exerciseType ?? ('hypertrophy' as const),
    bodyFatPercentage: input.bodyFatPercentage ?? undefined,
    targetChange: weeklyChangeKg,
  };
  const activity = input.activityLevel
    ? { activityLevel: input.activityLevel }
    : { exerciseFrequency: frequencyOf(input.exerciseFrequency) };

  const paced = calculate({ ...base, ...activity });
  const raw: Macros = {
    calories: paced.results.targetCalories,
    protein: paced.results.protein,
    carbs: paced.results.carbs,
    fat: paced.results.fat,
  };

  let adjusted = raw;
  let eatBack: Plan['eatBack'] = null;
  if (input.dailyAddBackKcal != null && Number.isFinite(input.dailyAddBackKcal)) {
    const sedentary = calculate({ ...base, exerciseFrequency: '1' }).results.targetCalories;
    adjusted = eatBackBase(raw, sedentary, input.dailyAddBackKcal);
    eatBack = { dailyAddBackKcal: Math.round(input.dailyAddBackKcal), sedentaryCalories: Math.round(sedentary) };
  }

  const floor = clampCalorieFloor(adjusted.calories, gender, weightKg);
  const macros = floor.clamped ? macrosAtFloor(adjusted, floor.calories) : adjusted;

  return {
    calories: Math.round(floor.calories),
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    maintenanceCalories: Math.round(paced.results.tdee),
    bmr: Math.round(paced.results.bmr),
    equation: paced.equation,
    activityMultiplier: paced.multiplier,
    weeklyChangeKg,
    dailyChangeKcal: kcalPerDayForWeeklyChange(weeklyChangeKg),
    calorieFloor: floor.floor,
    calorieFloorApplied: floor.clamped,
    eatBack,
  };
}
