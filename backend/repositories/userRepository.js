// backend\repositories\userRepository.js
const pool = require("../db");

async function findByUsername(username) {
  const result = await pool.query(
    `SELECT u.user_id, u.username, u.password, u.status,
            u.first_name, u.last_name, r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

async function findById(userId) {
  const result = await pool.query(
    `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name,
            u.middle_name, u.suffix, u.phone, u.alt_phone, u.gender,
            u.birthdate, u.profile_picture, u.status, u.created_at,
            r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateProfile(userId, fields) {
  const {
    first_name, last_name, middle_name, suffix,
    email, phone, alt_phone, gender, birthdate,
  } = fields;

  const result = await pool.query(
    `UPDATE users
     SET first_name = $1, last_name = $2, middle_name = $3, suffix = $4,
         email = $5, phone = $6, alt_phone = $7, gender = $8, birthdate = $9,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $10
     RETURNING user_id, username, email, first_name, last_name, middle_name,
               suffix, phone, alt_phone, gender, birthdate, status, created_at`,
    [first_name, last_name, middle_name, suffix, email, phone, alt_phone, gender, birthdate, userId]
  );
  return result.rows[0];
}

async function findPasswordById(userId) {
  const result = await pool.query(
    "SELECT password FROM users WHERE user_id = $1",
    [userId]
  );
  return result.rows[0]?.password || null;
}

async function updatePassword(userId, newHash) {
  await pool.query(
    "UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2",
    [newHash, userId]
  );
}

async function findAll({ search, role, status, page = 1, limit = 15 } = {}) {
  const conditions = [];
  const values = [];
  let i = 1;

  if (search) {
    conditions.push(
      `(u.username ILIKE $${i} OR u.email ILIKE $${i} OR u.first_name ILIKE $${i} OR u.last_name ILIKE $${i})`
    );
    values.push(`%${search}%`);
    i++;
  }
  if (role) {
    conditions.push(`r.role_name = $${i}`);
    values.push(role);
    i++;
  }
  if (status) {
    conditions.push(`u.status = $${i}`);
    values.push(status);
    i++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const rowsResult = await pool.query(
    `SELECT u.user_id, u.username, u.email, u.first_name, u.last_name,
            u.middle_name, u.suffix, u.phone, u.alt_phone, u.gender,
            u.birthdate, u.status, u.created_at, r.role_name, r.role_id
     FROM users u
     JOIN roles r ON u.role_id = r.role_id
     ${whereClause}
     ORDER BY u.status ASC, u.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.role_id ${whereClause}`,
    values
  );

  return { rows: rowsResult.rows, total: parseInt(countResult.rows[0].count, 10) };
}

async function create(fields) {
  const {
    username, password, email, first_name, last_name,
    middle_name, suffix, phone, alt_phone, gender, birthdate, role_id,
  } = fields;

  const result = await pool.query(
    `INSERT INTO users
      (username, password, email, first_name, last_name, middle_name, suffix,
       phone, alt_phone, gender, birthdate, role_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING user_id, username, email, first_name, last_name, status, created_at`,
    [username, password, email, first_name, last_name, middle_name || null, suffix || null,
     phone, alt_phone || null, gender, birthdate, role_id]
  );
  return result.rows[0];
}

async function updateById(userId, fields) {
  const {
    first_name, last_name, middle_name, suffix,
    email, phone, alt_phone, gender, birthdate, role_id,
  } = fields;

  const result = await pool.query(
    `UPDATE users
     SET first_name = $1, last_name = $2, middle_name = $3, suffix = $4,
         email = $5, phone = $6, alt_phone = $7, gender = $8, birthdate = $9,
         role_id = $10, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $11
     RETURNING user_id, username, email, first_name, last_name, status, created_at`,
    [first_name, last_name, middle_name, suffix, email, phone, alt_phone, gender, birthdate, role_id, userId]
  );
  return result.rows[0];
}

async function setStatus(userId, status) {
  const result = await pool.query(
    `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2
     RETURNING user_id, username, status`,
    [status, userId]
  );
  return result.rows[0];
}

async function findPhoneConflict(phone, altPhone, excludeUserId = null) {
  const values = [phone, altPhone || null];
  let query = `
    SELECT user_id, phone, alt_phone FROM users
    WHERE (phone = $1 OR alt_phone = $1 OR ($2::text IS NOT NULL AND (phone = $2 OR alt_phone = $2)))
  `;
  if (excludeUserId) {
    values.push(excludeUserId);
    query += ` AND user_id != $3`;
  }
  const result = await pool.query(query, values);
  return result.rows;
}

module.exports = {
  findByUsername,
  findById,
  updateProfile,
  findPasswordById,
  updatePassword,
  findAll,
  updateById,
  setStatus,
  create,
  findPhoneConflict,
};