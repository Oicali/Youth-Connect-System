import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// when the OS asks for less motion, charts start in their final state and never animate
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// splits a 12-slot array into runs of consecutive values, so a null month leaves a real gap in the line
function segments(values) {
  const out = [];
  let cur = [];
  values.forEach((v, i) => {
    if (v === null) { if (cur.length) out.push(cur); cur = []; }
    else cur.push([i, v]);
  });
  if (cur.length) out.push(cur);
  return out;
}

const X_START = 60;
const X_STEP = 510 / 11;

// the drawing itself; it mounts fresh every time loading ends, so the draw-in replays on each year change
function ChartSvg({ title, series, year, showTotal }) {
  const [drawn, setDrawn] = useState(prefersReducedMotion);
  const [hover, setHover] = useState(null); // index 0-11 of the month under the pointer, null when none
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 50); // a short wait so the first paint happens in the start state
    return () => clearTimeout(id);
  }, []);

  // y-axis adapts to the data: nice step, rounded-up max
  const all = series.flatMap((s) => s.values).filter((v) => v !== null);
  const rawMax = Math.max(...all, 2); // floor of 2 so there is always a line between 0 and the top
  const step = rawMax <= 4 ? 1 : rawMax <= 10 ? 2 : rawMax <= 20 ? 5 : rawMax <= 50 ? 10 : 20; // step 1 while counts are tiny
  const yMax = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);
  const X = (i) => X_START + i * X_STEP;
  const Y = (v) => 260 - (v / yMax) * 240;

  // how many series share this exact point, and where this series ranks among them (0 = first series)
  const overlap = (k, i, v) => {
    let count = 0;
    let rank = 0;
    series.forEach((s, n) => {
      if (s.values[i] === v) {
        count++;
        if (n < k) rank++;
      }
    });
    return { count, rank };
  };

  // a dot appears when the line reaches it: later months wait longer, later series start later
  const popDelay = (i, k) => 100 + (i / 11) * 800 + k * 150;

  // tooltip rows for the hovered month; total only counts months where every series has data
  const hoverValues = hover === null ? [] : series.map((s) => s.values[hover]);
  const hasAny = hoverValues.some((v) => v !== null);
  const total = showTotal && hasAny ? hoverValues.reduce((sum, v) => sum + (v ?? 0), 0) : null;

  // tooltip sits beside the guide line (not on the dots) and flips to the left for later months
  const pct = hover === null ? 0 : (X(hover) / 600) * 100;
  const flip = hover !== null && hover >= 7;

  return (
    <div className="relative">
      <svg viewBox="0 0 600 300" className="w-full" role="img" aria-label={title}>
        {/* y gridlines + labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1="46" x2="590" y1={Y(t)} y2={Y(t)} stroke="var(--border)" />
            <text x="38" y={Y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted-foreground)">{t}</text>
          </g>
        ))}
        {/* x month labels */}
        {MONTHS.map((m, i) => (
          <text key={m} x={X(i)} y="284" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">{m}</text>
        ))}

        {/* guide line for the hovered month */}
        {hover !== null && (
          <line x1={X(hover)} x2={X(hover)} y1={Y(yMax)} y2={Y(0)} stroke="var(--muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        )}

        {all.length === 0 && (
          <text x="300" y="150" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">No data recorded for this year yet</text>
        )}

        {series.map((s, k) => {
          const lastIdx = s.values.reduce((acc, v, i) => (v === null ? acc : i), -1);
          return (
            <g key={s.name}>
              {segments(s.values).map((seg, n) => (
                <polyline
                  key={n}
                  points={seg.map(([i, v]) => `${X(i)},${Y(v)}`).join(" ")}
                  fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                  pathLength={1} // length 1 for every line, so one dash value works for any shape
                  style={{
                    strokeDasharray: "1 1",
                    strokeDashoffset: drawn ? 0 : 1, // 1 hides the whole line, 0 shows it: the transition draws it
                    transition: `stroke-dashoffset 900ms ease-out ${k * 150}ms`,
                  }}
                />
              ))}
              {s.values.map((v, i) => {
                if (v === null) return null;
                const { count, rank } = overlap(k, i, v);
                const r = 3.5 + (count - 1 - rank) * 2.5 + (hover === i ? 1.5 : 0); // first series gets the biggest ring; the hovered month grows a little
                return (
                  <g
                    key={i}
                    style={{ opacity: drawn ? 1 : 0, transition: `opacity 300ms ease-out ${popDelay(i, k)}ms` }}
                  >
                    <circle cx={X(i)} cy={Y(v)} r={r} fill="var(--card)" stroke={s.color} strokeWidth="2" />
                    {s.showValues ? (
                      <text x={X(i)} y={Y(v) - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--foreground)">{v}</text>
                    ) : (
                      i === lastIdx && (
                        count > 1 ? (
                          // shared end point: labels stack vertically, each with its series color so they can be told apart
                          <g transform={`translate(0, ${(rank - (count - 1) / 2) * 15})`}>
                            <circle cx={X(i) + 16} cy={Y(v)} r="3" fill={s.color} />
                            <text x={X(i) + 24} y={Y(v) + 4} fontSize="12" fontWeight="700" fill="var(--foreground)">{v}</text>
                          </g>
                        ) : (
                          <text x={X(i) + 9} y={Y(v) + 4} fontSize="12" fontWeight="700" fill="var(--foreground)">{v}</text>
                        )
                      )
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* invisible hit areas, one per month, on top so the whole column (labels included) is hoverable */}
        {MONTHS.map((m, i) => (
          <rect
            key={m}
            x={X(i) - X_STEP / 2}
            y="10"
            width={X_STEP}
            height="280"
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
          style={flip ? { right: `${100 - pct}%`, marginRight: 14 } : { left: `${pct}%`, marginLeft: 14 }}
        >
          <p className="mb-1.5 font-semibold">{MONTHS_LONG[hover]}{year ? ` ${year}` : ""}</p>
          {hasAny ? (
            <div className="space-y-1">
              {series.map((s, k) => (
                <div key={s.name} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums">{hoverValues[k] ?? "—"}</span>
                </div>
              ))}
              {total !== null && (
                <div className="mt-1.5 flex items-center justify-between gap-4 border-t pt-1.5">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">{total}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No data recorded</p>
          )}
        </div>
      )}
    </div>
  );
}

// series = [{ name, color, values: (number|null)[12], showValues? }]; showValues labels every point, otherwise only the last one
// year feeds the tooltip heading; showTotal adds a Total row to the tooltip
export function LineChartCard({ title, subtitle, series, loading, year, showTotal = false, className = "" }) {
  return (
    <div className={`rounded-xl border bg-card p-5 ${className}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      {loading ? <Skeleton className="h-[260px] w-full" /> : <ChartSvg title={title} series={series} year={year} showTotal={showTotal} />}
    </div>
  );
}