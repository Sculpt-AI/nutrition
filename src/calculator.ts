export type Gender = 'male' | 'female';
export type ExerciseFrequency = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type Goal =
  | 'lose1000'
  | 'lose750'
  | 'lose500'
  | 'lose250'
  | 'maintain'
  | 'gain250'
  | 'gain500'
  | 'gain750'
  | 'gain1000';
export type ExerciseType = 'strength' | 'endurance' | 'hypertrophy';
export type WeightUnit = 'lbs' | 'kg';
export type HeightUnit = 'in' | 'cm';
export type BmrEquation = 'Mifflin-St Jeor' | 'Katch-McArdle' | 'Mifflin-St Jeor + Katch-McArdle';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const KG_PER_LB = 0.453592;
export const LB_PER_KG = 2.20462;
export const CM_PER_INCH = 2.54;
export const KCAL_PER_LB_PER_WEEK = 500;
export const CALCULATOR_MIN_KCAL = 1200;
export const BODY_FAT_MIN = 3;
export const BODY_FAT_MAX = 70;
export const AGGRESSIVE_DEFICIT_KG_PER_WEEK = -0.907;
export const FAT_SHARE = 0.25;
export const AGGRESSIVE_FAT_SHARE = 0.2;

export const ACTIVITY_MULTIPLIER_BY_DAYS: Record<ExerciseFrequency, number> = {
  '1': 1.2,
  '2': 1.375,
  '3': 1.55,
  '4': 1.55,
  '5': 1.725,
  '6': 1.8,
  '7': 1.9,
};

export const ACTIVITY_MULTIPLIER_BY_LEVEL: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOAL_ADJUSTMENT_KCAL: Record<Goal, number> = {
  lose1000: -1000,
  lose750: -750,
  lose500: -500,
  lose250: -250,
  maintain: 0,
  gain250: 250,
  gain500: 500,
  gain750: 750,
  gain1000: 1000,
};

const FREQUENCY_LABEL: Record<ExerciseFrequency, string> = {
  '1': '1 day per week',
  '2': '2 days per week',
  '3': '3 days per week',
  '4': '4 days per week',
  '5': '5 days per week',
  '6': '6 days per week',
  '7': '7 days per week',
};

const ACTIVITY_LEVEL_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'sedentary',
  light: 'lightly active',
  moderate: 'moderately active',
  active: 'active',
  very_active: 'very active',
};

const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  strength: 'Strength Training',
  endurance: 'Endurance Training',
  hypertrophy: 'Hypertrophy Training',
};

const PROTEIN_G_PER_LB: Record<ExerciseType, Record<ExerciseFrequency, number>> = {
  strength: { '1': 0.7, '2': 0.8, '3': 0.9, '4': 0.95, '5': 1.0, '6': 1.0, '7': 1.0 },
  endurance: { '1': 0.7, '2': 0.8, '3': 0.9, '4': 0.9, '5': 0.95, '6': 0.95, '7': 1.0 },
  hypertrophy: { '1': 0.7, '2': 0.8, '3': 0.9, '4': 0.95, '5': 1.0, '6': 1.0, '7': 1.0 },
};

const PROTEIN_ADJUST_ABOVE_BMI = 30;
const PROTEIN_CAP_BMI = 27.5;

export const toKg = (weight: number, unit: WeightUnit): number =>
  unit === 'lbs' ? weight * KG_PER_LB : weight;

export const toCm = (height: number, unit: HeightUnit): number =>
  unit === 'in' ? height * CM_PER_INCH : height;

export const isUsableBodyFat = (bodyFatPercentage: number | null | undefined): boolean =>
  typeof bodyFatPercentage === 'number' &&
  Number.isFinite(bodyFatPercentage) &&
  bodyFatPercentage >= BODY_FAT_MIN &&
  bodyFatPercentage <= BODY_FAT_MAX;

export const kcalPerDayForWeeklyChange = (weeklyChangeKg: number): number =>
  Math.round(weeklyChangeKg * LB_PER_KG * KCAL_PER_LB_PER_WEEK);

