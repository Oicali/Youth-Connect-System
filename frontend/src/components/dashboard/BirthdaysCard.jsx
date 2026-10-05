import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MEMBER_STATUS_BADGE } from "@/lib/memberStatusLabels";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS = { mentor: "Mentor", "potential mentor": "Potential Mentor", mentee: "Mentee" };

// month names in PH time so "this month" matches what the team sees
const monthLong = new Date().toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Manila" });
const monthShort = new Date().toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Manila" }).toUpperCase();

// when the OS asks for less motion, the list starts in its final state and never animates
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function BirthdaysCard({ birthdays, loading, className = "" }) {
  // shown flips shortly after loading ends, which starts the CSS transitions on the rows
  const [shown, setShown] = useState(prefersReducedMotion);
  useEffect(() => {
    if (loading) return;
    const id = setTimeout(() => setShown(true), 50); // a short wait so the first paint happens in the start state
    return () => clearTimeout(id);
  }, [loading]);

  // list arrives sorted by day; group neighbors so two people on the same day share one date badge
  const groups = [];
  (birthdays || []).forEach((b) => {
    const last = groups[groups.length - 1];
    if (last && last.day === b.day) last.people.push(b);
    else groups.push({ day: b.day, isToday: b.is_today, people: [b] });
  });

  return (
    <div className={`flex flex-col rounded-xl border bg-card p-5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Birthdays this month 🎉</h2>
        <span className="text-sm text-muted-foreground">
          {loading ? monthLong : `${birthdays?.length ?? 0} celebrants left`}
        </span>
      </div>

      {/* max height of 4 single-person rows: a 5th celebrant scrolls inside the card instead of stretching the row */}
      <div className="mt-2.5 max-h-[256px] overflow-y-auto pr-1.5">
        {loading ? (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No more birthdays this month</p>
        ) : (
          groups.map((g, idx) => {
            const delay = Math.min(idx, 8) * 70; // stagger stops growing after the 9th group so long lists don't drag
            return (
              <div
                key={g.day}
                className={`flex items-center gap-3 py-2.5 ${idx < groups.length - 1 ? "border-b" : ""}`}
                style={{
                  opacity: shown ? 1 : 0,
                  transform: shown ? "translateY(0)" : "translateY(8px)",
                  transition: `opacity 350ms ease-out ${delay}ms, transform 350ms ease-out ${delay}ms`,
                }}
              >
                {/* date badge: solid gold for today, soft tint for later days; pops in just after its row starts */}
                <div
                  className={`w-11 shrink-0 rounded-lg py-1 text-center ${
                    g.isToday ? "bg-primary text-primary-foreground" : "bg-primary/15 text-accent-ink"
                  }`}
                  style={{
                    transform: shown ? "scale(1)" : "scale(0.85)",
                    transition: `transform 400ms cubic-bezier(0.22, 1, 0.36, 1) ${delay + 100}ms`,
                  }}
                >
                  <div className="text-[11px] font-semibold">{monthShort}</div>
                  <div className="text-lg font-bold leading-none">{g.day}</div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {g.people.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{p.first_name} {p.last_name}</span>
                     
                      <Badge
                        variant="secondary"
                        className={`whitespace-nowrap ${MEMBER_STATUS_BADGE[p.member_status] ?? ""}`}
                      >
                        {ROLE_LABELS[p.member_status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}