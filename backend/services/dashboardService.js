const dashboardRepository = require("../repositories/dashboardRepository");

// today in Manila time as YYYY-MM-DD, so month and year boundaries match what the team sees
const phToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

// pg returns COUNT as a string; the frontend wants numbers
const toGender = (row) => ({
  male: Number(row.male),
  female: Number(row.female),
  unspecified: Number(row.unspecified),
});

async function getSummary() {
  const [counts, genderRows, birthdays] = await Promise.all([
    dashboardRepository.getCounts(),
    dashboardRepository.getGenderSplit(),
    dashboardRepository.getUpcomingBirthdays(),
  ]);

  const gender = {};
  genderRows.forEach((r) => { gender[r.grp] = toGender(r); });

  return {
    counts: {
      mentors: Number(counts.mentors),
      potentialMentors: Number(counts.potential_mentors),
      mentees: Number(counts.mentees),
      connect: Number(counts.connect),
    },
    gender,
    birthdays,
  };
}

async function getHistory(year) {
  const today = phToday();
  const currentYear = Number(today.slice(0, 4));
  const nowYm = today.slice(0, 7);

  if (!Number.isInteger(year) || year < 2000 || year > currentYear) {
    throw { status: 400, message: "Invalid year" };
  }

  const [first, firstFlagged, rows, firstTimers] = await Promise.all([
    dashboardRepository.getFirstStatsMonth(),
    dashboardRepository.getFirstFirstTimerMonth(),
    dashboardRepository.getStatsRowsUpTo(year),
    dashboardRepository.getFirstTimersByMonth(year),
  ]);

  // the two charts start at different months: totals need a snapshot, first-timers only need a flagged member
  const connectStart = [first, firstFlagged].filter(Boolean).sort()[0] ?? null; // earliest of the two, "YYYY-MM" sorts as text

  // years selectable in the dropdown: earliest tracked year up to this year, newest first
  const years = [];
  if (connectStart) {
    for (let y = currentYear; y >= Number(connectStart.slice(0, 4)); y--) years.push(y);
  }

  const firstTimersByMonth = new Map(firstTimers.map((r) => [r.month, r.count]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const inFuture = ym > nowYm;
    const hasStats = first && ym >= first && !inFuture;
    const hasConnect = connectStart && ym >= connectStart && !inFuture;

    // a month with no stats row means nothing changed, so carry the latest earlier row forward
    let latest = null;
    if (hasStats) {
      for (const r of rows) {
        if (r.ym <= ym) latest = r;
        else break;
      }
    }

    return {
      month,
      mentors: latest ? latest.mentors : null, // null = no data, leaves a gap in the line
      potential_mentors: latest ? latest.potential_mentors : null,
      mentees: latest ? latest.mentees : null,
      connect_new: hasConnect ? (firstTimersByMonth.get(month) ?? 0) : null, // a month with none added is a real 0
    };
  });

  return { years, months };
}

module.exports = { getSummary, getHistory };