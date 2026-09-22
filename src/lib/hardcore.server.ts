// Server-only data layer for 777 HARDCORE.
// Members authenticate with name + 4-digit PIN (stored only as a SHA-256
// hash). Successful login issues an HMAC-signed session token. The database
// tables are fully locked by RLS; every read/write goes through this module
// with the service-role client after the token is verified.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDaysISO, prevMonthKey } from "./dates";
import type {
  BoardDTO,
  LeaderboardRowDTO,
  MemberDTO,
  MyHistoryDTO,
  RecordDTO,
} from "./hardcore.types";
import {
  EXERCISE_KEYS,
  MIN_EXERCISES,
  activeKeys,
  clampCount,
  emptyReps,
  type ExerciseKey,
  type Reps,
} from "./exercises";
import {
  DEFAULT_STATUS_ID,
  FULL_TARGET,
  HALF_TARGET,
  evaluateMonth,
  meetsAll,
  parseStatus,
  routineForMonth,
  type Gender,
  type MonthSnapshot,
} from "./progression";

export type {
  BoardDTO,
  LeaderboardRowDTO,
  MemberDTO,
  MyHistoryDTO,
  RecordDTO,
} from "./hardcore.types";

const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_REPS = 99999;

const MEMBER_COLS =
  "id, name, avatar_url, gender, active_count, highest_unlocked, status_id, status_month";
const REC_COLS =
  "member_id, date, pushups, situps, squats, lunges, glute_bridges, leg_raises, burpees";

interface MemberRow {
  id: string;
  name: string;
  avatar_url: string | null;
  gender: string | null;
  active_count: number | null;
  highest_unlocked: number | null;
  status_id: string | null;
  status_month: string | null;
}

type RecRow = Reps & { member_id: string; date: string };

// ---------- crypto helpers ----------

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSign(payload: string): Promise<string> {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}

/** Constant-time comparison for equal-length hex strings. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- session tokens ----------

async function signToken(memberId: string): Promise<string> {
  const payload = b64urlEncode(
    enc.encode(JSON.stringify({ mid: memberId, exp: Date.now() + SESSION_TTL_MS })),
  );
  return `${payload}.${await hmacSign(payload)}`;
}

async function memberIdFromToken(token: string): Promise<string> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new Error("Unauthorized");
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSign(payload);
  if (!safeEqualHex(await sha256Hex(sig), await sha256Hex(expected))) {
    throw new Error("Unauthorized");
  }
  try {
    const parsed = JSON.parse(dec.decode(b64urlDecode(payload))) as { mid: string; exp: number };
    if (!parsed.mid || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      throw new Error("Unauthorized");
    }
    return parsed.mid;
  } catch {
    throw new Error("Unauthorized");
  }
}

// ---------- login rate limiting (best-effort, per server instance) ----------

const attempts = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

function checkRateLimit(key: string): void {
  const entry = attempts.get(key);
  if (entry && entry.lockedUntil > Date.now()) {
    throw new Error("Too many attempts. Try again in a few minutes.");
  }
}

function recordFailure(key: string): void {
  const entry = attempts.get(key) ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) {
    entry.fails = 0;
    entry.lockedUntil = Date.now() + LOCK_MS;
  }
  attempts.set(key, entry);
}

// ---------- mapping ----------

function toMember(row: MemberRow): MemberDTO {
  const statusId = row.status_id ?? DEFAULT_STATUS_ID;
  const activeCount = clampCount(row.active_count ?? MIN_EXERCISES);
  const earned = parseStatus(statusId);
  const unlocked = activeCount > earned.count;
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    gender: row.gender === "woman" ? "woman" : "man",
    activeCount,
    highestUnlocked: clampCount(row.highest_unlocked ?? MIN_EXERCISES),
    statusId,
    unlock: unlocked && row.status_month ? { month: row.status_month, statusId, activeCount } : null,
  };
}

function toReps(row: Partial<Reps>): Reps {
  const reps = emptyReps();
  for (const k of EXERCISE_KEYS) reps[k] = Number(row[k] ?? 0) || 0;
  return reps;
}

function toRecord(row: RecRow): RecordDTO {
  return { memberId: row.member_id, date: row.date, ...toReps(row) };
}

// ---------- calendar helpers (dates are the member's local dates) ----------

function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Reject client dates far from server UTC so progression cannot be spoofed. */
function clampTrustedClientDate(iso: string): string {
  const utcToday = new Date().toISOString().slice(0, 10);
  const lo = addDaysISO(utcToday, -1);
  const hi = addDaysISO(utcToday, 1);
  if (iso >= lo && iso <= hi) return iso;
  return utcToday;
}

function monthBounds(month: string): [string, string] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

