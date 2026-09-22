import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { validateSession } from "@/lib/hardcore.functions";
import { todayLocal } from "@/lib/dates";
import {
  clearStoredSession,
  getStoredSession,
  storeSession,
  type StoredSession,
} from "@/lib/session";
import { BottomNav } from "./BottomNav";
import { InstallCallout } from "./InstallCallout";

const SessionContext = createContext<StoredSession | null>(null);

export function useSession(): StoredSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside AppShell");
  return ctx;
}

/**
 * Auth gate + app chrome (bottom nav, install callout) for the three main
 * tabs. Redirects to /login when there is no valid session on this device.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<StoredSession | "loading" | null>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getStoredSession();
      if (!stored) {
        setSession(null);
        return;
      }
      try {
        const member = await validateSession({
          data: { token: stored.token, today: todayLocal() },
        });
        if (cancelled) return;
        const fresh = { token: stored.token, member };
        storeSession(fresh);
        setSession(fresh);
      } catch {
        if (cancelled) return;
        clearStoredSession();
        setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session === null) {
      void navigate({ to: "/login", replace: true });
    }
  }, [session, navigate]);

  if (session === "loading" || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-3xl font-bold tracking-widest text-muted-foreground">777</span>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <div className="mx-auto min-h-screen w-full max-w-md">
        <main
          className="mx-auto w-full max-w-md flex-1"
          style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>
        <BottomNav />
        <InstallCallout />
      </div>
    </SessionContext.Provider>
  );
}
