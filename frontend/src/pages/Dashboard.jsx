import { useEffect, useState } from "react";
import { Compass, Sprout, GraduationCap, HeartHandshake } from "lucide-react";

import { fetchDashboardSummary, fetchDashboardHistory } from "@/lib/api/dashboard";
import { useErrorModal } from "@/context/ErrorModalContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { GenderPieCard } from "@/components/dashboard/GenderPieCard";
import { BirthdaysCard } from "@/components/dashboard/BirthdaysCard";
import { LineChartCard } from "@/components/dashboard/LineChartCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// current year in PH time, the default for the year select
const CURRENT_YEAR = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4));

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
        <StatCard label="Mentors" value={counts?.mentors} icon={Compass} loading={summaryLoading} />
        <StatCard label="Potential mentors" value={counts?.potentialMentors} icon={Sprout} loading={summaryLoading} />
        <StatCard label="Mentees" value={counts?.mentees} icon={GraduationCap} loading={summaryLoading} />
        <StatCard label="Connect" value={counts?.connect} icon={HeartHandshake} loading={summaryLoading} />
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
            title="Care group size"
            subtitle="Total at the end of each month"
            loading={historyLoading}
            series={[
              { name: "Mentors", color: "var(--chart-mentor)", values: column("mentors") },
              { name: "Potential mentors", color: "var(--primary)", values: column("potential_mentors") },
              { name: "Mentees", color: "var(--foreground)", values: column("mentees") },
            ]}
          />
          <LineChartCard
            className="flex-[1_1_420px]"
            title="New first-timers"
            subtitle="Added to Connect each month"
            loading={historyLoading}
            series={[{ name: "First-timers added", color: "var(--success)", values: column("connect_new"), showValues: true }]}
          />
        </div>
      </section>
    </div>
  );
}