import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const GROUPS = [
  { key: "mentors", label: "Mentors" },
  { key: "potentialMentors", label: "Potential Mentors" },
  { key: "mentees", label: "Mentees" },
  { key: "connect", label: "Pending Connect" },
];

// when the OS asks for less motion, charts start in their final state and never animate
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// one pie: male slice from 12 o'clock clockwise, female fills the rest; delay staggers the four pies
function Pie({ label, data, delay }) {
  const male = data?.male ?? 0;
  const female = data?.female ?? 0;
  const unspecified = data?.unspecified ?? 0;
  const known = male + female; // unspecified is shown as a note, not a slice
  const malePct = known ? Math.round((male / known) * 100) : 0;
  const femalePct = known ? 100 - malePct : 0; // 100 - male, so the two labels always add to 100

  // drawn flips shortly after mount, which starts the CSS transitions below
  const [drawn, setDrawn] = useState(prefersReducedMotion);
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 50); // a short wait so the first paint happens in the start state
    return () => clearTimeout(id);
  }, []);

  // which slice the mouse is over: "male" | "female" | null
  const [hovered, setHovered] = useState(null);

  // hovered slice scales up from the pie's center (16,16 in viewBox units)
  const sliceStyle = (name) => ({
    transform: hovered === name ? "scale(1.08)" : "scale(1)",
    transformOrigin: "16px 16px",
    transition: "transform 200ms ease-out",
    cursor: "pointer",
  });

  // percentage label sits at the middle of its slice (viewBox is 32 wide, center 16,16)
  const at = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [16 + 9.5 * Math.cos(rad), 16 + 9.5 * Math.sin(rad)];
  };
  const [mx, my] = at(-90 + malePct * 1.8);
  const [fx, fy] = at(-90 + malePct * 3.6 + femalePct * 1.8);

  // wedge from startPct to endPct (0-100, clockwise from 12 o'clock), radius 16 = same reach as the stroked ring
  const wedge = (startPct, endPct) => {
    const pt = (pct) => {
      const rad = ((-90 + pct * 3.6) * Math.PI) / 180;
      return [16 + 16 * Math.cos(rad), 16 + 16 * Math.sin(rad)];
    };
    const [x1, y1] = pt(startPct);
    const [x2, y2] = pt(endPct);
    const largeArc = endPct - startPct > 50 ? 1 : 0;
    return `M16 16 L${x1} ${y1} A16 16 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  // labels fade in after the sweep finishes
  const labelStyle = {
    pointerEvents: "none", // text on top of a slice must not trigger mouseleave
    opacity: drawn ? 1 : 0,
    transition: `opacity 400ms ease-out ${delay + 700}ms`,
  };

  return (
    <div className="text-center">
      <svg
        viewBox="0 0 32 32"
        className="mx-auto size-36 overflow-visible"
        role="img"
        aria-label={`${label}: ${male} male, ${female} female`}
      >
        {known === 0 ? (
          <circle
            cx="16"
            cy="16"
            r="8"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="16"
          />
        ) : (
          <>
            <circle
              cx="16"
              cy="16"
              r="8"
              fill="none"
              stroke="var(--chart-female)"
              strokeWidth="16"
            />
            {/* female slice as its own arc (starts where male ends), so only its wedge scales on hover */}
            <g
              style={sliceStyle("female")}
              onMouseEnter={() => setHovered("female")}
              onMouseLeave={() => setHovered(null)}
            >
              {/* femalePct 100 = full disc (a wedge path can't draw a full circle); otherwise an explicit wedge */}
              {femalePct === 100 ? (
                <circle cx="16" cy="16" r="16" fill="var(--chart-female)" />
              ) : femalePct > 0 ? (
                <path d={wedge(malePct, 100)} fill="var(--chart-female)" />
              ) : null}
            </g>
            {/* male slice grows from 0 to its share: dasharray goes "0 100" to "malePct rest" */}
            <g
              style={sliceStyle("male")}
              onMouseEnter={() => setHovered("male")}
              onMouseLeave={() => setHovered(null)}
            >
              <circle
                cx="16"
                cy="16"
                r="8"
                fill="none"
                stroke="var(--chart-male)"
                strokeWidth="16"
                pathLength="100"
                transform="rotate(-90 16 16)"
                style={{
                  strokeDasharray: drawn
                    ? `${malePct} ${100 - malePct}`
                    : "0 100",
                  transition: `stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
                }}
              />
            </g>
            {/* labels hidden on slices under 8%, the counts below the pie still show them */}
            {malePct >= 8 && (
              <text
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="2.8"
                fontWeight="700"
                fill="var(--chart-male-foreground)"
                style={labelStyle}
              >
                {malePct}%
              </text>
            )}
            {femalePct >= 8 && (
              <text
                x={fx}
                y={fy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="2.8"
                fontWeight="700"
                fill="var(--chart-female-foreground)"
                style={labelStyle}
              >
                {femalePct}%
              </text>
            )}
          </>
        )}
      </svg>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="text-sm text-muted-foreground">
        {male} male · {female} female
      </p>
      {unspecified > 0 && (
        <p className="text-xs text-muted-foreground">
          {unspecified} unspecified
        </p>
      )}
    </div>
  );
}

export function GenderPieCard({ gender, loading, className = "" }) {
  return (
    <div className={`flex flex-col rounded-xl border bg-card p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Gender breakdown</h2>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-chart-male" />
            Male
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-chart-female" />
            Female
          </span>
        </div>
      </div>
      {/* equal columns, group centered vertically so a tall neighbor card doesn't leave the pies floating */}
      <div className="mt-5 grid flex-1 grid-cols-[repeat(auto-fit,minmax(130px,1fr))] items-center gap-6">
        {GROUPS.map((g, idx) =>
          loading ? (
            <div key={g.key} className="space-y-3">
              <Skeleton className="mx-auto size-36 rounded-full" />
              <Skeleton className="mx-auto h-4 w-24" />
            </div>
          ) : (
            <Pie
              key={g.key}
              label={g.label}
              data={gender?.[g.key]}
              delay={idx * 120}
            />
          ),
        )}
      </div>
    </div>
  );
}
