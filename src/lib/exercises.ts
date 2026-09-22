// The fixed 7-exercise progression. Order never changes and no exercise can
// be added, removed or swapped. Keys match the database column names.

export const EXERCISES = [
  { key: "pushups", label: "PUSH-UPS", short: "PUSH" },
  { key: "situps", label: "SIT-UPS", short: "SIT" },
  { key: "squats", label: "SQUATS", short: "SQT" },
  { key: "lunges", label: "LUNGES", short: "LNG" },
  { key: "glute_bridges", label: "GLUTE BRIDGES", short: "GLT" },
  { key: "leg_raises", label: "LEG RAISES", short: "LEG" },
  { key: "burpees", label: "BURPEES", short: "BRP" },
] as const;

export type ExerciseKey = (typeof EXERCISES)[number]["key"];

export const EXERCISE_KEYS = EXERCISES.map((e) => e.key) as ExerciseKey[];

export const MIN_EXERCISES = 3;
export const MAX_EXERCISES = EXERCISES.length;

export type Reps = Record<ExerciseKey, number>;

export const ZERO_REPS: Reps = {
  pushups: 0,
  situps: 0,
  squats: 0,
  lunges: 0,
  glute_bridges: 0,
  leg_raises: 0,
  burpees: 0,
};

export const emptyReps = (): Reps => ({ ...ZERO_REPS });

export function clampCount(n: number): number {
  if (!Number.isFinite(n)) return MIN_EXERCISES;
  return Math.min(MAX_EXERCISES, Math.max(MIN_EXERCISES, Math.trunc(n)));
}

/** The exercises in the routine of a member with `count` active exercises. */
export function activeExercises(count: number) {
  return EXERCISES.slice(0, clampCount(count));
}

export function activeKeys(count: number): ExerciseKey[] {
  return activeExercises(count).map((e) => e.key);
}
