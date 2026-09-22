import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell, useSession } from "@/components/AppShell";
import { getLeaderboard } from "@/lib/hardcore.functions";
import type { LeaderboardRowDTO } from "@/lib/hardcore.types";
import { EXERCISES } from "@/lib/exercises";
import {
  addDaysISO,
  addMonthsISO,
  formatHeaderDate,
  monthLabel,
  monthStart,
  todayLocal,
  yearLabel,
} from "@/lib/dates";
import {
  activeExercises,
  exerciseLevelLabel,
  memberStatusLabel,
} from "@/lib/member-ui";
import { exerciseLevel } from "@/lib/progression";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — 777 HARDCORE" },
      { name: "description", content: "Who is carrying the group this day, month and year." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Leaderboard — 777 HARDCORE" },
      {
        property: "og:description",
        content: "Who is carrying the group this day, month and year.",
      },
    ],
  }),
  component: LeaderboardRoute,
});

function LeaderboardRoute() {
  return (
    <AppShell>
      <LeaderboardPage />
    </AppShell>
  );
}

type Period = "day" | "month" | "year";
type Metric = "days" | "reps";

const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "DAY" },
  { id: "month", label: "MONTH" },
  { id: "year", label: "YEAR" },
];

const METRICS: { id: Metric; label: string }[] = [
  { id: "days", label: "DAYS COMPLETED" },
  { id: "reps", label: "TOTAL REPS" },
];

