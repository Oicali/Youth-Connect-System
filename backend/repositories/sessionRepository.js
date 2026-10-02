// backend/repositories/sessionRepository.js
const pool = require("../db");

// deletes all of a user's login sessions (forces re-login on every device)
async function deleteByUserId(userId) {
  await pool.query("DELETE FROM session WHERE sess->'user'->>'id' = $1", [userId]);
}

module.exports = { deleteByUserId };