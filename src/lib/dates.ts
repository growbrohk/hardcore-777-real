// Local-date helpers. All dates are "YYYY-MM-DD" strings in the device's
// local timezone — the challenge day is whatever day it is for the user.

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const MONTHS_FULL = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

/** Split "YYYY-MM-DD" into [year, month, day] with safe fallbacks. */
function parts(iso: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return [y, m, d];
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** "25 AUG 2026" */
export function formatHeaderDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "25 AUG" */
export function formatDayShort(iso: string): string {
  const [, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "AUGUST 2026" */
export function monthLabel(iso: string): string {
  const [y, m] = parts(iso);
  return `${MONTHS_FULL[m - 1]} ${y}`;
}

export function yearLabel(iso: string): string {
  return iso.slice(0, 4);
}

/** First day (ISO) of the month containing iso. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Calendar month key "YYYY-MM" for the month before `month`. */
export function prevMonthKey(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Last day (ISO) of the month containing iso. */
export function monthEnd(iso: string): string {
  return `${iso.slice(0, 7)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
}

export function addMonthsISO(iso: string, months: number): string {
  const d = parseISODate(monthStart(iso));
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

export function daysInMonth(iso: string): number {
  const [y, m] = parts(iso);
  return new Date(y, m, 0).getDate();
}