// ---------- progression (single source of truth, idempotent per month) ----------

async function loadMemberRow(memberId: string): Promise<MemberRow> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(MEMBER_COLS)
    .eq("id", memberId)
    .maybeSingle();
  if (error || !data) throw new Error("Unauthorized");
  return data as MemberRow;
}

async function monthReps(memberId: string, month: string): Promise<Reps[]> {
  const [from, to] = monthBounds(month);
  const { data } = await supabaseAdmin
    .from("daily_records")
    .select(REC_COLS)
    .eq("member_id", memberId)
    .gte("date", from)
    .lte("date", to);
  return ((data ?? []) as RecRow[]).map(toReps);
}

/**
 * Applies last calendar month's result to the member, at most once per month.
 * Historical months are never re-graded, so no double promotion/demotion and
 * no duplicate unlocks — one deterministic result per member/month.
 */
async function ensureProgression(row: MemberRow, today: string): Promise<MemberRow> {
  const trusted = clampTrustedClientDate(today);
  const currentMonth = monthKey(trusted);
  if (row.status_month === currentMonth) return row;
  const prev = prevMonthKey(currentMonth);
  const gradingCount = clampCount(row.active_count ?? MIN_EXERCISES);

  const existing = await supabaseAdmin
    .from("member_month_progress")
    .select("status_id, active_count, unlocked_count")
    .eq("member_id", row.id)
    .eq("month", prev)
    .maybeSingle();

  let progress = existing.data;
  if (!progress) {
    const result = evaluateMonth(await monthReps(row.id, prev), gradingCount);
    // active_count and unlocked_count both store the routine size for the following month.
    await supabaseAdmin.from("member_month_progress").insert({
      member_id: row.id,
      month: prev,
      status_id: result.statusId,
      active_count: result.activeCount,
      full_days: result.fullDays,
      unlocked_count: result.activeCount,
    });
    // Re-read so two parallel requests always end up with the same row.
    const reread = await supabaseAdmin
      .from("member_month_progress")
      .select("status_id, active_count, unlocked_count")
      .eq("member_id", row.id)
      .eq("month", prev)
      .maybeSingle();
    progress = reread.data;
  }
  if (!progress) return row;

  const patch = {
    status_id: progress.status_id,
    active_count: clampCount(progress.active_count),
    highest_unlocked: Math.max(
      clampCount(row.highest_unlocked ?? MIN_EXERCISES),
      clampCount(progress.unlocked_count),
    ),
    status_month: currentMonth,
  };
  const { data } = await supabaseAdmin
    .from("members")
    .update(patch)
    .eq("id", row.id)
    .select(MEMBER_COLS)
    .maybeSingle();
  return (data as MemberRow | null) ?? { ...row, ...patch };
}

// ---------- public API used by the server functions ----------

export async function listMemberNames(): Promise<MemberDTO[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(MEMBER_COLS)
    .order("name", { ascending: true });
  if (error) throw new Error("Failed to load members");
  return ((data ?? []) as MemberRow[]).map(toMember);
}

type MemberAuthRow = MemberRow & { pin_hash: string };

/** Case-insensitive exact name match (ILIKE treats `_`/`%` as wildcards). */
async function findMemberForLogin(name: string): Promise<MemberAuthRow | null> {
  const needle = name.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.from("members").select(`${MEMBER_COLS}, pin_hash`);
  if (error) throw new Error("Failed to load members");
  return (
    ((data ?? []) as MemberAuthRow[]).find((row) => row.name.trim().toLowerCase() === needle) ??
    null
  );
}

export async function login(
  name: string,
  pin: string,
): Promise<{ token: string; member: MemberDTO }> {
  const key = name.trim().toLowerCase();
  checkRateLimit(key);

  let data: MemberAuthRow | null;
  try {
    data = await findMemberForLogin(name);
  } catch {
    recordFailure(key);
    throw new Error("Wrong name or PIN.");
  }

  const pinHash = await sha256Hex(pin);
  // Always compare against something so timing doesn't reveal whether the name exists.
  const storedHash = data?.pin_hash ?? "0".repeat(64);

  if (!data || !safeEqualHex(pinHash, storedHash)) {
    recordFailure(key);
    throw new Error("Wrong name or PIN.");
  }

  attempts.delete(key);
  const token = await signToken(data.id);
  return { token, member: toMember(data) };
}

