import { useEffect, useState } from "react";
// HeartHandshake swapped for UserPlus on the Connect card
import { Compass, Sprout, BookOpen, UserPlus } from "lucide-react";
import confetti from "canvas-confetti";

import { fetchDashboardSummary, fetchDashboardHistory } from "@/lib/api/dashboard";
import { useErrorModal } from "@/context/ErrorModalContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { GenderPieCard } from "@/components/dashboard/GenderPieCard";
import { BirthdaysCard } from "@/components/dashboard/BirthdaysCard";
import { LineChartCard } from "@/components/dashboard/LineChartCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// current year in PH time, the default for the year select
const CURRENT_YEAR = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4));

let confettiFiredFor = null;

export default function Dashboard() {
  const { showError } = useErrorModal();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  // cards, pies, and birthdays load once per visit
  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardSummary({ signal: controller.signal })
      .then(setSummary)
      .catch((err) => { if (err.name !== "AbortError") showError(err.message, "Could Not Load Dashboard"); })
      .finally(() => { if (!controller.signal.aborted) setSummaryLoading(false); });
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // charts reload when the year changes; the cleanup cancels a stale request
  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true);
    fetchDashboardHistory(year, { signal: controller.signal })
      .then(setHistory)
      .catch((err) => { if (err.name !== "AbortError") showError(err.message, "Could Not Load Monthly Progress"); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!summary?.birthdays?.some((b) => b.is_today)) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    if (confettiFiredFor === today) return;
    confettiFiredFor = today;

    const colors = ["#f59e0b", "#fbbf24", "#fde68a", "#38bdf8", "#a78bfa", "#4ade80"];
    const end = Date.now() + 500;
    let rafId;
    const frame = () => {
      // lower-corner cannons: bottom-left aims up-right, bottom-right aims up-left, both toward center
      confetti({ particleCount: 5, angle: 60, spread: 55, startVelocity: 60, ticks: 200, origin: { x: 0, y: 1 }, colors, disableForReducedMotion: true });
      confetti({ particleCount: 5, angle: 120, spread: 55, startVelocity: 60, ticks: 200, origin: { x: 1, y: 1 }, colors, disableForReducedMotion: true });
      if (Date.now() < end) rafId = requestAnimationFrame(frame);
    };
    frame();
    // leaving the page mid-burst stops the loop and clears the canvas
    return () => {
      cancelAnimationFrame(rafId);
      confetti.reset();
    };
  }, [summary]);

  // pulls one column out of the 12 months; a missing month stays null so the line shows a gap
  const months = history?.months ?? [];
  const column = (key) =>
    Array.from({ length: 12 }, (_, i) => months.find((m) => m.month === i + 1)?.[key] ?? null);

  // keep the selected year selectable even if the API list doesn't include it yet
  const years = history?.years?.length ? history.years : [CURRENT_YEAR];
  const yearOptions = years.includes(year) ? years : [year, ...years];

  const counts = summary?.counts;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your care group</p>
      </div>

      {/* headline numbers: 1 col on mobile, 2 on sm, 4 on xl */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* status colors come from the --status-* tokens in index.css */}
        <StatCard label="Mentors" value={counts?.mentors} icon={Compass} loading={summaryLoading} badgeClass="bg-status-mentor/10" iconClass="text-status-mentor" />
        <StatCard label="Potential mentors" value={counts?.potentialMentors} icon={Sprout} loading={summaryLoading} badgeClass="bg-status-potential/10" iconClass="text-status-potential" />
        <StatCard label="Mentees" value={counts?.mentees} icon={BookOpen} loading={summaryLoading} badgeClass="bg-status-mentee/10" iconClass="text-status-mentee" />
        <StatCard label="Pending Connect" value={counts?.connect} icon={UserPlus} loading={summaryLoading} badgeClass="bg-success/10" iconClass="text-success" />
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <GenderPieCard gender={summary?.gender} loading={summaryLoading} className="flex-[2_1_560px]" />
        <BirthdaysCard birthdays={summary?.birthdays} loading={summaryLoading} className="flex-[1_1_300px]" />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Monthly progress</h2>
            <p className="text-sm text-muted-foreground">How the care group is growing, month by month</p>
          </div>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28 bg-card">
              <SelectValue placeholder="Year">{year}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-stretch gap-4">
          <LineChartCard
            className="flex-[1_1_420px]"
            title="Care Group Size"
            subtitle="Total at the end of each month"
            loading={historyLoading}
            series={[
              { name: "Mentors", color: "var(--status-mentor)", values: column("mentors") },
              { name: "Potential mentors", color: "var(--status-potential)", values: column("potential_mentors") },
              { name: "Mentees", color: "var(--status-mentee)", values: column("mentees") },
            ]}
          />
          <LineChartCard
            className="flex-[1_1_420px]"
            title="Recorded Connects"
            subtitle="Added to Connect each month"
            loading={historyLoading}
            series={[{ name: "Recorded Connect", color: "var(--success)", values: column("connect_new"), showValues: true }]}
          />
        </div>
      </section>
    </div>
  );
}