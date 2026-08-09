const { Pool } = require("pg");
require("dotenv").config();

const masked = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@");
console.log("DATABASE_URL:", masked);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
module.exports = pool;