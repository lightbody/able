// Small custom migration runner: applies backend/migrations/*.sql files in
// filename order, tracked in a `_migrations` table.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const { rows } = await pool.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
    if (rows.length > 0) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
