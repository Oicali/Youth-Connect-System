// backend\repositories\memberRepository.js
const pool = require("../db");

const MEMBER_COLUMNS = `
  m.id, m.first_name, m.last_name, m.gender, m.birth_date, m.address,
  m.phone_num, m.alt_phone, m.main_church, m.mentor_id, m.ministry,
  m.member_status, m.connection_status, m.assigned_to,
  m.added_at, m.updated_at, m.facebook, m.instagram, m.photo_key,
  mentor.first_name AS mentor_first_name, mentor.last_name AS mentor_last_name,
  connector.first_name AS connector_first_name, connector.last_name AS connector_last_name
`;

async function findById(memberId) {
  const result = await pool.query(
    `SELECT ${MEMBER_COLUMNS}
     FROM members m
     LEFT JOIN members mentor ON m.mentor_id = mentor.id
     LEFT JOIN members connector ON m.assigned_to = connector.id
     WHERE m.id = $1`,
    [memberId]
  );
  return result.rows[0] || null;
}

async function findAll({ search, role, gender, connectionStatus, hasAssigned, addedYear, addedMonth, sort, page = 1, limit = 10 } = {}) {
  const conditions = [];
  const values = [];
  let i = 1;

  if (search) {
    conditions.push(
      `((m.first_name || ' ' || m.last_name) ILIKE $${i}
        OR m.phone_num ILIKE $${i}
        OR m.main_church ILIKE $${i}
        OR (mentor.first_name || ' ' || mentor.last_name) ILIKE $${i})`
    );
    values.push(`%${search}%`);
    i++;
  }

  if (role) {
    // role tokens: plain member_status values ("mentor", "mentee", "potential mentor"),
    // plus the virtual token "hybrid" meaning: a mentor who also has their own mentor_id set
    // (i.e. shows up as "Mentee/Mentor" on the Mentees tab).
    const roles = role.split(",").map((r) => r.trim());
    const isHybrid = roles.includes("hybrid");
    const plainRoles = roles.filter((r) => r !== "hybrid");

    const roleConditions = [];
    if (plainRoles.length > 0) {
      roleConditions.push(`m.member_status = ANY($${i}::text[])`);
      values.push(plainRoles);
      i++;
    }
    if (isHybrid) {
      roleConditions.push(`(m.member_status = 'mentor' AND m.mentor_id IS NOT NULL)`);
    }
    if (roleConditions.length > 0) {
      conditions.push(`(${roleConditions.join(" OR ")})`);
    }
  }

  if (gender) {
    conditions.push(`LOWER(m.gender) = LOWER($${i})`);
    values.push(gender);
    i++;
}

  if (connectionStatus) {
    // "any" = has ANY connection_status set (pending/assigned/removed) — as opposed
    // to NULL, meaning never entered the pipeline. "active" = still actively in the
    // pipeline (pending or assigned only) — excludes NULL and 'removed'. This is what
    // Connect now uses since pending/assigned aren't separate tabs anymore.
    if (connectionStatus === "any") {
      conditions.push(`m.connection_status IS NOT NULL`);
    } else if (connectionStatus === "active") {
      conditions.push(`m.connection_status = ANY($${i}::text[])`);
      values.push(["pending", "assigned"]);
      i++;
    } else {
      conditions.push(`m.connection_status = $${i}`);
      values.push(connectionStatus);
      i++;
    }
  }

  if (hasAssigned === "true") {
    conditions.push(`m.assigned_to IS NOT NULL`);
  } else if (hasAssigned === "false") {
    conditions.push(`m.assigned_to IS NULL`);
  }

    if (addedYear) {
    conditions.push(`EXTRACT(YEAR FROM m.added_at) = $${i}`);
    values.push(addedYear);
    i++;
  }

  if (addedMonth) {
    conditions.push(`EXTRACT(MONTH FROM m.added_at) = $${i}`);
    values.push(addedMonth);
    i++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  // sort presets — default (status-priority) is what careGroup's Mentors tab still
  // implicitly relies on; the other two are explicit opt-ins from specific pages
  const ORDER_CLAUSES = {
    no_mentor_first_updated: `(m.mentor_id IS NOT NULL) ASC, m.updated_at DESC, m.last_name ASC, m.first_name ASC`,
    no_assigned_first_added: `(m.assigned_to IS NOT NULL) ASC, m.added_at ASC, m.last_name ASC, m.first_name ASC`,
  };
  const defaultOrderClause = `
       (m.mentor_id IS NOT NULL) ASC,
       CASE
         WHEN m.member_status = 'potential mentor' THEN 0
         WHEN m.member_status = 'mentee' THEN 1
         WHEN m.member_status = 'mentor' AND m.mentor_id IS NOT NULL THEN 2
         ELSE 3
       END,
       m.last_name ASC, m.first_name ASC`;
  const orderClause = ORDER_CLAUSES[sort] || defaultOrderClause;

  const rowsResult = await pool.query(
    `SELECT ${MEMBER_COLUMNS},
            COUNT(mentee.id) AS mentee_count,
            COALESCE(
              array_agg(mentee.first_name || ' ' || mentee.last_name ORDER BY mentee.last_name, mentee.first_name)
                FILTER (WHERE mentee.id IS NOT NULL),
              '{}'
            ) AS mentee_names,
            -- same mentees as objects, so the tooltip can color each by member_status
            COALESCE(
              json_agg(
                json_build_object('id', mentee.id, 'name', mentee.first_name || ' ' || mentee.last_name, 'member_status', mentee.member_status)
                ORDER BY mentee.last_name, mentee.first_name
              ) FILTER (WHERE mentee.id IS NOT NULL),
              '[]'::json
            ) AS mentee_list
     FROM members m
     LEFT JOIN members mentor ON m.mentor_id = mentor.id
     LEFT JOIN members mentee ON mentee.mentor_id = m.id
     LEFT JOIN members connector ON m.assigned_to = connector.id
     ${whereClause}
     GROUP BY m.id, mentor.first_name, mentor.last_name, connector.first_name, connector.last_name
     ORDER BY ${orderClause}
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM members m
     LEFT JOIN members mentor ON m.mentor_id = mentor.id
     ${whereClause}`,
    values
  );

  return { rows: rowsResult.rows, total: parseInt(countResult.rows[0].count, 10) };
}

async function create(fields) {
  const {
    first_name, last_name, gender, birth_date, address,
    phone_num, alt_phone, main_church, ministry,
    member_status, connection_status, facebook, instagram, added_at,
  } = fields;

  const result = await pool.query(
    `INSERT INTO members
      (first_name, last_name, gender, birth_date, address, phone_num,
       alt_phone, main_church, ministry, member_status, connection_status, facebook, instagram, added_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
             COALESCE($14::date, (NOW() AT TIME ZONE 'Asia/Manila')::date))
     RETURNING id, first_name, last_name, member_status, connection_status, assigned_to, added_at`,
    [first_name, last_name, gender || null, birth_date || null, address || null,
     phone_num || null, alt_phone || null, main_church || null, ministry || null,
     member_status || null, connection_status || null, facebook || null, instagram || null,
     added_at || null]
  );
  return result.rows[0];
}

// update member; empty added_at keeps the existing value, updated_at uses PH today
async function updateById(memberId, fields) {
  const {
    first_name, last_name, gender, birth_date, address,
    phone_num, alt_phone, main_church, ministry, facebook, instagram, added_at,
  } = fields;

  const result = await pool.query(
    `UPDATE members
     SET first_name = $1, last_name = $2, gender = $3, birth_date = $4,
         address = $5, phone_num = $6, alt_phone = $7, main_church = $8,
         ministry = $9, facebook = $10, instagram = $11,
         added_at = COALESCE($12::date, added_at),
         updated_at = (NOW() AT TIME ZONE 'Asia/Manila')::date
     WHERE id = $13
     RETURNING id, first_name, last_name, member_status, connection_status, updated_at, added_at`,
    [first_name, last_name, gender || null, birth_date || null, address || null, phone_num || null,
     alt_phone || null, main_church || null, ministry || null, facebook || null, instagram || null,
     added_at || null, memberId]
  );
  return result.rows[0];
}

async function setMemberStatus(memberId, memberStatus) {
  // when removing someone, clear their own mentor_id too — a removed member
  // shouldn't still count toward their old mentor's mentee_count/mentee_names.
  // connection_status goes to NULL, not 'removed' — 'removed' means an active mentor
  // connection was explicitly unassigned (see unassignMentor); a deleted member never had
  // that happen to them, they just no longer have a connection at all.
  const clearOwnMentor = memberStatus === "removed";

  const result = await pool.query(
    `UPDATE members
     SET member_status = $1,
         mentor_id = CASE WHEN $3 THEN NULL ELSE mentor_id END,
         connection_status = CASE WHEN $3 THEN NULL ELSE connection_status END,
         updated_at = CURRENT_DATE
     WHERE id = $2
     RETURNING id, first_name, last_name, member_status, mentor_id, connection_status`,
    [memberStatus, memberId, clearOwnMentor]
  );
  return result.rows[0];
}

// pure careGroup mentor assignment — does NOT touch connection_status.
// Use for (re)assigning a mentor to someone already in a care group.
// First-time Connect -> careGroup transitions go through joinCareGroup() instead.
async function assignMentor(menteeId, mentorId) {
  const result = await pool.query(
    `UPDATE members
     SET mentor_id = $1, updated_at = CURRENT_DATE
     WHERE id = $2
     RETURNING id, first_name, last_name, mentor_id, connection_status`,
    [mentorId, menteeId]
  );
  return result.rows[0];
}

async function unassignMentor(menteeId) {
  const result = await pool.query(
    `UPDATE members
     SET mentor_id = NULL, updated_at = CURRENT_DATE
     WHERE id = $1
     RETURNING id, first_name, last_name, mentor_id, connection_status`,
    [menteeId]
  );
  return result.rows[0];
}

// Connect -> careGroup transition: assigns the official mentor AND closes out
// the Connect pipeline in one shot (connection_status/assigned_to cleared).
async function joinCareGroup(menteeId, mentorId) {
  const result = await pool.query(
    `UPDATE members
     SET mentor_id = $1, member_status = 'mentee', connection_status = NULL, assigned_to = NULL, updated_at = CURRENT_DATE
     WHERE id = $2
     RETURNING id, first_name, last_name, member_status, mentor_id, connection_status, assigned_to`,
    [mentorId, menteeId]
  );
  return result.rows[0];
}

// assigns a Connect-ministry connector (follow-up volunteer) — independent of mentor_id
async function assignConnector(memberId, connectorId) {
  const result = await pool.query(
    `UPDATE members
     SET assigned_to = $1, connection_status = 'assigned', updated_at = CURRENT_DATE
     WHERE id = $2
     RETURNING id, first_name, last_name, assigned_to, connection_status`,
    [connectorId, memberId]
  );
  return result.rows[0];
}

// kicks a member back to the pending queue, unassigned from their connector
async function unassignConnector(memberId) {
  const result = await pool.query(
    `UPDATE members
     SET assigned_to = NULL, connection_status = 'pending', updated_at = CURRENT_DATE
     WHERE id = $1
     RETURNING id, first_name, last_name, assigned_to, connection_status`,
    [memberId]
  );
  return result.rows[0];
}

// drops someone from the Connect pipeline entirely (didn't continue)
async function markConnectionRemoved(memberId) {
  const result = await pool.query(
    `UPDATE members
     SET assigned_to = NULL, connection_status = 'removed', updated_at = CURRENT_DATE
     WHERE id = $1
     RETURNING id, first_name, last_name, assigned_to, connection_status`,
    [memberId]
  );
  return result.rows[0];
}

async function findPhoneConflict(phone, altPhone, excludeMemberId = null) {
  const values = [phone, altPhone || null];
  let query = `
    SELECT id, phone_num, alt_phone FROM members
    WHERE (phone_num = $1 OR alt_phone = $1 OR ($2::text IS NOT NULL AND (phone_num = $2 OR alt_phone = $2)))
  `;
  if (excludeMemberId) {
    values.push(excludeMemberId);
    query += ` AND id != $3`;
  }
  const result = await pool.query(query, values);
  return result.rows;
}

// the most-used existing spelling of a church, matched ignoring case and outer spaces; null if it's new
async function findCanonicalChurch(church) {
  const result = await pool.query(
    `SELECT main_church FROM members
     WHERE LOWER(TRIM(main_church)) = LOWER(TRIM($1))
     GROUP BY main_church
     ORDER BY COUNT(*) DESC, main_church
     LIMIT 1`,
    [church]
  );
  return result.rows[0]?.main_church.trim() || null;
}

// distinct churches, grouped ignoring case/spaces; most-used spelling represents each group, most-used church first
async function findChurches() {
  const result = await pool.query(
    `SELECT TRIM(church) AS church FROM (
       SELECT main_church AS church,
              ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(main_church)) ORDER BY COUNT(*) DESC, main_church) AS rn,
              SUM(COUNT(*)) OVER (PARTITION BY LOWER(TRIM(main_church))) AS total
       FROM members
       WHERE main_church IS NOT NULL AND TRIM(main_church) <> ''
       GROUP BY main_church
     ) t
     WHERE rn = 1
     ORDER BY total DESC, church ASC
     LIMIT 200`
  );
  return result.rows.map((r) => r.church);
}

// partial name match on the member's OWN full name; excludeId skips the record being edited
async function findNameMatches(term, excludeId = null) {
  const escaped = term.replace(/[\\%_]/g, "\\$&"); // escape LIKE wildcards typed by the user
  const result = await pool.query(
    `SELECT ${MEMBER_COLUMNS}
     FROM members m
     LEFT JOIN members mentor ON m.mentor_id = mentor.id
     LEFT JOIN members connector ON m.assigned_to = connector.id
     WHERE (m.first_name || ' ' || m.last_name) ILIKE $1
       AND ($3::bigint IS NULL OR m.id != $3)
     ORDER BY (LOWER(m.first_name || ' ' || m.last_name) = LOWER($2)) DESC, m.added_at DESC
     LIMIT 3`, // cap the warning list at 3; exact matches sort first so they're never cut
    [`%${escaped}%`, term, excludeId]
  );
  return result.rows;
}

// exact first+last match (trim + case-insensitive, any status); excludeId skips the record being edited
async function findExactNameMatch(firstName, lastName, excludeId = null) {
  const result = await pool.query(
    `SELECT id FROM members
     WHERE LOWER(TRIM(first_name)) = LOWER($1) AND LOWER(TRIM(last_name)) = LOWER($2)
       AND ($3::bigint IS NULL OR id != $3)
     LIMIT 1`,
    [firstName, lastName, excludeId]
  );
  return result.rows[0] || null;
}

// sets or clears (null) the member's R2 photo key; updated_at is left alone so list sorting doesn't shift
async function updatePhotoKey(memberId, photoKey) {
  const result = await pool.query(
    `UPDATE members SET photo_key = $1 WHERE id = $2
     RETURNING id, first_name, last_name, photo_key`,
    [photoKey, memberId]
  );
  return result.rows[0];
}

// bulk-unassigns everyone under this mentor — used when demoting a mentor away from "mentor" status
async function unassignAllMenteesOfMentor(mentorId) {
  const result = await pool.query(
    `UPDATE members
     SET mentor_id = NULL, updated_at = CURRENT_DATE
     WHERE mentor_id = $1
     RETURNING id`,
    [mentorId]
  );
  return result.rows;
}

module.exports = {
  findById,
  findAll,
  create,
  updateById,
  setMemberStatus,
  assignMentor,
  unassignMentor,
  joinCareGroup,
  assignConnector,
  unassignConnector,
  markConnectionRemoved,
  unassignAllMenteesOfMentor,
  findPhoneConflict,
  findNameMatches,
  findExactNameMatch,
  findChurches,
  findCanonicalChurch,
  updatePhotoKey,
};