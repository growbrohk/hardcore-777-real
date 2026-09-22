// Shared UI helpers for progression-aware screens.
import type { RecordDTO } from "./hardcore.types";
import { EXERCISE_KEYS, ZERO_REPS, activeExercises, type Reps } from "./exercises";
import {
  QUALIFYING_DAYS,
  dayLevel,
  exerciseLevel,
  meetsTierTarget,
  routineForMonth,
  statusLabel,
  type MonthSnapshot,
  type Tier,
} from "./progression";

export {
  QUALIFYING_DAYS,
  activeExercises,
  dayLevel,
  exerciseLevel,
  routineForMonth,
  statusLabel,
};

export function routineTarget(count: number): number {
  return count * 100;
}

export function recordToReps(dto: RecordDTO | Partial<Reps> | undefined): Reps {
  if (!dto) return { ...ZERO_REPS };
  const reps = { ...ZERO_REPS };
  for (const k of EXERCISE_KEYS) {
    reps[k] = Number(dto[k] ?? 0) || 0;
  }
  return reps;
}

/** Whether this day counts toward ME stats/streaks (tier-aware). */
export function dayCountsForMe(
  reps: Reps,
  snapshots: Record<string, MonthSnapshot>,
  date: string,
): boolean {
  const month = date.slice(0, 7);
  const { count, tier } = routineForMonth(snapshots, month);
  return meetsTierTarget(reps, count, tier);
}

export function unlockSeenKey(memberId: string, statusMonth: string, activeCount: number): string {
  return `hardcore777_unlock_seen_${memberId}_${statusMonth}_${activeCount}`;
}

export function readUnlockSeen(memberId: string, statusMonth: string, activeCount: number): boolean {
  try {
    return localStorage.getItem(unlockSeenKey(memberId, statusMonth, activeCount)) === "1";
  } catch {
    return false;
  }
}

export function markUnlockSeen(memberId: string, statusMonth: string, activeCount: number): void {
  try {
    localStorage.setItem(unlockSeenKey(memberId, statusMonth, activeCount), "1");
  } catch {
    // ignore
  }
}

export function exerciseLevelLabel(level: ReturnType<typeof exerciseLevel>): string {
  if (level === "full") return "FULL";
  if (level === "half") return "HALF";
  if (level === "partial") return "PARTIAL";
  return "—";
}

export type { Tier, MonthSnapshot };