export function calculateBMR(
  weight: number,
  height: number,
  age: number,
  gender: Gender,
  weightUnit: WeightUnit,
  heightUnit: HeightUnit,
  bodyFatPercentage?: number | null
): { bmr: number; steps: string[]; equation: BmrEquation } {
  const weightKg = toKg(weight, weightUnit);
  const heightCm = toCm(height, heightUnit);
  const steps: string[] = [];
  if (weightUnit === 'lbs' || heightUnit === 'in') {
    steps.push('**Convert Units:**');
    if (weightUnit === 'lbs') steps.push(`Weight: ${weight} lbs × ${KG_PER_LB} = ${weightKg.toFixed(2)} kg`);
    if (heightUnit === 'in') steps.push(`Height: ${height} inches × ${CM_PER_INCH} = ${heightCm.toFixed(2)} cm`);
    steps.push('');
  }

  if (isUsableBodyFat(bodyFatPercentage)) {
    const leanMassKg = weightKg * (1 - (bodyFatPercentage as number) / 100);
    const bmr = 370 + 21.6 * leanMassKg;
    steps.push('**Katch-McArdle Equation:**');
    steps.push(
      `Lean mass = ${weightKg.toFixed(2)} × (1 - ${bodyFatPercentage}/100) = ${leanMassKg.toFixed(2)} kg`
    );
    steps.push(`BMR = 370 + (21.6 × ${leanMassKg.toFixed(2)}) = ${bmr.toFixed(2)} calories/day`);
    return { bmr, steps, equation: 'Katch-McArdle' };
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === 'male' ? base + 5 : base - 161;
  const sign = gender === 'male' ? '+ 5' : '- 161';
  steps.push('**Mifflin-St Jeor Equation:**');
  steps.push(
    `BMR = (10 × ${weightKg.toFixed(2)}) + (6.25 × ${heightCm.toFixed(2)}) - (5 × ${age}) ${sign}`
  );
  steps.push(
    `BMR = ${(10 * weightKg).toFixed(2)} + ${(6.25 * heightCm).toFixed(2)} - ${5 * age} ${sign}`
  );
  steps.push(`BMR = ${bmr.toFixed(2)} calories/day`);
  return { bmr, steps, equation: 'Mifflin-St Jeor' };
}

export type Activity =
  | { exerciseFrequency: ExerciseFrequency }
  | { activityLevel: ActivityLevel };

export const activityMultiplier = (activity: Activity): number =>
  'activityLevel' in activity
    ? ACTIVITY_MULTIPLIER_BY_LEVEL[activity.activityLevel]
    : ACTIVITY_MULTIPLIER_BY_DAYS[activity.exerciseFrequency];

const activityLabel = (activity: Activity): string =>
  'activityLevel' in activity
    ? ACTIVITY_LEVEL_LABEL[activity.activityLevel]
    : FREQUENCY_LABEL[activity.exerciseFrequency];

export function calculateTDEE(
  bmr: number,
  activity: Activity,
  equation: BmrEquation
): { tdee: number; tef: number; multiplier: number; steps: string[]; tefSteps: string[] } {
  const multiplier = activityMultiplier(activity);
  const tdee = bmr * multiplier;
  const tef = tdee * 0.1;
  const steps = [
    '**Total Daily Energy Expenditure (TDEE):**',
    `Using ${equation} BMR × activity multiplier (industry-standard method)`,
    `Activity multiplier for ${activityLabel(activity)}: ${multiplier}`,
    'TDEE = BMR × multiplier',
    `TDEE = ${bmr.toFixed(2)} × ${multiplier}`,
    `TDEE = ${tdee.toFixed(2)} calories/day`,
  ];
  const tefSteps = [
    '**Thermic Effect of Feeding (TEF):**',
    'TEF is estimated at 10% of TDEE (included in activity multiplier)',
    `TEF = ${tdee.toFixed(2)} × 0.1 = ${tef.toFixed(2)} calories/day`,
  ];
  return { tdee, tef, multiplier, steps, tefSteps };
}

export function calculateTargetCalories(
  tdee: number,
  goal?: Goal,
  targetChange?: number
): { targetCalories: number; adjustment: number; steps: string[] } {
  const steps: string[] = ['**Calorie Adjustment for Goal:**'];
  let adjustment: number;
  if (targetChange !== undefined) {
    const targetChangeLbs = targetChange * LB_PER_KG;
    adjustment = kcalPerDayForWeeklyChange(targetChange);
    steps.push(`Target change: ${targetChange} kg/week (${targetChangeLbs.toFixed(2)} lbs/week)`);
    steps.push(
      `Adjustment: ${targetChangeLbs.toFixed(2)} lbs/week × ${KCAL_PER_LB_PER_WEEK} cal/day = ${adjustment >= 0 ? '+' : ''}${adjustment} calories`
    );
  } else {
    adjustment = GOAL_ADJUSTMENT_KCAL[goal ?? 'maintain'];
    steps.push(`Adjustment: ${adjustment >= 0 ? '+' : ''}${adjustment} calories`);
  }
  const targetCalories = tdee + adjustment;
  steps.push('Target Calories = TDEE + Adjustment');
  steps.push(`Target Calories = ${tdee.toFixed(2)} ${adjustment >= 0 ? '+' : ''} ${adjustment}`);
  steps.push(`Target Calories = ${targetCalories.toFixed(2)} calories/day`);
  return { targetCalories, adjustment, steps };
}

export function proteinBasisKg(weightKg: number, heightCm: number): number {
  const m2 = (heightCm / 100) ** 2;
  if (!(m2 > 0) || weightKg / m2 <= PROTEIN_ADJUST_ABOVE_BMI) return weightKg;
  return PROTEIN_CAP_BMI * m2;
}

const proteinFrequency = (activity: Activity): ExerciseFrequency => {
  if (!('activityLevel' in activity)) return activity.exerciseFrequency;
  const byLevel: Record<ActivityLevel, ExerciseFrequency> = {
    sedentary: '1',
    light: '2',
    moderate: '3',
    active: '5',
    very_active: '7',
  };
  return byLevel[activity.activityLevel];
};

export function calculateMacros(input: {
  targetCalories: number;
  weightKg: number;
  heightCm: number;
  goal?: Goal;
  targetChange?: number;
  exerciseType: ExerciseType;
  activity: Activity;
}): {
  protein: number;
  fat: number;
  carbs: number;
  proteinSteps: string[];
  fatSteps: string[];
  carbSteps: string[];
} {
  const { targetCalories, weightKg, heightCm, goal, targetChange, exerciseType, activity } = input;
  const frequency = proteinFrequency(activity);
  const weightLbs = weightKg * LB_PER_KG;
  const heightMeters = heightCm / 100;
  const bmi = heightMeters > 0 ? weightKg / (heightMeters * heightMeters) : 0;
  const referenceWeightLbs =
    bmi > PROTEIN_ADJUST_ABOVE_BMI
      ? PROTEIN_CAP_BMI * heightMeters * heightMeters * LB_PER_KG
      : weightLbs;
  const multiplier = PROTEIN_G_PER_LB[exerciseType]?.[frequency] ?? 0.8;
  const isAggressiveDeficit =
    targetChange !== undefined
      ? targetChange <= AGGRESSIVE_DEFICIT_KG_PER_WEEK
      : goal === 'lose1000';
  const fatShare = isAggressiveDeficit ? AGGRESSIVE_FAT_SHARE : FAT_SHARE;

  const proteinGrams = referenceWeightLbs * multiplier;
  const proteinCalories = proteinGrams * 4;
  const proteinSteps = [
    '**Protein Calculation:**',
    'Base recommendation: 0.8g per lb of body weight',
    `Training goal: ${EXERCISE_TYPE_LABEL[exerciseType]}`,
    `Exercise frequency: ${FREQUENCY_LABEL[frequency]}`,
    `Protein multiplier: ${multiplier}`,
    `Adjusted recommendation: ${multiplier.toFixed(2)}g per lb of body weight`,
    ...(bmi > PROTEIN_ADJUST_ABOVE_BMI
      ? [
          `Note: BMI ${bmi.toFixed(1)} exceeds 30, so protein is based on an adjusted body weight ` +
            `of ${referenceWeightLbs.toFixed(0)} lbs (BMI 27.5 equivalent) instead of ${weightLbs.toFixed(0)} lbs to avoid over-prescription.`,
        ]
      : []),
    `Protein = ${referenceWeightLbs.toFixed(2)} lbs × ${multiplier.toFixed(2)}g/lb`,
    `Protein = ${proteinGrams.toFixed(1)}g`,
    `Protein Calories = ${proteinGrams.toFixed(1)}g × 4 cal/g = ${proteinCalories.toFixed(1)} calories`,
  ];

  const fatCalories = targetCalories * fatShare;
  const fatGrams = fatCalories / 9;
  const fatSteps = [
    '**Fat Calculation:**',
    `Fat allocation: ${(fatShare * 100).toFixed(0)}% of target calories (ACSM/IOC guideline: 20-35%)`,
    ...(isAggressiveDeficit
      ? ['Using 20% (aggressive deficit: preserves more room for protein + carbs)']
      : []),
    `Fat Calories = ${targetCalories.toFixed(2)} × ${fatShare} = ${fatCalories.toFixed(1)} calories`,
    `Fat = ${fatCalories.toFixed(1)} ÷ 9 cal/g = ${fatGrams.toFixed(1)}g`,
  ];

  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = carbCalories / 4;
  const carbSteps = [
    '**Carbohydrate Calculation:**',
    'Carbs fill the remaining calories',
    'Carb Calories = Total - Protein - Fat',
    `Carb Calories = ${targetCalories.toFixed(2)} - ${proteinCalories.toFixed(1)} - ${fatCalories.toFixed(1)}`,
    `Carb Calories = ${carbCalories.toFixed(1)} calories`,
    `Carbs = ${carbCalories.toFixed(1)} ÷ 4 cal/g = ${carbGrams.toFixed(1)}g`,
  ];

  return { protein: proteinGrams, fat: fatGrams, carbs: carbGrams, proteinSteps, fatSteps, carbSteps };
}

export interface CalculateRequest {
  age: number;
  gender: Gender;
  weight: number;
  height: number;
  exerciseFrequency?: ExerciseFrequency;
  activityLevel?: ActivityLevel;
  goal?: Goal;
  targetChange?: number;
  exerciseType: ExerciseType;
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  bodyFatPercentage?: number | null;
}

export interface CalculateResult {
  results: {
    bmr: number;
    tef: number;
    eee: number;
    neat: number;
    tdee: number;
    targetCalories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  steps: {
    bmrSteps: string[];
    tefSteps: string[];
    eeeSteps: string[];
    neatSteps: string[];
    tdeeSteps: string[];
    calorieAdjustmentSteps: string[];
    proteinSteps: string[];
    fatSteps: string[];
    carbSteps: string[];
  };
  equation: BmrEquation;
  multiplier: number;
  adjustment: number;
  refusal: 'negative-macros' | 'below-minimum' | null;
}

export const isValidCalculateRequest = (body: Partial<CalculateRequest> | null): boolean =>
  body != null &&
  [body.age, body.weight, body.height].every(n => typeof n === 'number' && !isNaN(n) && n > 0) &&
  !!body.gender &&
  !!(body.exerciseFrequency || body.activityLevel) &&
  !!body.exerciseType &&
  !!body.weightUnit &&
  !!body.heightUnit &&
  !(body.goal === undefined && body.targetChange === undefined);

export function calculate(request: CalculateRequest): CalculateResult {
  const activity: Activity = request.activityLevel
    ? { activityLevel: request.activityLevel }
    : { exerciseFrequency: request.exerciseFrequency ?? '1' };
  const bmrResult = calculateBMR(
    request.weight,
    request.height,
    request.age,
    request.gender,
    request.weightUnit,
    request.heightUnit,
    request.bodyFatPercentage
  );
  const tdeeResult = calculateTDEE(bmrResult.bmr, activity, bmrResult.equation);
  const target = calculateTargetCalories(tdeeResult.tdee, request.goal, request.targetChange);
  const macros = calculateMacros({
    targetCalories: target.targetCalories,
    weightKg: toKg(request.weight, request.weightUnit),
    heightCm: toCm(request.height, request.heightUnit),
    goal: request.goal,
    targetChange: request.targetChange,
    exerciseType: request.exerciseType,
    activity,
  });
  const refusal =
    macros.protein < 0 || macros.fat < 0 || macros.carbs < 0
      ? 'negative-macros'
      : target.targetCalories < CALCULATOR_MIN_KCAL
        ? 'below-minimum'
        : null;
  return {
    results: {
      bmr: bmrResult.bmr,
      tef: tdeeResult.tef,
      eee: 0,
      neat: 0,
      tdee: tdeeResult.tdee,
      targetCalories: target.targetCalories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
    },
    steps: {
      bmrSteps: bmrResult.steps,
      tefSteps: tdeeResult.tefSteps,
      eeeSteps: [],
      neatSteps: [],
      tdeeSteps: tdeeResult.steps,
      calorieAdjustmentSteps: target.steps,
      proteinSteps: macros.proteinSteps,
      fatSteps: macros.fatSteps,
      carbSteps: macros.carbSteps,
    },
    equation: bmrResult.equation,
    multiplier: tdeeResult.multiplier,
    adjustment: target.adjustment,
    refusal,
  };
}
