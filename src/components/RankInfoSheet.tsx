import { useState } from "react";
import { Info, X } from "lucide-react";
import {
  FULL_TARGET,
  HALF_TARGET,
  QUALIFYING_DAYS,
  memberStatusLabel,
  rankLevels,
  type Gender,
} from "@/lib/progression";

export function RankInfoButton({
  gender,
  statusId,
  activeCount,
}: {
  gender: Gender;
  statusId: string;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = memberStatusLabel(statusId, activeCount, gender);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ranking levels"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground active:text-foreground"
      >
        <Info className="h-4 w-4" strokeWidth={2.5} />
      </button>
      {open && <RankInfoSheet gender={gender} currentLabel={currentLabel} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RankInfoSheet({
  gender,
  currentLabel,
  onClose,
}: {
  gender: Gender;
  currentLabel: string;
  onClose: () => void;
}) {
  const levels = rankLevels(gender);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90dvh,40rem)] w-full max-w-md overflow-y-auto border-t-2 border-primary bg-card p-4"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-none tracking-[0.2em]">RANKING LEVELS</h3>
            <p className="mt-1 text-xs font-semibold leading-tight text-muted-foreground">
              HALF = {HALF_TARGET}+ / FULL = {FULL_TARGET}+
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-border active:bg-muted"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <ol className="mt-4 flex flex-col gap-2">
          {levels.map((level) => {
            const current = level.halfLabel === currentLabel || level.fullLabel === currentLabel;
            const title = level.halfLabel.replace(/^HALF\s+/, "(HALF) ");
            return (
              <li key={level.count} className="border border-border px-3 py-2">
                <p className="flex items-center justify-between gap-2 text-xs font-bold tracking-widest text-muted-foreground">
                  <span>{level.count} EXERCISES</span>
                  {level.unlockLabel && <span>+ {level.unlockLabel}</span>}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold tracking-widest ${current ? "text-primary" : ""}`}
                >
                  {title}
                </p>
              </li>
            );
          })}
        </ol>

        <section className="mt-5">
          <h4 className="text-xs font-bold tracking-[0.25em] text-muted-foreground">PROMOTE</h4>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
            Hit <span className="text-primary">{QUALIFYING_DAYS} days</span> in a month (HALF or
            FULL) to LEVEL UP!
          </p>
        </section>

        <section className="mt-4">
          <h4 className="text-xs font-bold tracking-[0.25em] text-muted-foreground">DEMOTE</h4>
          <div className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
            <p>
              Miss <span className="text-primary">{QUALIFYING_DAYS} days</span> and you DROP!
            </p>
            <p>Hit NONE and you reset to HALF PUNCH (3 exercises)!</p>
          </div>
        </section>
      </div>
    </div>
  );
}
