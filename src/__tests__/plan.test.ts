import { describe, expect, it } from 'vitest';
import {
  AGGRESSIVE_FAT_SHARE,
  BASELINE_PAL,
  blendedBmr,
  DEFAULT_SESSION_MINUTES,
  THERMIC_EFFECT_OF_FOOD,
  calculate,
  calculateExpenditure,
  calorieFloorFor,
  computePlan,
  estimatedDailyAddBack,
  FAT_MIN_G_PER_KG,
  FAT_SHARE,
  kcalPerDayForWeeklyChange,
  LB_PER_KG,
  proteinBasisKg,
} from '../index';

const rei = { age: 26, gender: 'male', weight: 103, height: 182.88, exerciseFrequency: 2, bodyFatPercentage: 32 };

describe('computePlan', () => {
  it('keeps one maintenance for one body at every pace (Rei, Nov 10)', () => {
    const paces = [-0.5669, -0.7938, -0.9979].map(weeklyChangeKg => computePlan({ ...rei, weeklyChangeKg }));
    expect(new Set(paces.map(p => p.maintenanceCalories)).size).toBe(1);
    expect(paces.map(p => p.calories)).toEqual([2216, 1966, 1741]);
    expect(paces.some(p => p.calorieFloorApplied)).toBe(false);
    expect(paces[0]!.maintenanceCalories).toBe(2841);
  });

  it('prices the same body the same in kg/cm and lbs/in', () => {
    for (const weeklyChangeKg of [-0.9, -0.45, 0, 0.25]) {
      const metric = computePlan({ ...rei, weeklyChangeKg });
      const imperial = computePlan({
        ...rei,
        weeklyChangeKg,
        weight: 103 * LB_PER_KG,
        weightUnit: 'lbs',
        height: 72,
        heightUnit: 'in',
      });
      expect(imperial).toEqual(metric);
    }
  });

  it('raises a target the calculator would refuse to the floor instead of failing', () => {
    const plan = computePlan({ age: 22, gender: 'female', weight: 45, height: 152, exerciseFrequency: 1, weeklyChangeKg: -0.9 });
    expect(plan.calories).toBe(1200);
    expect(plan.calorieFloorApplied).toBe(true);
    expect(plan.protein * 4 + plan.carbs * 4 + plan.fat * 9).toBeGreaterThan(1150);
  });

  it('uses 13 kcal per kg above the flat floor for a heavy body', () => {
    expect(calorieFloorFor('male', 150)).toBe(1950);
    expect(calorieFloorFor('female', 110)).toBe(1430);
    expect(calorieFloorFor('other', 60)).toBe(1500);
    expect(calorieFloorFor('female', 400)).toBe(1200);
  });

  it('prices pace at 500 kcal a day per lb a week', () => {
    expect(kcalPerDayForWeeklyChange(-0.7938)).toBe(-875);
    expect(computePlan({ ...rei, weeklyChangeKg: -0.7938 }).dailyChangeKcal).toBe(-875);
  });

  it('eats back an average day without going under the sedentary target', () => {
    const addBack = estimatedDailyAddBack({ sessionsPerWeek: 2, sessionMinutes: 45, weightKg: 103 });
    const plain = computePlan({ ...rei, weeklyChangeKg: -0.5669 });
    const eatBack = computePlan({ ...rei, weeklyChangeKg: -0.5669, dailyAddBackKcal: addBack });
    expect(eatBack.calories).toBe(plain.calories - addBack);
    expect(eatBack.maintenanceCalories).toBe(plain.maintenanceCalories);
    expect(eatBack.calories).toBeGreaterThanOrEqual(eatBack.eatBack!.sedentaryCalories);
  });

  it('keeps the activity-level multiplier for the website tools', () => {
    const light = computePlan({ age: 30, gender: 'female', weight: 65, height: 168, activityLevel: 'light' });
    expect(light.activityMultiplier).toBe(1.375);
    expect(light.maintenanceCalories).toBe(Math.round(light.bmr * 1.375));
  });
});