function LeaderboardPage() {
  const { token, member } = useSession();
  const [period, setPeriod] = useState<Period>("month");
  const [metric, setMetric] = useState<Metric>("reps");
  const [ref, setRef] = useState(() => todayLocal());
  const [rows, setRows] = useState<LeaderboardRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const today = todayLocal();
  const isCurrentPeriod =
    period === "day"
      ? ref === today
      : period === "month"
        ? monthStart(ref) === monthStart(today)
        : ref.slice(0, 4) === today.slice(0, 4);

  const label =
    period === "day"
      ? formatHeaderDate(ref)
      : period === "month"
        ? monthLabel(ref)
        : yearLabel(ref);

  const step = (dir: -1 | 1) => {
    setRef((prev) =>
      period === "day"
        ? addDaysISO(prev, dir)
        : period === "month"
          ? addMonthsISO(prev, dir)
          : `${Number(prev.slice(0, 4)) + dir}-${prev.slice(5)}`,
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLeaderboard({ data: { token, period, ref } });
      setRows(result);
      setExpanded(new Set());
    } catch {
      // keep previous rows
    } finally {
      setLoading(false);
    }
  }, [token, period, ref]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...rows].sort((a, b) => {
    if (period === "day") {
      return (
        b.totalReps - a.totalReps ||
        Number(b.complete) - Number(a.complete) ||
        a.name.localeCompare(b.name)
      );
    }
    if (metric === "days") {
      return (
        b.daysCompleted - a.daysCompleted ||
        b.totalReps - a.totalReps ||
        a.name.localeCompare(b.name)
      );
    }
    return (
      b.totalReps - a.totalReps ||
      b.daysCompleted - a.daysCompleted ||
      a.name.localeCompare(b.name)
    );
  });

  const hasData = sorted.some((r) => r.totalReps > 0 || r.daysCompleted > 0);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showDaysMetric = period !== "day" && metric === "days";

  return (
    <div className="px-4 pt-safe">
      <h1 className="text-3xl font-bold tracking-tight">LEADERBOARD</h1>

      <div className="mt-5 grid grid-cols-3 border border-border">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPeriod(p.id);
              setRef(todayLocal());
            }}
            className={`h-11 text-sm font-bold tracking-[0.2em] ${
              period === p.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period !== "day" && (
        <div className="mt-2 grid grid-cols-2 border border-border">
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`h-11 text-xs font-bold tracking-[0.2em] ${
                metric === m.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => step(-1)}
          aria-label="Previous period"
          className="flex h-11 w-11 items-center justify-center border border-border text-foreground active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <p className="text-lg font-bold tracking-[0.2em]">{label}</p>
        <button
          onClick={() => step(1)}
          disabled={isCurrentPeriod}
          aria-label="Next period"
          className="flex h-11 w-11 items-center justify-center border border-border text-foreground active:bg-muted disabled:opacity-20"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse border border-border bg-card" />
          ))}
        </div>
      ) : !hasData ? (
        <p className="mt-6 border border-border px-4 py-8 text-center text-sm font-bold tracking-widest text-muted-foreground">
          NO COMPLETED REPS HERE YET.
        </p>
      ) : (
        <ol className="mt-4 border-t border-border">
          <li className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-2 py-2">
            <span className="text-xs font-bold tracking-widest text-muted-foreground">RANK · MEMBER</span>
            {showDaysMetric ? (
              <span className="tnum text-xs font-bold tracking-widest text-muted-foreground">DAYS</span>
            ) : (
              <div className="grid grid-cols-4 gap-3 text-right">
                <span className="tnum text-xs font-bold tracking-widest text-muted-foreground">PUSH</span>
                <span className="tnum text-xs font-bold tracking-widest text-muted-foreground">SIT</span>
                <span className="tnum text-xs font-bold tracking-widest text-muted-foreground">SQT</span>
                <span className="tnum text-xs font-bold tracking-widest text-muted-foreground">TOTAL</span>
              </div>
            )}
          </li>
          {sorted.map((row, i) => {
            const me = row.memberId === member.id;
            const isOpen = expanded.has(row.memberId);
            const breakdownExercises = activeExercises(row.periodCount);
            const extraExercises = EXERCISES.slice(3, row.activeCount);

            return (
              <li key={row.memberId} className={`border-b border-border ${me ? "bg-card" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggleExpand(row.memberId)}
                  className="grid w-full grid-cols-[1fr_auto] items-baseline gap-4 px-2 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-3">
                      <span className="tnum w-6 shrink-0 text-sm font-semibold text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-lg font-bold tracking-wide ${
                            me ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {row.name.toUpperCase()}
                          {me && (
                            <span className="ml-2 text-xs text-muted-foreground">YOU</span>
                          )}
                        </span>
                        {showDaysMetric && (
                          <span className="mt-0.5 block truncate text-xs font-semibold tracking-[0.15em] text-muted-foreground">
                            {memberStatusLabel(row.statusId, row.activeCount, row.gender)}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                  {showDaysMetric ? (
                    <span
                      className={`tnum shrink-0 text-lg font-bold ${me ? "text-primary" : "text-foreground"}`}
                    >
                      {row.daysCompleted}
                    </span>
                  ) : (
                    <div className="grid shrink-0 grid-cols-4 gap-3 tnum text-right text-base font-semibold">
                      <span className={me ? "text-primary" : "text-foreground"}>
                        {row.reps.pushups.toLocaleString("en-US")}
                      </span>
                      <span className={me ? "text-primary" : "text-foreground"}>
                        {row.reps.situps.toLocaleString("en-US")}
                      </span>
                      <span className={me ? "text-primary" : "text-foreground"}>
                        {row.reps.squats.toLocaleString("en-US")}
                      </span>
                      <span className={me ? "text-primary" : "text-foreground"}>
                        {row.totalReps.toLocaleString("en-US")}
                      </span>
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-3 pt-2">
                    {period === "day" || metric === "days" ? (
                      <ul className="flex flex-col gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground">
                        {breakdownExercises.map((ex) => (
                          <li key={ex.key} className="flex justify-between gap-4">
                            <span>{ex.label}</span>
                            {period === "day" ? (
                              <span className="tnum text-foreground">
                                {exerciseLevelLabel(exerciseLevel(row.reps[ex.key]))}
                              </span>
                            ) : (
                              <span className="tnum text-foreground">
                                {row.full[ex.key]} FULL · {row.half[ex.key]} HALF
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      extraExercises.length > 0 && (
                        <ul className="flex flex-col gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground">
                          {extraExercises.map((ex) => (
                            <li key={ex.key} className="flex justify-between gap-4">
                              <span>{ex.short}</span>
                              <span className="tnum text-foreground">
                                {row.reps[ex.key].toLocaleString("en-US")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                    {metric === "reps" && extraExercises.length === 0 && (
                      <p className="text-xs tracking-widest text-muted-foreground">NO EXTRA EXERCISES</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-6 text-center text-xs font-medium tracking-widest text-muted-foreground">
        {period === "day"
          ? "EVERY REP COUNTS · TAP ROW FOR BREAKDOWN"
          : metric === "days"
            ? "MOST COMPLETE DAYS WINS · TAP ROW FOR BREAKDOWN"
            : "EVERY REP COUNTS · TAP ROW FOR EXERCISES 4–7"}
      </p>
    </div>
  );
}
