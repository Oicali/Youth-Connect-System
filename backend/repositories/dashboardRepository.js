const pool = require("../db");

// current counts from the shared view, so cards and the monthly table use one definition
async function getCounts() {
  const result = await pool.query(
    "SELECT mentors, potential_mentors, mentees, connect FROM v_member_counts"
  );
  return result.rows[0];
}

// male / female / unspecified per group; unspecified = empty, NULL, or legacy values
async function getGenderSplit() {
  const result = await pool.query(
    `SELECT 'mentors' AS grp,
            COUNT(*) FILTER (WHERE LOWER(gender) = 'male') AS male,
            COUNT(*) FILTER (WHERE LOWER(gender) = 'female') AS female,
            COUNT(*) FILTER (WHERE gender IS NULL OR LOWER(gender) NOT IN ('male', 'female')) AS unspecified
     FROM members WHERE member_status = 'mentor'
     UNION ALL
     SELECT 'potentialMentors',
            COUNT(*) FILTER (WHERE LOWER(gender) = 'male'),
            COUNT(*) FILTER (WHERE LOWER(gender) = 'female'),
            COUNT(*) FILTER (WHERE gender IS NULL OR LOWER(gender) NOT IN ('male', 'female'))
     FROM members WHERE member_status = 'potential mentor'
     UNION ALL
     SELECT 'mentees',
            COUNT(*) FILTER (WHERE LOWER(gender) = 'male'),
            COUNT(*) FILTER (WHERE LOWER(gender) = 'female'),
            COUNT(*) FILTER (WHERE gender IS NULL OR LOWER(gender) NOT IN ('male', 'female'))
     FROM members WHERE member_status = 'mentee'
     UNION ALL
     SELECT 'connect',
            COUNT(*) FILTER (WHERE LOWER(gender) = 'male'),
            COUNT(*) FILTER (WHERE LOWER(gender) = 'female'),
            COUNT(*) FILTER (WHERE gender IS NULL OR LOWER(gender) NOT IN ('male', 'female'))
     FROM members WHERE connection_status IN ('pending', 'assigned')`
  );
  return result.rows;
}

// birthdays from today to the end of this month (Manila time), sorted by day then name
async function getUpcomingBirthdays() {
  const result = await pool.query(
    `WITH t AS (
       SELECT (now() AT TIME ZONE 'Asia/Manila')::date AS today,
              EXTRACT(DAY FROM (date_trunc('month', now() AT TIME ZONE 'Asia/Manila')
                                + interval '1 month' - interval '1 day'))::int AS last_day
     )
     SELECT id, first_name, last_name, member_status, day, (day = today_day) AS is_today
     FROM (
       SELECT m.id, m.first_name, m.last_name, m.member_status,
              LEAST(EXTRACT(DAY FROM m.birth_date)::int, t.last_day) AS day, -- Feb 29 shows on Feb 28 in non-leap years
              EXTRACT(DAY FROM t.today)::int AS today_day
       FROM members m CROSS JOIN t
       WHERE m.birth_date IS NOT NULL
         AND EXTRACT(MONTH FROM m.birth_date) = EXTRACT(MONTH FROM t.today)
         AND m.member_status IN ('mentor', 'potential mentor', 'mentee') -- care group only: no Connect first-timers, no removed
     ) b
     WHERE day >= today_day
     ORDER BY day, last_name, first_name`
  );
  return result.rows;
}

// first month that has a stats row, as "YYYY-MM", or null before any tracking
async function getFirstStatsMonth() {
  const result = await pool.query(
    "SELECT to_char(MIN(month), 'YYYY-MM') AS first FROM member_monthly_stats"
  );
  return result.rows[0].first;
}

// earliest month a flagged first-timer was added, as "YYYY-MM", or null if there are none
async function getFirstFirstTimerMonth() {
  const result = await pool.query(
    "SELECT to_char(MIN(added_at), 'YYYY-MM') AS first FROM members WHERE connect_origin = true"
  );
  return result.rows[0].first;
}

// every stats row up to the end of the requested year; the service carries values forward from these
async function getStatsRowsUpTo(year) {
  const result = await pool.query(
    `SELECT to_char(month, 'YYYY-MM') AS ym, mentors, potential_mentors, mentees
     FROM member_monthly_stats
     WHERE month < make_date($1::int + 1, 1, 1)
     ORDER BY month`,
    [year]
  );
  return result.rows;
}

// first-timers added per month for one year, counted by the connect_origin flag and added_at
async function getFirstTimersByMonth(year) {
  const result = await pool.query(
    `SELECT EXTRACT(MONTH FROM added_at)::int AS month, COUNT(*)::int AS count
     FROM members
     WHERE connect_origin = true AND EXTRACT(YEAR FROM added_at) = $1
     GROUP BY 1`,
    [year]
  );
  return result.rows;
}

module.exports = {
  getCounts,
  getGenderSplit,
  getUpcomingBirthdays,
  getFirstStatsMonth,
  getFirstFirstTimerMonth,
  getStatsRowsUpTo,
  getFirstTimersByMonth,
};