describe('calculate', () => {
  it('prices a body-fat request with resting burn plus training (Rei)', () => {
    const r = calculate({ age: 26, gender: 'male', weight: 103, height: 182.88, exerciseFrequency: '2', targetChange: -0.7938, exerciseType: 'hypertrophy', weightUnit: 'kg', heightUnit: 'cm', bodyFatPercentage: 32 });
    expect(r.equation).toBe('Mifflin-St Jeor + Katch-McArdle');
    expect(r.results.eee).toBe(81);
    expect(r.results.tdee).toBeCloseTo(2840.705, 2);
    expect(r.results.targetCalories).toBeCloseTo(1965.705, 2);
    expect(r.refusal).toBeNull();
  });

  it('agrees with computePlan, so the calculator pages and the app show one number', () => {
    for (const [exerciseFrequency, sessionMinutes] of [['2', 45], ['5', 30], ['3', 90]] as const) {
      const r = calculate({ age: 34, gender: 'female', weight: 72, height: 165, exerciseFrequency, sessionMinutes, targetChange: -0.45, exerciseType: 'hypertrophy', weightUnit: 'kg', heightUnit: 'cm' });
      const plan = computePlan({ age: 34, gender: 'female', weight: 72, height: 165, exerciseFrequency: Number(exerciseFrequency), sessionMinutes, weeklyChangeKg: -0.45 });
      expect(plan.maintenanceCalories).toBe(Math.round(r.results.tdee));
      expect(plan.calories).toBe(Math.round(r.results.targetCalories));
    }
  });

  it('keeps the old multiplier when only an activity level is given', () => {
    const r = calculate({ age: 30, gender: 'female', weight: 65, height: 168, activityLevel: 'light', goal: 'maintain', exerciseType: 'hypertrophy', weightUnit: 'kg', heightUnit: 'cm' });
    expect(r.equation).toBe('Mifflin-St Jeor');
    expect(r.multiplier).toBe(1.375);
    expect(r.results.eee).toBe(0);
  });

  it('flags what the service refuses', () => {
    const r = calculate({ age: 22, gender: 'female', weight: 45, height: 152, exerciseFrequency: '1', targetChange: -0.9, exerciseType: 'hypertrophy', weightUnit: 'kg', heightUnit: 'cm' });
    expect(r.refusal).not.toBeNull();
  });
});

describe('calculateExpenditure', () => {
  it('adds steps outside workout hours, the workout and 10% TEF to BMR', () => {
    const r = calculateExpenditure({
      age: 30, gender: 'male', weightKg: 80, heightCm: 180, hoursElapsed: 24,
      hourly: [{ hour: 9, steps: 5000 }, { hour: 18, steps: 4000 }],
      workouts: [{ kcal: 300, startHour: 18, endHour: 19 }],
    });
    expect(r.bmr).toBe(1780);
    expect(r.eee).toBe(300);
    expect(r.neat).toBeCloseTo(80 * ((5000 * 0.414 * 180) / 100 / 1000) * 0.95, 6);
    expect(r.tdee).toBeCloseTo((r.bmr + r.neat + r.eee) * 1.1, 6);
  });
});

