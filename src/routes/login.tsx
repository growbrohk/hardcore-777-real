import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loginWithPin, signupWithPin } from "@/lib/hardcore.functions";
import { todayLocal } from "@/lib/dates";
import { getStoredSession, storeSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — 777 HARDCORE" },
      { name: "description", content: "Log in or join the 777 HARDCORE daily challenge." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Login — 777 HARDCORE" },
      { property: "og:description", content: "Log in or join the 777 HARDCORE daily challenge." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getStoredSession()) {
      void navigate({ to: "/", replace: true });
    }
  }, [navigate]);

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setName("");
    setPin("");
    setPin2("");
    setError(null);
  };

  const ready =
    name.trim().length > 0 && pin.length === 4 && (mode === "login" || pin2.length === 4);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    if (mode === "signup" && pin !== pin2) {
      setError("PINs don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, member } =
        mode === "login"
          ? await loginWithPin({ data: { name, pin } })
          : await signupWithPin({ data: { name, pin, today: todayLocal() } });
      storeSession({ token, member });
      void navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPin("");
      setPin2("");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background px-6 pt-safe">
      <div className="flex flex-1 flex-col justify-center">
        <p className="tnum text-7xl font-bold leading-none tracking-tight">777</p>
        <p className="mt-1 text-xl font-bold tracking-[0.35em] text-primary">HARDCORE</p>
        <p className="mt-4 text-sm font-medium tracking-widest text-muted-foreground">
          100 PUSH-UPS · 100 SIT-UPS · 100 SQUATS · EVERY DAY
        </p>

        <form onSubmit={submit} className="mt-10 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-widest text-muted-foreground">
              {mode === "login" ? "WHO ARE YOU" : "YOUR NAME"}
            </span>
            <input
              type="text"
              autoComplete="off"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NAME"
              className="h-14 border border-border bg-card px-4 text-xl font-semibold uppercase tracking-wide text-foreground outline-none placeholder:text-muted focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold tracking-widest text-muted-foreground">
              {mode === "login" ? "4-DIGIT PIN" : "PICK A 4-DIGIT PIN"}
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="tnum h-14 border border-border bg-card px-4 text-center text-3xl font-bold tracking-[0.5em] text-foreground outline-none placeholder:text-muted focus:border-primary"
            />
          </label>

          {mode === "signup" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold tracking-widest text-muted-foreground">
                REPEAT PIN
              </span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="tnum h-14 border border-border bg-card px-4 text-center text-3xl font-bold tracking-[0.5em] text-foreground outline-none placeholder:text-muted focus:border-primary"
              />
            </label>
          )}

          {error && (
            <p className="border border-destructive px-3 py-2 text-center text-sm font-bold tracking-widest text-destructive">
              {error.toUpperCase()}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready || busy}
            className="h-14 bg-primary text-xl font-bold tracking-[0.25em] text-primary-foreground transition-opacity disabled:opacity-30"
          >
            {busy ? "CHECKING…" : mode === "login" ? "ENTER" : "JOIN"}
          </button>

          <button
            type="button"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            className="py-2 text-center text-xs font-bold tracking-[0.25em] text-muted-foreground transition-colors hover:text-primary"
          >
            {mode === "login" ? "NEW HERE? JOIN THE CREW →" : "ALREADY IN? ENTER →"}
          </button>
        </form>
      </div>

      <p className="pb-8 text-center text-xs font-medium tracking-widest text-muted-foreground">
        100 · 100 · 100 · EVERY DAY · NO EXCUSES
      </p>
    </div>
  );
}
