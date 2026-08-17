const { Pool, types } = require("pg");
require("dotenv").config();

types.setTypeParser(1082, (val) => val); // 1082 = Postgres DATE oid — keep as raw "yyyy-MM-dd" string, not a JS Date

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
module.exports = pool;