describe('computePlan fat', () => {
  const macroKcal = (p: { protein: number; carbs: number; fat: number }) => p.protein * 4 + p.carbs * 4 + p.fat * 9;

  it('keeps fat at the per-kg minimum on a floored cut', () => {
    const plan = computePlan({ age: 63, gender: 'female', weight: 68, height: 160, bodyFatPercentage: 38, exerciseFrequency: 2, sessionMinutes: 30, weeklyChangeKg: -0.635 });
    expect(plan.calorieFloorApplied).toBe(true);
    expect(plan.calories).toBe(1200);
    expect(plan.fat).toBe(Math.round(FAT_MIN_G_PER_KG * proteinBasisKg(68, 160)));
    expect(Math.abs(macroKcal(plan) - plan.calories)).toBeLessThan(12);
  });

  it('judges an aggressive cut by the deficit left after the floor', () => {
    const floored = computePlan({ age: 40, gender: 'female', weight: 55, height: 160, exerciseFrequency: 1, sessionMinutes: 30, weeklyChangeKg: -1.0 });
    expect(floored.calorieFloorApplied).toBe(true);
    expect(floored.maintenanceCalories - floored.calories).toBeLessThan(1000);
    expect(floored.fat).toBe(Math.round((floored.calories * FAT_SHARE) / 9));
  });

  it('drops a 1,000 kcal cut to the leaner share, held up by the per-kg minimum', () => {
    const lean = { age: 30, gender: 'male', weight: 80, height: 180, exerciseFrequency: 6, bodyFatPercentage: 10 };
    const hard = computePlan({ ...lean, weeklyChangeKg: -1.0 });
    const moderate = computePlan({ ...lean, weeklyChangeKg: -0.5 });
    expect(hard.maintenanceCalories - hard.calories).toBeGreaterThanOrEqual(1000);
    expect(hard.fat).toBe(Math.max(Math.round((hard.calories * AGGRESSIVE_FAT_SHARE) / 9), Math.round(FAT_MIN_G_PER_KG * 80)));
    expect(moderate.fat).toBe(Math.round((moderate.calories * FAT_SHARE) / 9));
  });

  it('never goes under the minimum, with or without eat-back, and macros still add up', () => {
    for (const weeklyChangeKg of [-0.9979, -0.7938, -0.5669, 0, 0.25]) {
      for (const dailyAddBackKcal of [null, 150]) {
        const plan = computePlan({ ...rei, weeklyChangeKg, dailyAddBackKcal });
        expect(plan.fat).toBeGreaterThanOrEqual(Math.floor(FAT_MIN_G_PER_KG * proteinBasisKg(103, 182.88)));
        expect(Math.abs(macroKcal(plan) - plan.calories)).toBeLessThan(12);
      }
    }
  });

});

describe('computePlan maintenance', () => {
  it('is resting burn (BMR x baseline) plus the planned training', () => {
    const body = { age: 35, gender: 'male', weight: 80, height: 178, exerciseFrequency: 3, sessionMinutes: 60 };
    const plan = computePlan(body);
    const training = estimatedDailyAddBack({ sessionsPerWeek: 3, sessionMinutes: 60, weightKg: 80 });
    expect(plan.equation).toBe('Mifflin-St Jeor');
    const bmr = blendedBmr({ age: 35, gender: 'male', weightKg: 80, heightCm: 178 }).bmr;
    expect(plan.maintenanceCalories).toBe(Math.round(bmr * BASELINE_PAL + training * (1 + THERMIC_EFFECT_OF_FOOD)));
  });

  it('counts training by weekly minutes, not by days', () => {
    const body = { age: 35, gender: 'male', weight: 80, height: 178 };
    const maintenance = [[6, 30], [2, 90], [3, 60]].map(([exerciseFrequency, sessionMinutes]) =>
      computePlan({ ...body, exerciseFrequency, sessionMinutes }).maintenanceCalories
    );
    expect(new Set(maintenance).size).toBe(1);
    expect(computePlan({ ...body, exerciseFrequency: 6, sessionMinutes: 60 }).maintenanceCalories).toBeGreaterThan(maintenance[0]!);
  });

  it('averages Mifflin and Katch-McArdle when body fat is known, so age still counts', () => {
    const body = { gender: 'female', weight: 74, height: 160, bodyFatPercentage: 38, exerciseFrequency: 3, sessionMinutes: 30 };
    const young = computePlan({ ...body, age: 25 });
    const older = computePlan({ ...body, age: 61 });
    expect(older.equation).toBe('Mifflin-St Jeor + Katch-McArdle');
    expect(older.bmr).toBe(Math.round(blendedBmr({ ...body, gender: 'female', weightKg: 74, heightCm: 160, age: 61 }).bmr));
    expect(older.maintenanceCalories).toBeLessThan(young.maintenanceCalories);
  });

  it('uses 45-minute sessions when the length is unknown', () => {
    const body = { age: 26, gender: 'male', weight: 103, height: 182.88, exerciseFrequency: 2 };
    expect(computePlan(body).maintenanceCalories).toBe(computePlan({ ...body, sessionMinutes: DEFAULT_SESSION_MINUTES }).maintenanceCalories);
  });
});
