import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/AppShell";
import { MemberProfile } from "@/components/MemberProfile";
import { getMyHistory } from "@/lib/hardcore.functions";
import type { RecordDTO } from "@/lib/hardcore.types";
import { type Reps } from "@/lib/exercises";
import { todayLocal } from "@/lib/dates";
import { type MonthSnapshot } from "@/lib/member-ui";
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

function MePage() {
  const { token, member } = useSession();
  const navigate = useNavigate();
  const [records, setRecords] = useState<Record<string, RecordDTO>>({});
  const [snapshots, setSnapshots] = useState<Record<string, MonthSnapshot>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const { records: rows, monthSnapshots } = await getMyHistory({
        data: { token, today: todayLocal() },
      });
      const map: Record<string, RecordDTO> = {};
      for (const r of rows) map[r.date] = r;
      setRecords(map);
      setSnapshots(monthSnapshots);
    } catch {
      // offline — keep what we have
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDay = async (date: string, reps: Reps): Promise<boolean> => {
    if (date !== todayLocal()) return false;
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

  return (
    <MemberProfile
      member={member}
      records={records}
      snapshots={snapshots}
      loaded={loaded}
      readOnly={false}
      onSave={saveDay}
      headerAction={
        <button
          onClick={logout}
          className="border border-border px-3 py-2 text-xs font-bold tracking-widest text-muted-foreground active:bg-muted"
        >
          LOG OUT
        </button>
      }
    />
  );
}