export async function signup(
  name: string,
  pin: string,
  today: string,
): Promise<{ token: string; member: MemberDTO }> {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 1 || cleanName.length > 30) {
    throw new Error("Name must be 1-30 characters.");
  }

  // Case-insensitive uniqueness check in JS so ilike wildcards can't bite.
  const { data: all, error: loadErr } = await supabaseAdmin.from("members").select("id, name");
  if (loadErr) throw new Error("Failed to sign up");
  const taken = (all ?? []).some((m) => m.name.trim().toLowerCase() === cleanName.toLowerCase());
  if (taken) throw new Error("That name is taken. Log in or pick another.");

  const pinHash = await sha256Hex(pin);
  const { data, error } = await supabaseAdmin
    .from("members")
    .insert({
      name: cleanName,
      pin_hash: pinHash,
      // Everyone starts as HALF PUNCH with the original three exercises.
      status_id: DEFAULT_STATUS_ID,
      active_count: MIN_EXERCISES,
      highest_unlocked: MIN_EXERCISES,
      status_month: monthKey(today),
    })
    .select(MEMBER_COLS)
    .single();
  if (error || !data) throw new Error("Failed to sign up");

  const token = await signToken(data.id);
  return { token, member: toMember(data as MemberRow) };
}

export async function memberFromToken(token: string, today: string): Promise<MemberDTO> {
  const memberId = await memberIdFromToken(token);
  const row = await ensureProgression(await loadMemberRow(memberId), clampTrustedClientDate(today));
  return toMember(row);
}

export async function setGender(token: string, gender: Gender): Promise<MemberDTO> {
  const memberId = await memberIdFromToken(token);
  const { data, error } = await supabaseAdmin
    .from("members")
    .update({ gender })
    .eq("id", memberId)
    .select(MEMBER_COLS)
    .maybeSingle();
  if (error || !data) throw new Error("Failed to save");
  return toMember(data as MemberRow);
}

