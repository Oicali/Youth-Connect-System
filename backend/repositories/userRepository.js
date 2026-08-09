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
               suffix, phone, alt_phone, gender, birthdate, status`,
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

module.exports = {
  findByUsername,
  findById,
  updateProfile,
  findPasswordById,
  updatePassword,
};