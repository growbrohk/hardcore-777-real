import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, useSession } from "@/components/AppShell";
import { RepCard } from "@/components/RepCard";
import { getTodayBoard } from "@/lib/hardcore.functions";
import type { MemberDTO, RecordDTO } from "@/lib/hardcore.types";
import { EXERCISES, ZERO_REPS, type Reps } from "@/lib/exercises";
import { formatHeaderDate, todayLocal } from "@/lib/dates";
import {
  activeExercises,
  markUnlockSeen,
  QUALIFYING_DAYS,
  readUnlockSeen,
  recordToReps,
  memberStatusLabel,
  routineTarget,
} from "@/lib/member-ui";
import { activeTotalReps } from "@/lib/progression";
import { hasAnyReps, isComplete } from "@/lib/stats";
import { readOutbox, syncRecord } from "@/lib/outbox";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — 777 HARDCORE" },
      {
        name: "description",
        content: "Log today's push-ups, sit-ups and squats and see who is beating you.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Today — 777 HARDCORE" },
      {
        property: "og:description",
        content: "Log today's push-ups, sit-ups and squats and see who is beating you.",
      },
    ],
  }),
  component: TodayRoute,
});

function TodayRoute() {
  return (
    <AppShell>
      <TodayPage />
    </AppShell>
  );
}

type SyncState = "synced" | "saving" | "unsynced";

const PAGE_SIZE = 7;

type GroupRow = {
  member: MemberDTO;
  reps: Reps;
  total: number;
  target: number;
  complete: boolean;
};