async function loadSnapshotMaps(
  memberIds: string[],
  monthLo: string,
  monthHi: string,
): Promise<Map<string, Record<string, MonthSnapshot>>> {
  if (memberIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from("member_month_progress")
    .select("member_id, month, status_id, active_count")
    .in("member_id", memberIds)
    .gte("month", monthLo)
    .lte("month", monthHi);
  const byMember = new Map<string, Record<string, MonthSnapshot>>();
  for (const row of data ?? []) {
    const id = row.member_id as string;
    const map = byMember.get(id) ?? {};
    map[row.month as string] = {
      statusId: row.status_id as string,
      activeCount: clampCount(row.active_count as number),
    };
    byMember.set(id, map);
  }
  return byMember;
}

export async function getBoard(token: string, date: string): Promise<BoardDTO> {
  const memberId = await memberIdFromToken(token);
  const me = await ensureProgression(await loadMemberRow(memberId), clampTrustedClientDate(date));
  const month = monthKey(date);
  const [from, to] = monthBounds(month);

  const [membersRes, recordsRes, myMonthRes] = await Promise.all([
    supabaseAdmin.from("members").select(MEMBER_COLS).order("name", { ascending: true }),
    supabaseAdmin.from("daily_records").select(REC_COLS).eq("date", date),
    supabaseAdmin
      .from("daily_records")
      .select(REC_COLS)
      .eq("member_id", memberId)
      .gte("date", from)
      .lte("date", to),
  ]);
  if (membersRes.error || recordsRes.error) throw new Error("Failed to load today");

  const activeCount = clampCount(me.active_count ?? MIN_EXERCISES);
  const myQualifyingDays = ((myMonthRes.data ?? []) as RecRow[]).filter((r) =>
    meetsAll(toReps(r), activeCount, HALF_TARGET),
  ).length;

  return {
    members: ((membersRes.data ?? []) as MemberRow[]).map(toMember),
    records: ((recordsRes.data ?? []) as RecRow[]).map(toRecord),
    myQualifyingDays,
  };
}

export async function saveRecord(
  token: string,
  date: string,
  reps: Partial<Reps>,
): Promise<RecordDTO> {
  const memberId = await memberIdFromToken(token);
  const memberRow = await loadMemberRow(memberId);
  const loggable = new Set(activeKeys(clampCount(memberRow.active_count ?? MIN_EXERCISES)));
  const preserved = new Set(
    activeKeys(clampCount(memberRow.highest_unlocked ?? MIN_EXERCISES)),
  );

  const { data: existing } = await supabaseAdmin
    .from("daily_records")
    .select(REC_COLS)
    .eq("member_id", memberId)
    .eq("date", date)
    .maybeSingle();
  const prior = existing ? toReps(existing as RecRow) : emptyReps();

  const clean: Reps = emptyReps();
  for (const k of EXERCISE_KEYS) {
    if (loggable.has(k)) {
      clean[k] = Math.min(Math.max(0, Math.trunc(Number(reps[k] ?? 0) || 0)), MAX_REPS);
    } else if (preserved.has(k)) {
      clean[k] = prior[k];
    } else {
      clean[k] = 0;
    }
  }
  const { data, error } = await supabaseAdmin
    .from("daily_records")
    .upsert({ member_id: memberId, date, ...clean }, { onConflict: "member_id,date" })
    .select(REC_COLS)
    .single();
  if (error || !data) throw new Error("Failed to save");
  return toRecord(data as RecRow);
}

export async function getLeaderboard(
  period: "day" | "month" | "year",
  ref: string,
): Promise<LeaderboardRowDTO[]> {
  let start: string;
  let end: string;
  if (period === "day") {
    start = ref;
    end = ref;
  } else if (period === "month") {
    [start, end] = monthBounds(monthKey(ref));
  } else {
    const y = ref.slice(0, 4);
    start = `${y}-01-01`;
    end = `${y}-12-31`;
  }

  const snapLo = prevMonthKey(monthKey(start));
  const snapHi = prevMonthKey(monthKey(end));

  const membersRes = await supabaseAdmin
    .from("members")
    .select(MEMBER_COLS)
    .order("name", { ascending: true });
  if (membersRes.error) throw new Error("Failed to load leaderboard");

  const memberRows = (membersRes.data ?? []) as MemberRow[];
  const [snapMaps, recordsResFinal] = await Promise.all([
    loadSnapshotMaps(
      memberRows.map((r) => r.id),
      snapLo,
      snapHi,
    ),
    supabaseAdmin.from("daily_records").select(REC_COLS).gte("date", start).lte("date", end),
  ]);
  if (recordsResFinal.error) throw new Error("Failed to load leaderboard");

  const refMonth = monthKey(ref);
  const periodRoutineCount = (snap: Record<string, MonthSnapshot>, m: MemberDTO) =>
    period === "year"
      ? m.activeCount
      : routineForMonth(snap, refMonth).count;

  const zeroCounts = () =>
    Object.fromEntries(EXERCISE_KEYS.map((k) => [k, 0])) as Record<ExerciseKey, number>;

  const byMember = new Map<string, LeaderboardRowDTO>();
  for (const row of memberRows) {
    const m = toMember(row);
    const snap = snapMaps.get(m.id) ?? {};
    const periodCount = periodRoutineCount(snap, m);
    byMember.set(m.id, {
      memberId: m.id,
      name: m.name,
      avatarUrl: m.avatarUrl,
      gender: m.gender,
      statusId: m.statusId,
      activeCount: m.activeCount,
      periodCount,
      daysCompleted: 0,
      totalReps: 0,
      complete: false,
      reps: emptyReps(),
      full: zeroCounts(),
      half: zeroCounts(),
    });
  }

  for (const raw of (recordsResFinal.data ?? []) as RecRow[]) {
    const row = byMember.get(raw.member_id);
    if (!row) continue;
    const reps = toReps(raw);
    const snap = snapMaps.get(raw.member_id) ?? {};
    const dayMonth = monthKey(raw.date);
    const routineCount = routineForMonth(snap, dayMonth).count;
    const complete = meetsAll(reps, routineCount, FULL_TARGET);
    if (complete) row.daysCompleted += 1;
    if (period === "day") row.complete = complete;
    for (const k of EXERCISE_KEYS) {
      const v = reps[k];
      row.reps[k] += v;
      row.totalReps += v;
      if (v >= FULL_TARGET) row.full[k] += 1;
      else if (v >= HALF_TARGET) row.half[k] += 1;
    }
  }
  return [...byMember.values()];
}

async function loadMemberSnapshots(memberId: string): Promise<Record<string, MonthSnapshot>> {
  const { data } = await supabaseAdmin
    .from("member_month_progress")
    .select("month, status_id, active_count")
    .eq("member_id", memberId);
  const map: Record<string, MonthSnapshot> = {};
  for (const row of data ?? []) {
    map[row.month as string] = {
      statusId: row.status_id as string,
      activeCount: clampCount(row.active_count as number),
    };
  }
  return map;
}

export async function getMyRecords(token: string, today: string): Promise<MyHistoryDTO> {
  const memberId = await memberIdFromToken(token);
  const row = await ensureProgression(await loadMemberRow(memberId), clampTrustedClientDate(today));
  const [recordsRes, monthSnapshots] = await Promise.all([
    supabaseAdmin
      .from("daily_records")
      .select(REC_COLS)
      .eq("member_id", memberId)
      .order("date", { ascending: true }),
    loadMemberSnapshots(memberId),
  ]);
  if (recordsRes.error) throw new Error("Failed to load history");
  return {
    member: toMember(row),
    records: ((recordsRes.data ?? []) as RecRow[]).map(toRecord),
    monthSnapshots,
  };
}
