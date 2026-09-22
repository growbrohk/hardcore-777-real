// Thin compatibility layer over the progression rules so screens keep using
// familiar helpers. All real logic lives in progression.ts.
import { addDaysISO } from "./dates";
import { EXERCISE_KEYS, ZERO_REPS, type Reps } from "./exercises";
import {
  FULL_TARGET,
  HALF_TARGET,
  dayLevel,
  hasAnyReps as anyReps,
  meetsAll,
  totalReps as sumReps,
} from "./progression";

export const DAILY_TARGET = FULL_TARGET;
export const HALF_DAILY_TARGET = HALF_TARGET;

export type { Reps };
export { EXERCISE_KEYS, ZERO_REPS, dayLevel };

export interface DayRecord extends Reps {
  date: string;
}

export const totalReps = sumReps;
export const hasAnyReps = anyReps;

/** A day counts as complete when every ACTIVE exercise reached 100. */
export const isComplete = (r: Reps, count = 3): boolean => meetsAll(r, count, FULL_TARGET);

/** Half completion: every active exercise reached at least 50. */
export const isHalf = (r: Reps, count = 3): boolean => meetsAll(r, count, HALF_TARGET);

/** Rep counts never go below 0. */
export const clampRep = (n: number): number => Math.max(0, Math.round(n));

/**
 * Consecutive completed days ending today — but if today isn't complete yet,
 * count back from yesterday so the streak doesn't vanish at midnight.
 */
export function currentStreak(completedDates: Set<string>, today: string): number {
  let cursor = completedDates.has(today) ? today : addDaysISO(today, -1);
  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

/** Longest historical run of consecutive completed days. */
export function longestStreak(completedDates: Set<string>): number {
  const sorted = [...completedDates].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    run = prev !== null && addDaysISO(prev, 1) === date ? run + 1 : 1;
    if (run > best) best = run;
    prev = date;
  }
  return best;
}
