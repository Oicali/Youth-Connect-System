// backend/repositories/passwordResetRepository.js
const pool = require("../db");

// inserts a hashed token; expiry uses DB time so app/DB clock differences don't matter
async function create({ userId, tokenHash, ttlMinutes }) {
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
    [userId, tokenHash, ttlMinutes]
  );
}

// removes a user's existing tokens so only the newest link works
async function deleteByUserId(userId) {
  await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
}

// validates AND uses the token in one statement; returns user_id or null
async function consume(tokenHash) {
  const result = await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return result.rows[0]?.user_id || null;
}

module.exports = { create, deleteByUserId, consume };