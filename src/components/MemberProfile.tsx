import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import type { MemberDTO, RecordDTO } from "@/lib/hardcore.types";
import { type Reps } from "@/lib/exercises";
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
  activeExercises as activeExList,
  dayCountsForMe,
  recordToReps,
  routineForMonth,
  memberStatusLabel,
  routineTarget,
  type MonthSnapshot,
} from "@/lib/member-ui";
import { dayLevel } from "@/lib/progression";
import { clampRep, currentStreak, longestStreak, totalReps } from "@/lib/stats";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function MemberProfile({
  member,
  records,
  snapshots,
  loaded,
  readOnly,
  headerAction,
  onSave,
  initialCursor,
}: {
  member: MemberDTO;
  records: Record<string, RecordDTO>;
  snapshots: Record<string, MonthSnapshot>;
  loaded: boolean;
  readOnly: boolean;
  headerAction: ReactNode;
  onSave?: (date: string, reps: Reps) => Promise<boolean>;
  initialCursor?: string;
}) {
  const [cursor, setCursor] = useState(() => monthStart(initialCursor ?? todayLocal()));
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (initialCursor) setCursor(monthStart(initialCursor));
  }, [initialCursor]);

  const today = todayLocal();
  const allRecords = Object.values(records);
  const monthRecs = allRecords.filter((r) => r.date.startsWith(cursor.slice(0, 7)));
  const isCurrentMonth = cursor === monthStart(today);
  const activeCount = member.activeCount;

  const daysDone = monthRecs.filter((r) =>
    dayCountsForMe(recordToReps(r), snapshots, r.date),
  ).length;
  const totalThisMonth = monthRecs.reduce((sum, r) => sum + totalReps(r), 0);
  const qualifyingDates = new Set(
    allRecords
      .filter((r) => dayCountsForMe(recordToReps(r), snapshots, r.date))
      .map((r) => r.date),
  );
  const streak = currentStreak(qualifyingDates, today);
  const longest = longestStreak(qualifyingDates);

  const repsFor = (date: string): Reps => recordToReps(records[date]);

  const firstDow = (parseISODate(cursor).getDay() + 6) % 7;
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
            {memberStatusLabel(member.statusId, member.activeCount, member.gender)}
          </p>
        </div>
        {headerAction}
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
                const month = iso.slice(0, 7);
                const routineCount = routineForMonth(snapshots, month).count;
                const level = dayLevel(reps, routineCount);
                const future = iso > today;
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    disabled={future}
                    onClick={() => setSelected(iso)}
                    className={`tnum relative flex aspect-square flex-col items-center justify-center text-sm font-bold ${
                      level === "full"
                        ? "bg-primary text-primary-foreground"
                        : level === "half"
                          ? "border-2 border-half bg-half/15 text-foreground"
                          : level === "partial"
                            ? "border border-partial text-foreground"
                            : "border border-border text-muted-foreground"
                    } ${future ? "opacity-25" : ""}`}
                  >
                    {Number(iso.slice(8))}
                    {isToday && (
                      <span
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${
                          level === "full" ? "bg-primary-foreground" : "bg-primary"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-primary" /> COMPLETE
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-half bg-half/15" /> HALF
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
          activeCount={activeCount}
          readOnly={readOnly || selected !== today}
          onClose={() => setSelected(null)}
          onSave={onSave}
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
  activeCount,
  readOnly,
  onClose,
  onSave,
}: {
  date: string;
  initial: Reps;
  activeCount: number;
  readOnly: boolean;
  onClose: () => void;
  onSave?: (date: string, reps: Reps) => Promise<boolean>;
}) {
  const [reps, setReps] = useState<Reps>(initial);
  const [syncError, setSyncError] = useState(false);
  const [saving, setSaving] = useState(false);

  const exercises = activeExList(activeCount);
  const dirty = exercises.some((ex) => reps[ex.key] !== initial[ex.key]);
  const target = routineTarget(activeCount);
  const total = exercises.reduce((sum, ex) => sum + reps[ex.key], 0);
  const complete = exercises.every((ex) => reps[ex.key] >= 100);

  const save = async () => {
    if (readOnly || !onSave) return;
    setSaving(true);
    const ok = await onSave(date, reps);
    setSaving(false);
    if (ok) onClose();
    else setSyncError(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80"
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
          {exercises.map((ex) => (
            <RepAdjuster
              key={ex.key}
              label={ex.label}
              value={reps[ex.key]}
              readOnly={readOnly}
              onChange={(v) => setReps({ ...reps, [ex.key]: v })}
            />
          ))}
        </div>

        <p className="tnum mt-3 text-center text-sm font-semibold text-muted-foreground">
          {total} / {target} REPS {complete && <span className="text-complete">✓ COMPLETE</span>}
        </p>

        {syncError && (
          <p className="mt-2 border border-destructive px-3 py-2 text-center text-xs font-bold tracking-widest text-destructive">
            COULD NOT SAVE — CHECK CONNECTION AND TRY AGAIN
          </p>
        )}

        {!readOnly && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="mt-4 h-14 w-full bg-primary text-lg font-bold tracking-[0.25em] text-primary-foreground disabled:opacity-30"
          >
            {saving ? "SAVING…" : "SAVE"}
          </button>
        )}
      </div>
    </div>
  );
}

function RepAdjuster({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: number;
  readOnly: boolean;
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
          disabled={readOnly}
          aria-label={`Minus 10 ${label.toLowerCase()}`}
          className="flex h-11 w-11 items-center justify-center border border-border active:bg-muted disabled:opacity-30"
        >
          <Minus className="h-4 w-4" strokeWidth={3} />
        </button>
        {editing && !readOnly ? (
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
              if (readOnly) return;
              setDraft(String(value));
              setEditing(true);
            }}
            disabled={readOnly}
            className="tnum flex h-11 w-16 items-center justify-center text-xl font-bold disabled:opacity-70"
          >
            {value}
          </button>
        )}
        <button
          onClick={() => onChange(clampRep(value + 10))}
          disabled={readOnly}
          aria-label={`Plus 10 ${label.toLowerCase()}`}
          className="flex h-11 w-11 items-center justify-center border border-border active:bg-muted disabled:opacity-30"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
        </button>
      </span>
    </div>
  );
}
