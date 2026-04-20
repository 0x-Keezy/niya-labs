// One-shot helper to create the nyla_microstructure_cache table on the
// live DB. Equivalent to what `drizzle-kit push` would do for this single
// table — used because the interactive TUI of drizzle-kit doesn't accept
// piped stdin under bash.
//
// Run with:  cd Nyla && set -a && source .env.local && set +a && node scripts/nyla-tools-create-cache-table.mjs
//
// Idempotent: uses CREATE TABLE IF NOT EXISTS.

import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

const sql = `
CREATE TABLE IF NOT EXISTS nyla_microstructure_cache (
  ca varchar(42) PRIMARY KEY,
  data jsonb NOT NULL,
  computed_at timestamp NOT NULL DEFAULT now()
);
`;

try {
  await pool.query(sql);
  const r = await pool.query(
    "SELECT to_regclass('public.nyla_microstructure_cache') AS t",
  );
  console.log("Table status:", r.rows[0].t);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
