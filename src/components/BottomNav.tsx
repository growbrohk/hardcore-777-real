import { Link } from "@tanstack/react-router";
import { CalendarCheck2, Trophy, User } from "lucide-react";

const ITEMS = [
  { to: "/", label: "TODAY", icon: CalendarCheck2 },
  { to: "/leaderboard", label: "LEADERBOARD", icon: Trophy },
  { to: "/me", label: "ME", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-safe">
      <div className="mx-auto grid w-full max-w-md grid-cols-3">
        {ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-0.5 py-2.5 text-muted-foreground transition-colors"
            activeProps={{ className: "flex flex-col items-center gap-0.5 py-2.5 text-primary transition-colors" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon className="size-5" strokeWidth={2.25} />
            <span className="text-xs font-semibold tracking-widest">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
