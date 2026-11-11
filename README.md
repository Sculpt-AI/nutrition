# @sculpt-ai/nutrition

The one calorie and macro engine behind Sculpt AI. The app (on the device), the backend, the website and the calculator site all import this package, so a calorie number means the same thing everywhere. Change a rule here, publish, bump the consumers.

## What it computes

- **BMR:** Mifflin-St Jeor, or Katch-McArdle when a body-fat percentage (3-70%) is known.
- **Maintenance (TDEE):** BMR × an activity multiplier, from training days a week (1.2, 1.375, 1.55, 1.55, 1.725, 1.8, 1.9) or an activity level (sedentary 1.2 … very active 1.9).
- **Pace:** 500 kcal a day per lb a week (`weeklyChangeKg × 2.20462 × 500`).
- **Macros:** protein by g/lb for the training style and week (a BMI-27.5 weight above BMI 30), fat 25% of calories (20% when the deficit left after the floor is 1,000 kcal a day or more) and never under 0.6 g per kg of that protein weight, carbs the rest.
- **Floor:** 1,500 kcal (1,200 for women), or 13 kcal per kg when that is higher. A target under it is raised to it: protein kept, fat scaled (still at least the fat minimum), carbs fill the rest.
- **Add back what you burn:** the target less the average day's add-back, never under the once-a-week target.
- **Expenditure:** today's measured burn from steps, workouts and BMR.

## Use

```ts
import { computePlan } from '@sculpt-ai/nutrition';

const plan = computePlan({
  age: 26,
  gender: 'male',
  weight: 227,
  weightUnit: 'lbs',
  height: 72,
  heightUnit: 'in',
  bodyFatPercentage: 32,
  exerciseFrequency: 2,
  exerciseType: 'hypertrophy',
  weeklyChangeKg: -0.7938,
});
```

`plan` has `calories`, `protein`, `carbs`, `fat`, `maintenanceCalories`, `dailyChangeKcal`, `calorieFloor`, `calorieFloorApplied` and `eatBack`. kg/cm and lbs/in give the same plan.

`calculate(request)` is the calculator service's original request and response (results plus the worked steps), for pages that show the working.

## Develop

```sh
npm install
npm test
npm run build
```

## Release

Bump `version`, then `npm run release`. It tests, builds and publishes to public npm and to GitHub Packages: the app and backend resolve `@sculpt-ai/*` from GitHub Packages, the website and calculator site from npm. Then bump the dependency in all four.

MIT
