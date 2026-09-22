import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { DAILY_TARGET, HALF_DAILY_TARGET } from "@/lib/stats";
import { exerciseLevel } from "@/lib/progression";

interface RepCardProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/**
 * One exercise tracker: giant number, thumb-sized −10/+10, tap the number to
 * type an exact value. Never below 0, no upper cap.
 */
export function RepCard({ label, value, onCommit }: RepCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const level = exerciseLevel(value);
  const done = level === "full";
  const half = level === "half";

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    setEditing(false);
    if (Number.isFinite(parsed)) {
      onCommit(Math.max(0, parsed));
    }
  };

  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-lg font-bold tracking-widest">{label}</h2>
        {done && (
          <span className="flex items-center gap-1 text-sm font-bold tracking-widest text-complete">
            <Check className="size-4" strokeWidth={3} />
            DONE
          </span>
        )}
        {!done && half && (
          <span className="text-sm font-bold tracking-widest text-half">HALF</span>
        )}
      </div>

      <div className="flex items-stretch">
        <button
          type="button"
          aria-label={`Subtract 10 ${label.toLowerCase()}`}
          className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border py-4 text-muted-foreground transition-colors active:bg-secondary active:text-foreground"
          onClick={() => onCommit(Math.max(0, value - 10))}
        >
          <Minus className="size-5" strokeWidth={3} />
          <span className="text-sm font-bold">10</span>
        </button>

        <div className="flex flex-1 items-center justify-center py-2">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDraft();
                if (e.key === "Escape") setEditing(false);
              }}
              className="tnum w-full bg-transparent text-center text-6xl font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <button
              type="button"
              aria-label={`Edit exact ${label.toLowerCase()} count`}
              onClick={() => {
                setDraft(String(value));
                setEditing(true);
              }}
              className={`tnum w-full text-center text-6xl font-bold leading-none outline-none ${
                done ? "text-complete" : half ? "text-half" : ""
              }`}
            >
              {value}
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label={`Add 10 ${label.toLowerCase()}`}
          className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-border py-4 text-primary transition-colors active:bg-secondary"
          onClick={() => onCommit(value + 10)}
        >
          <Plus className="size-5" strokeWidth={3} />
          <span className="text-sm font-bold">10</span>
        </button>
      </div>

      <div className="border-t border-border px-4 py-1.5 text-center">
        <span className="tnum text-sm font-semibold tracking-widest text-muted-foreground">
          {value} / {DAILY_TARGET}
          {!done && value >= HALF_DAILY_TARGET && (
            <span className="ml-2 text-half">· 50+</span>
          )}
        </span>
      </div>
    </section>
  );
}
