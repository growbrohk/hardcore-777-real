// Single source of truth for the Punch progression system.
// Pure functions only — used by the server (monthly calculation) and by every
// screen (TODAY, ME, LEADERBOARD) so nothing is calculated twice differently.
import { prevMonthKey } from "./dates";
import {
  EXERCISE_KEYS,
  MAX_EXERCISES,
  MIN_EXERCISES,
  activeKeys,
  clampCount,
  type Reps,
} from "./exercises";

export const HALF_TARGET = 50;
export const FULL_TARGET = 100;
export const QUALIFYING_DAYS = 21;

export type Tier = "half" | "full";
export type Gender = "man" | "woman";
/** How a single calendar day scores against a routine. */
export type DayLevel = "full" | "half" | "partial" | "none";

export interface StatusInfo {
  id: string;
  count: number;
  tier: Tier;
}

export interface MonthSnapshot {
  statusId: string;
  activeCount: number;
}

export const DEFAULT_STATUS_ID = "half_3";

export function statusId(count: number, tier: Tier): string {
  return `${tier}_${clampCount(count)}`;
}

export function parseStatus(id: string): StatusInfo {
  const [tier, raw] = id.split("_");
  const count = clampCount(Number(raw));
  return {
    id: statusId(count, tier === "full" ? "full" : "half"),
    count,
    tier: tier === "full" ? "full" : "half",
  };
}

/** Internal ids stay stable; only these display labels change. */
function baseLabel(count: number, tier: Tier): string {
  const full = tier === "full";
  if (count <= 3) return full ? "ONE PUNCH" : "HALF PUNCH";
  if (count === 4) return full ? "PUNCH PUNCH" : "HALF PUNCH PUNCH";
  if (count <= 6) return full ? "PUNCHES" : "HALF PUNCHES";
  return full ? "7 PUNCHES" : "HALF 7 PUNCHES";
}

export function statusLabel(id: string, gender: Gender = "man"): string {
  const { count, tier } = parseStatus(id);
  return `${baseLabel(count, tier)} ${gender === "woman" ? "WOMAN" : "MAN"}`;
}

/** Half titles step up with the unlocked count; full stays lagged (ONE PUNCH + 4). */
export function memberStatusLabel(id: string, activeCount: number, gender: Gender = "man"): string {
  const { count, tier } = parseStatus(id);
  const shown = tier === "half" && activeCount > count ? statusId(activeCount, tier) : id;
  return statusLabel(shown, gender);
}

export function totalReps(reps: Reps): number {
  return EXERCISE_KEYS.reduce((sum, k) => sum + (reps[k] || 0), 0);
}

export function activeTotalReps(reps: Reps, count: number): number {
  return activeKeys(count).reduce((sum, k) => sum + (reps[k] || 0), 0);
}

export function meetsAll(reps: Reps, count: number, target: number): boolean {
  return activeKeys(count).every((k) => (reps[k] || 0) >= target);
}

export function meetsTierTarget(reps: Reps, count: number, tier: Tier): boolean {
  return meetsAll(reps, count, tier === "full" ? FULL_TARGET : HALF_TARGET);
}

export function hasAnyReps(reps: Reps): boolean {
  return totalReps(reps) > 0;
}

/** How this day scored for a routine of `count` exercises. */
export function dayLevel(reps: Reps, count: number): DayLevel {
  if (meetsAll(reps, count, FULL_TARGET)) return "full";
  if (meetsAll(reps, count, HALF_TARGET)) return "half";
  return hasAnyReps(reps) ? "partial" : "none";
}

export function exerciseLevel(value: number): DayLevel {
  if (value >= FULL_TARGET) return "full";
  if (value >= HALF_TARGET) return "half";
  return value > 0 ? "partial" : "none";
}

/**
 * The routine a member was on during calendar `month`, from the prior month's
 * progression snapshot (which records the routine applied going forward).
 */
export function routineForMonth(
  snapshots: Record<string, MonthSnapshot>,
  month: string,
): { count: number; tier: Tier } {
  const snap = snapshots[prevMonthKey(month)];
  if (!snap) return { count: MIN_EXERCISES, tier: "half" };
  const { tier } = parseStatus(snap.statusId);
  return { count: clampCount(snap.activeCount), tier };
}

export interface MonthResult {
  statusId: string;
  /** Exercises in the earned routine. */
  count: number;
  tier: Tier;
  /** Days that qualified for the earned routine. */
  qualifyingDays: number;
  /** Full days against the earned routine (used for the unlock counter). */
  fullDays: number;
  /** Exercises active next month (one more when the current routine was held). */
  activeCount: number;
  unlocked: boolean;
}

/**
 * Highest routine held on at least 21 different days of one calendar month.
 * Only grades up to `currentCount` (exercises the member had active that month).
 * Unlocks when the whole current routine was held at half or full.
 */
export function evaluateMonth(days: Reps[], currentCount: number): MonthResult {
  const cap = clampCount(currentCount);
  for (let count = cap; count >= MIN_EXERCISES; count--) {
    for (const tier of ["full", "half"] as Tier[]) {
      const target = tier === "full" ? FULL_TARGET : HALF_TARGET;
      const qualifying = days.filter((d) => meetsAll(d, count, target)).length;
      if (qualifying >= QUALIFYING_DAYS) {
        const unlocked = count === cap && count < MAX_EXERCISES;
        return {
          statusId: statusId(count, tier),
          count,
          tier,
          qualifyingDays: qualifying,
          fullDays: days.filter((d) => meetsAll(d, count, FULL_TARGET)).length,
          activeCount: unlocked ? count + 1 : count,
          unlocked,
        };
      }
    }
  }
  return {
    statusId: DEFAULT_STATUS_ID,
    count: MIN_EXERCISES,
    tier: "half",
    qualifyingDays: 0,
    fullDays: days.filter((d) => meetsAll(d, cap, FULL_TARGET)).length,
    activeCount: MIN_EXERCISES,
    unlocked: false,
  };
}
