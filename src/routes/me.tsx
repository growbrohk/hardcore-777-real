import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { AppShell, useSession } from "@/components/AppShell";
import { getMyHistory } from "@/lib/hardcore.functions";
import type { RecordDTO } from "@/lib/hardcore.types";
import {
  addDaysISO,
  addMonthsISO,
  daysInMonth,
  formatHeaderDate,
  monthLabel,
  monthStart,
  parseISODate,
  todayLocal,
} from "@/lib/dates";
import {
  clampRep,
  currentStreak,
  hasAnyReps,
  isComplete,
  longestStreak,
  totalReps,
  type Reps,
} from "@/lib/stats";
import { syncRecord } from "@/lib/outbox";
import { clearStoredSession } from "@/lib/session";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "Me — 777 HARDCORE" },
      { name: "description", content: "Your streaks, totals and day-by-day history." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Me — 777 HARDCORE" },
      { property: "og:description", content: "Your streaks, totals and day-by-day history." },
    ],
  }),
  component: MeRoute,
});

function MeRoute() {
  return (
    <AppShell>
      <MePage />
    </AppShell>
  );
}

const ZERO: Reps = { pushups: 0, situps: 0, squats: 0 };
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function MePage() {
  const { token, member } = useSession();
  const navigate = useNavigate();
  const [records, setRecords] = useState<Record<string, RecordDTO>>({});
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState(() => monthStart(todayLocal()));
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { records: rows } = await getMyHistory({ data: { token } });
      const map: Record<string, RecordDTO> = {};
      for (const r of rows) map[r.date] = r;
      setRecords(map);
    } catch {
      // offline — keep what we have
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayLocal();
  const allRecords = Object.values(records);
  const monthRecs = allRecords.filter((r) => r.date.startsWith(cursor.slice(0, 7)));
  const isCurrentMonth = cursor === monthStart(today);

  const daysDone = monthRecs.filter((r) => isComplete(r)).length;
  const totalThisMonth = monthRecs.reduce((sum, r) => sum + totalReps(r), 0);
  const completedDates = new Set(
    allRecords.filter((r) => isComplete(r)).map((r) => r.date),
  );
  const streak = currentStreak(completedDates, today);
  const longest = longestStreak(completedDates);

  const repsFor = (date: string): Reps => {
    const r = records[date];
    return r ? { pushups: r.pushups, situps: r.situps, squats: r.squats } : ZERO;
  };

  const saveDay = async (date: string, reps: Reps): Promise<boolean> => {
    const ok = await syncRecord(token, date, reps);
    if (ok) {
      setRecords((prev) => ({ ...prev, [date]: { memberId: member.id, date, ...reps } }));
    }
    return ok;
  };

  const logout = () => {
    clearStoredSession();
    void navigate({ to: "/login", replace: true });
  };

  // Calendar cells
  const firstDow = (parseISODate(cursor).getDay() + 6) % 7; // Monday-first offset
  const cellCount = daysInMonth(cursor);
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: cellCount }, (_, i) => addDaysISO(cursor, i)),
  ];

  return (
    <div className="px-4 pt-safe">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{member.name.toUpperCase()}</h1>
          <p className="mt-1 text-sm font-semibold tracking-[0.3em] text-muted-foreground">
            YOUR RECORD
          </p>
        </div>
        <button
          onClick={logout}
          className="border border-border px-3 py-2 text-xs font-bold tracking-widest text-muted-foreground active:bg-muted"
        >
          LOG OUT
        </button>
      </header>

      {!loaded ? (
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <StatBox label="DAYS DONE — THIS MONTH" value={String(daysDone)} />
            <StatBox
              label="TOTAL REPS — THIS MONTH"
              value={totalThisMonth.toLocaleString("en-US")}
            />
            <StatBox label="CURRENT STREAK" value={`${streak}D`} accent={streak > 0} />
            <StatBox label="LONGEST STREAK" value={`${longest}D`} />
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCursor(addMonthsISO(cursor, -1))}
                aria-label="Previous month"
                className="flex h-10 w-10 items-center justify-center border border-border active:bg-muted"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
              </button>
              <h2 className="text-lg font-bold tracking-[0.2em]">{monthLabel(cursor)}</h2>
              <button
                onClick={() => setCursor(addMonthsISO(cursor, 1))}
                disabled={isCurrentMonth}
                aria-label="Next month"
                className="flex h-10 w-10 items-center justify-center border border-border active:bg-muted disabled:opacity-20"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={i}
                  className="pb-1 text-center text-xs font-bold tracking-widest text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {cells.map((iso, i) => {
                if (!iso) return <div key={`x${i}`} />;
                const reps = repsFor(iso);
                const complete = isComplete(reps);
                const partial = !complete && hasAnyReps(reps);
                const future = iso > today;
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    disabled={future}
                    onClick={() => setSelected(iso)}
                    className={`tnum relative flex aspect-square flex-col items-center justify-center text-sm font-bold ${
                      complete
                        ? "bg-primary text-primary-foreground"
                        : partial
                          ? "border border-partial text-foreground"
                          : "border border-border text-muted-foreground"
                    } ${future ? "opacity-25" : ""}`}
                  >
                    {Number(iso.slice(8))}
                    {isToday && (
                      <span
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${
                          complete ? "bg-primary-foreground" : "bg-primary"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs font-semibold tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-primary" /> COMPLETE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 border border-partial" /> PARTIAL
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 border border-border" /> REST / MISSED
              </span>
            </div>
          </section>
        </>
      )}

      {selected && (
        <DaySheet
          date={selected}
          initial={repsFor(selected)}
          onClose={() => setSelected(null)}
          onSave={saveDay}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border bg-card p-3">
      <p className={`tnum text-3xl font-bold leading-none ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      <p className="mt-2 text-xs font-bold tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function DaySheet({
  date,
  initial,
  onClose,
  onSave,
}: {
  date: string;
  initial: Reps;
  onClose: () => void;
  onSave: (date: string, reps: Reps) => Promise<boolean>;
}) {
  const [reps, setReps] = useState<Reps>(initial);
  const [syncError, setSyncError] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty =
    reps.pushups !== initial.pushups ||
    reps.situps !== initial.situps ||
    reps.squats !== initial.squats;

  const total = totalReps(reps);
  const complete = isComplete(reps);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(date, reps);
    setSaving(false);
    if (ok) onClose();
    else setSyncError(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border-t-2 border-primary bg-card p-4"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="tnum text-lg font-bold tracking-[0.2em]">{formatHeaderDate(date)}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center border border-border active:bg-muted"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <RepAdjuster
            label="PUSH-UPS"
            value={reps.pushups}
            onChange={(v) => setReps({ ...reps, pushups: v })}
          />
          <RepAdjuster
            label="SIT-UPS"
            value={reps.situps}
            onChange={(v) => setReps({ ...reps, situps: v })}
          />
          <RepAdjuster
            label="SQUATS"
            value={reps.squats}
            onChange={(v) => setReps({ ...reps, squats: v })}
          />
        </div>

        <p className="tnum mt-3 text-center text-sm font-semibold text-muted-foreground">
          {total} / 300 REPS {complete && <span className="text-complete">✓ COMPLETE</span>}
        </p>

        {syncError && (
          <p className="mt-2 border border-destructive px-3 py-2 text-center text-xs font-bold tracking-widest text-destructive">
            COULD NOT SAVE — CHECK CONNECTION AND TRY AGAIN
          </p>
        )}

        <button
          onClick={save}
          disabled={!dirty || saving}
          className="mt-4 h-14 w-full bg-primary text-lg font-bold tracking-[0.25em] text-primary-foreground disabled:opacity-30"
        >
          {saving ? "SAVING…" : "SAVE"}
        </button>
      </div>
    </div>
  );
}

function RepAdjuster({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <div className="flex items-center justify-between border border-border px-3 py-1.5">
      <span className="text-sm font-bold tracking-widest text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <button
          onClick={() => onChange(clampRep(value - 10))}
          aria-label={`Minus 10 ${label.toLowerCase()}`}
          className="flex h-11 w-11 items-center justify-center border border-border active:bg-muted"
        >
          <Minus className="h-4 w-4" strokeWidth={3} />
        </button>
        {editing ? (
          <input
            autoFocus
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onBlur={() => {
              onChange(clampRep(Number(draft) || 0));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="tnum h-11 w-16 border border-primary bg-background text-center text-xl font-bold outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            className="tnum flex h-11 w-16 items-center justify-center text-xl font-bold"
          >
            {value}
          </button>
        )}
        <button
          onClick={() => onChange(clampRep(value + 10))}
          aria-label={`Plus 10 ${label.toLowerCase()}`}
          className="flex h-11 w-11 items-center justify-center border border-border active:bg-muted"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
        </button>
      </span>
    </div>
  );
}
