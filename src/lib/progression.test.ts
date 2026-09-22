import { describe, expect, test } from "bun:test";
import { emptyReps, type Reps } from "./exercises";
import {
  DEFAULT_STATUS_ID,
  FULL_TARGET,
  HALF_TARGET,
  QUALIFYING_DAYS,
  evaluateMonth,
  meetsAll,
  routineForMonth,
} from "./progression";

function day(reps: Partial<Reps>): Reps {
  return { ...emptyReps(), ...reps };
}

function fullRoutine(count: number, value = FULL_TARGET): Reps {
  const r = emptyReps();
  const keys = ["pushups", "situps", "squats", "lunges", "glute_bridges", "leg_raises", "burpees"] as const;
  for (let i = 0; i < count; i++) r[keys[i]!] = value;
  return r;
}

describe("evaluateMonth", () => {
  test("requires 21 qualifying days, not 20", () => {
    const days = Array.from({ length: 20 }, () => fullRoutine(3));
    const result = evaluateMonth(days, 3);
    expect(result.statusId).toBe(DEFAULT_STATUS_ID);
    expect(result.activeCount).toBe(3);
  });

  test("21 full days at current tier unlocks next exercise", () => {
    const days = Array.from({ length: 21 }, () => fullRoutine(3));
    const result = evaluateMonth(days, 3);
    expect(result.statusId).toBe("full_3");
    expect(result.activeCount).toBe(4);
    expect(result.unlocked).toBe(true);
  });

  test("§9 Scenario B: 5 active, only 4×100 for 21 days → 4 active, no unlock", () => {
    const days = Array.from({ length: 21 }, () => fullRoutine(4));
    const result = evaluateMonth(days, 5);
    expect(result.statusId).toBe("full_4");
    expect(result.activeCount).toBe(4);
    expect(result.unlocked).toBe(false);
  });

  test("§9 Scenario A: 5 active, 5×100 for 21 days → unlock 6th", () => {
    const days = Array.from({ length: 21 }, () => fullRoutine(5));
    const result = evaluateMonth(days, 5);
    expect(result.statusId).toBe("full_5");
    expect(result.activeCount).toBe(6);
    expect(result.unlocked).toBe(true);
  });

  test("§5 mixed day: 100/100/100/73 qualifies 4×half and 3×full but not 4×full", () => {
    const mixed = day({ pushups: 100, situps: 100, squats: 100, lunges: 73 });
    expect(meetsAll(mixed, 4, FULL_TARGET)).toBe(false);
    expect(meetsAll(mixed, 4, HALF_TARGET)).toBe(true);
    expect(meetsAll(mixed, 3, FULL_TARGET)).toBe(true);
  });

  test("reps on locked 5th exercise do not skip unlock when current is 3", () => {
    const days = Array.from({ length: 21 }, () =>
      day({ pushups: 100, situps: 100, squats: 100, lunges: 100 }),
    );
    const result = evaluateMonth(days, 3);
    expect(result.statusId).toBe("full_3");
    expect(result.activeCount).toBe(4);
  });

  test("no unlock past 7 exercises", () => {
    const days = Array.from({ length: QUALIFYING_DAYS }, () => fullRoutine(7));
    const result = evaluateMonth(days, 7);
    expect(result.statusId).toBe("full_7");
    expect(result.activeCount).toBe(7);
    expect(result.unlocked).toBe(false);
  });
});

describe("routineForMonth", () => {
  test("falls back to half punch 3 when no snapshot", () => {
    expect(routineForMonth({}, "2026-09")).toEqual({ count: 3, tier: "half" });
  });

  test("uses prior month snapshot", () => {
    const snap = {
      "2026-08": { statusId: "full_3", activeCount: 4 },
    };
    expect(routineForMonth(snap, "2026-09")).toEqual({ count: 4, tier: "full" });
  });
});
