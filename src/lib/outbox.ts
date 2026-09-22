// Weak-connection safety net: if a save fails, the reps are kept in
// localStorage and retried later. Values are never lost.
import { EXERCISE_KEYS, emptyReps, type Reps } from "./exercises";
import { saveMyRecord } from "./hardcore.functions";

const key = (date: string) => `hardcore777_outbox_${date}`;

export function writeOutbox(date: string, reps: Reps): void {
  try {
    localStorage.setItem(key(date), JSON.stringify(reps));
  } catch {
    // ignore
  }
}

export function readOutbox(date: string): Reps | null {
  try {
    const raw = localStorage.getItem(key(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Reps>;
    const reps = emptyReps();
    let any = false;
    for (const k of EXERCISE_KEYS) {
      if (typeof parsed[k] === "number") {
        reps[k] = parsed[k] as number;
        any = true;
      }
    }
    return any ? reps : null;
  } catch {
    return null;
  }
}

export function clearOutbox(date: string): void {
  try {
    localStorage.removeItem(key(date));
  } catch {
    // ignore
  }
}

/** Save one day's reps; on failure keep them in the outbox. Returns success. */
export async function syncRecord(token: string, date: string, reps: Reps): Promise<boolean> {
  try {
    await saveMyRecord({ data: { token, date, reps } });
    clearOutbox(date);
    return true;
  } catch {
    writeOutbox(date, reps);
    return false;
  }
}
