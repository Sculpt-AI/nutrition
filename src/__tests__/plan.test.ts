import { describe, expect, it } from 'vitest';
import {
  calculate,
  calculateExpenditure,
  calorieFloorFor,
  computePlan,
  estimatedDailyAddBack,
  kcalPerDayForWeeklyChange,
  LB_PER_KG,
} from '../index';

const rei = { age: 26, gender: 'male', weight: 103, height: 182.88, exerciseFrequency: 2, bodyFatPercentage: 32 };

describe('computePlan', () => {
  it('keeps one maintenance for one body at every pace (Rei, Nov 10)', () => {
    const paces = [-0.5669, -0.7938, -0.9979].map(weeklyChangeKg => computePlan({ ...rei, weeklyChangeKg }));
    expect(new Set(paces.map(p => p.maintenanceCalories)).size).toBe(1);
    expect(paces.map(p => p.calories)).toEqual([1964, 1714, 1500]);
    expect(paces[2]!.calorieFloorApplied).toBe(true);
    expect(paces[0]!.maintenanceCalories).toBe(2589);
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

  it('accepts an activity level for the website tools', () => {
    const light = computePlan({ age: 30, gender: 'female', weight: 65, height: 168, activityLevel: 'light' });
    const twoDays = computePlan({ age: 30, gender: 'female', weight: 65, height: 168, exerciseFrequency: 2 });
    expect(light.maintenanceCalories).toBe(twoDays.maintenanceCalories);
  });
});

describe('calculate', () => {
  it('matches the calculator service v2 response for a body-fat request', () => {
    const r = calculate({ age: 26, gender: 'male', weight: 103, height: 182.88, exerciseFrequency: '2', targetChange: -0.7938, exerciseType: 'hypertrophy', weightUnit: 'kg', heightUnit: 'cm', bodyFatPercentage: 32 });
    expect(r.equation).toBe('Katch-McArdle');
    expect(r.results.tdee).toBeCloseTo(2588.938, 2);
    expect(r.results.targetCalories).toBeCloseTo(1713.938, 2);
    expect(r.refusal).toBeNull();
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