function TodayPage() {
  const { token, member } = useSession();
  const [date] = useState(todayLocal);
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [records, setRecords] = useState<Record<string, RecordDTO>>({});
  const [mine, setMine] = useState<Reps>({ ...ZERO_REPS });
  const [myQualifyingDays, setMyQualifyingDays] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<SyncState>("synced");
  const [showUnlock, setShowUnlock] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const latest = useRef<Reps>({ ...ZERO_REPS });
  const dirty = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  const activeCount = member.activeCount;
  const target = routineTarget(activeCount);
  const nextUnlock = activeCount < EXERCISES.length ? EXERCISES[activeCount] : null;

  useEffect(() => {
    if (!member.unlock) return;
    const seen = readUnlockSeen(member.id, member.unlock.month, member.unlock.activeCount);
    setShowUnlock(!seen);
  }, [member]);

  const flush = useCallback(
    async (reps: Reps) => {
      setSync("saving");
      const ok = await syncRecord(token, date, reps);
      setSync(ok ? "synced" : "unsynced");
      if (ok) {
        setRecords((prev) => ({
          ...prev,
          [member.id]: { memberId: member.id, date, ...reps },
        }));
      }
    },
    [token, date, member.id],
  );

  const load = useCallback(async () => {
    try {
      const board = await getTodayBoard({ data: { token, date } });
      setMembers(board.members);
      setMyQualifyingDays(board.myQualifyingDays);
      const map: Record<string, RecordDTO> = {};
      for (const r of board.records) map[r.memberId] = r;
      setRecords(map);
      if (!dirty.current) {
        const pending = readOutbox(date);
        const server = map[member.id];
        const effective: Reps = pending ?? recordToReps(server);
        setMine(effective);
        latest.current = effective;
        if (pending) {
          setSync("unsynced");
          void flush(effective);
        }
      }
    } catch {
      // offline — keep whatever is on screen
    } finally {
      setLoaded(true);
    }
  }, [token, date, member.id, flush]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (sync !== "unsynced") return;
    const retry = () => void flush(latest.current);
    window.addEventListener("online", retry);
    const interval = window.setInterval(retry, 15000);
    return () => {
      window.removeEventListener("online", retry);
      window.clearInterval(interval);
    };
  }, [sync, flush]);

  const commit = (next: Reps) => {
    dirty.current = true;
    setMine(next);
    latest.current = next;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      dirty.current = false;
      void flush(latest.current);
    }, 400);
  };

  const total = activeTotalReps(mine, activeCount);
  const complete = isComplete(mine, activeCount);
  const pct = Math.min(100, Math.round((total / target) * 100));

  const groupRows = members
    .map((m) => {
      const rec: Reps =
        m.id === member.id ? mine : recordToReps(records[m.id]);
      const count = m.activeCount;
      return {
        member: m,
        reps: rec,
        total: activeTotalReps(rec, count),
        target: routineTarget(count),
        complete: isComplete(rec, count),
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        Number(b.complete) - Number(a.complete) ||
        a.member.name.localeCompare(b.member.name),
    );

  const anyGroupReps = groupRows.some((r) => r.total > 0);
  const visible = groupRows.slice(0, visibleCount);
  const remaining = Math.max(0, groupRows.length - visibleCount);
  const myRank = groupRows.findIndex((r) => r.member.id === member.id);
  const myRow = myRank >= 0 ? groupRows[myRank] : undefined;
  const pinMe = myRow !== undefined && myRank >= visibleCount;

  const dismissUnlock = () => {
    if (member.unlock) {
      markUnlockSeen(member.id, member.unlock.month, member.unlock.activeCount);
    }
    setShowUnlock(false);
  };

  return (
    <div className="px-4 pt-safe">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold leading-none tracking-tight">
            777 <span className="text-primary">HARDCORE</span>
          </h1>
          <p className="tnum mt-1 text-sm font-semibold tracking-[0.3em] text-muted-foreground">
            {formatHeaderDate(date)}
          </p>
        </div>
        {sync === "unsynced" && (
          <span className="border border-partial px-2 py-0.5 text-xs font-bold tracking-widest text-partial">
            NOT SYNCED
          </span>
        )}
      </header>

      {!loaded ? (
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3">
            {activeExercises(activeCount).map((ex) => (
              <RepCard
                key={ex.key}
                label={ex.label}
                value={mine[ex.key]}
                onCommit={(v) => commit({ ...mine, [ex.key]: v })}
              />
            ))}
          </div>

          <section className="mt-4 border border-border bg-card p-4">
            {complete ? (
              <div className="mb-3 border border-complete bg-complete/10 px-3 py-2 text-center">
                <p className="text-xl font-bold tracking-[0.2em] text-complete">✓ DAY COMPLETE</p>
                <p className="tnum text-sm font-semibold tracking-widest text-foreground">
                  {total} REPS
                </p>
              </div>
            ) : (
              <div className="mb-3 flex items-baseline justify-between">
                <span className="tnum text-2xl font-bold">
                  {total} / {target} REPS
                </span>
                <span className="tnum text-lg font-bold text-primary">{pct}%</span>
              </div>
            )}
            <div className="h-3 w-full bg-muted">
              <div
                className={`h-full transition-all duration-300 ${complete ? "bg-complete" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {complete && total > target && (
              <p className="tnum mt-2 text-right text-sm font-semibold text-muted-foreground">
                {pct}% · BAR MAXED, REPS KEEP COUNTING
              </p>
            )}
          </section>

          {activeCount < EXERCISES.length && (
            <section className="mt-3 border border-border bg-card px-4 py-3">
              <p className="tnum text-center text-sm font-bold tracking-[0.2em]">
                {myQualifyingDays} / {QUALIFYING_DAYS} DAYS
              </p>
              {nextUnlock && (
                <p className="mt-1 text-center text-xs font-semibold tracking-[0.25em] text-muted-foreground">
                  NEXT UNLOCK · {nextUnlock.label}
                </p>
              )}
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-sm font-bold tracking-[0.25em] text-muted-foreground">
              777 HARDCORE — TODAY
            </h2>
            {!anyGroupReps ? (
              <p className="mt-3 border border-border px-4 py-6 text-center text-sm font-bold tracking-widest text-muted-foreground">
                NO REPS YET.
                <br />
                BE THE FIRST.
              </p>
            ) : (
              <>
                <ol className="mt-2 border-t border-border">
                  {visible.map((row, i) => (
                    <TodayGroupRow
                      key={row.member.id}
                      row={row}
                      rank={i + 1}
                      me={row.member.id === member.id}
                    />
                  ))}
                </ol>
                {pinMe && myRow && (
                  <ol className="mt-2 border-t border-border">
                    <TodayGroupRow row={myRow} rank={myRank + 1} me />
                  </ol>
                )}
                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                    className="mt-2 flex h-11 w-full items-center justify-center border border-border bg-card text-xs font-bold tracking-[0.2em] text-muted-foreground active:bg-muted"
                  >
                    SHOW MORE · {remaining} LEFT
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {showUnlock && member.unlock && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4"
          onClick={dismissUnlock}
        >
          <div
            className="w-full max-w-md border-2 border-primary bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-xl font-bold tracking-[0.2em] text-primary">
              {memberStatusLabel(member.unlock.statusId, member.unlock.activeCount, member.gender).replace(/ MAN| WOMAN$/, "")}{" "}
              UNLOCKED
            </p>
            <p className="mt-4 text-center text-sm font-bold tracking-widest text-muted-foreground">
              YOU&apos;VE UNLOCKED:
            </p>
            <p className="mt-2 text-center text-2xl font-bold tracking-widest">
              {activeExercises(member.unlock.activeCount).at(-1)?.label}
            </p>
            <p className="mt-6 text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground">
              YOUR NEW ROUTINE
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-center text-sm font-bold tracking-widest">
              {activeExercises(member.unlock.activeCount).map((ex) => (
                <li key={ex.key}>
                  100 {ex.label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={dismissUnlock}
              className="mt-6 h-12 w-full bg-primary text-sm font-bold tracking-[0.25em] text-primary-foreground"
            >
              LET&apos;S GO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TodayGroupRow({
  row,
  rank,
  me,
}: {
  row: GroupRow;
  rank: number;
  me: boolean;
}) {
  return (
    <li className="flex items-center justify-between border-b border-border py-2">
      <span className="flex items-baseline gap-3">
        <span className="tnum w-6 text-sm font-semibold text-muted-foreground">
          {String(rank).padStart(2, "0")}
        </span>
        <span
          className={`text-lg font-bold tracking-wide ${
            row.complete
              ? "text-complete"
              : hasAnyReps(row.reps)
                ? "text-partial"
                : "text-idle"
          } ${me ? "underline underline-offset-4" : ""}`}
        >
          {row.member.name.toUpperCase()}
        </span>
      </span>
      <span className="tnum text-lg font-semibold">
        {row.total} / {row.target}{" "}
        {row.complete && <span className="text-complete">✓</span>}
      </span>
    </li>
  );
}
