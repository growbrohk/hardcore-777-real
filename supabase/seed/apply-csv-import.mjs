#!/usr/bin/env node
/**
 * Import semicolon CSV exports into linked Supabase (service role).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 *
 * Usage:
 *   node --env-file=.env supabase/seed/apply-csv-import.mjs \
 *     --members path/to/members.csv \
 *     --daily-records path/to/daily_records.csv
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = { members: null, dailyRecords: null, monthProgress: null };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--members" && value) {
      args.members = resolve(value);
      i++;
    } else if (flag === "--daily-records" && value) {
      args.dailyRecords = resolve(value);
      i++;
    } else if (flag === "--month-progress" && value) {
      args.monthProgress = resolve(value);
      i++;
    }
  }
  if (!args.members || !args.dailyRecords) {
    console.error("Error: --members and --daily-records are required.");
    process.exit(1);
  }
  return args;
}

function parseSemicolonCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length === 0) return [];
  const headers = lines[0].split(";").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(";");
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function nullIfEmpty(value) {
  const t = value.trim();
  return t === "" ? null : t;
}

function toMember(row) {
  return {
    id: row.id,
    name: row.name,
    avatar_url: nullIfEmpty(row.avatar_url),
    pin_hash: row.pin_hash,
    created_at: row.created_at,
    gender: row.gender,
    active_count: Number(row.active_count),
    highest_unlocked: Number(row.highest_unlocked),
    status_id: row.status_id,
    status_month: nullIfEmpty(row.status_month),
  };
}

function toDaily(row) {
  return {
    id: row.id,
    member_id: row.member_id,
    date: row.date,
    pushups: Number(row.pushups),
    situps: Number(row.situps),
    squats: Number(row.squats),
    created_at: row.created_at,
    updated_at: row.updated_at,
    lunges: Number(row.lunges),
    glute_bridges: Number(row.glute_bridges),
    leg_raises: Number(row.leg_raises),
    burpees: Number(row.burpees),
  };
}

function toMonthProgress(row) {
  return {
    id: row.id,
    member_id: row.member_id,
    month: row.month,
    status_id: row.status_id,
    active_count: Number(row.active_count),
    full_days: Number(row.full_days),
    unlocked_count: Number(row.unlocked_count),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use node --env-file=.env).");
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  const members = parseSemicolonCsv(readFileSync(args.members, "utf8")).map(toMember);
  const dailyRecords = parseSemicolonCsv(readFileSync(args.dailyRecords, "utf8")).map(toDaily);
  const monthProgress = args.monthProgress
    ? parseSemicolonCsv(readFileSync(args.monthProgress, "utf8")).map(toMonthProgress)
    : [];

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: membersErr } = await supabase.from("members").upsert(members, { onConflict: "id" });
  if (membersErr) {
    console.error("members import failed:", membersErr.message);
    process.exit(1);
  }
  console.log(`Imported ${members.length} members`);

  const { error: dailyErr } = await supabase.from("daily_records").upsert(dailyRecords, { onConflict: "id" });
  if (dailyErr) {
    console.error("daily_records import failed:", dailyErr.message);
    process.exit(1);
  }
  console.log(`Imported ${dailyRecords.length} daily_records`);

  if (monthProgress.length > 0) {
    const { error: mmpErr } = await supabase
      .from("member_month_progress")
      .upsert(monthProgress, { onConflict: "id" });
    if (mmpErr) {
      console.error("member_month_progress import failed:", mmpErr.message);
      process.exit(1);
    }
    console.log(`Imported ${monthProgress.length} member_month_progress`);
  }

  const { count: memberCount } = await supabase.from("members").select("*", { count: "exact", head: true });
  const { count: dailyCount } = await supabase.from("daily_records").select("*", { count: "exact", head: true });
  console.log(`Remote counts: members=${memberCount}, daily_records=${dailyCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
