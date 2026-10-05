const API_URL = import.meta.env.VITE_API_URL;

// card counts, gender splits, and this month's upcoming birthdays
export async function fetchDashboardSummary({ signal } = {}) {
  const res = await fetch(`${API_URL}/dashboard/summary`, { credentials: "include", signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to load dashboard");
  }
  return res.json(); // { counts, gender, birthdays }
}

// 12 monthly points for one year, plus the list of years that have data
export async function fetchDashboardHistory(year, { signal } = {}) {
  const res = await fetch(`${API_URL}/dashboard/history?year=${year}`, { credentials: "include", signal });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "Failed to load monthly progress");
  }
  return res.json(); // { years, months }
}