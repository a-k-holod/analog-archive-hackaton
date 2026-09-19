#!/usr/bin/env node
/**
 * Applies Analog Archive SQL migrations via psql.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" \
 *     node scripts/apply-migrations.mjs
 *
 * Or set SUPABASE_DB_PASSWORD in .env.local (with NEXT_PUBLIC_SUPABASE_URL).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

loadEnvLocal();

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error(
    "FAIL — Set DATABASE_URL, or SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL, then re-run.",
  );
  process.exit(1);
}

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sqlPath = resolve(migrationsDir, file);
  console.log(`Applying ${file}…`);
  const result = spawnSync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    console.error(`FAIL — ${file}`);
    process.exit(result.status ?? 1);
  }

  console.log(`OK — ${file}`);
}

console.log("OK — all migrations applied.");

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!password || !url) {
    return null;
  }

  const host = new URL(url).hostname;
  const projectRef = host.split(".")[0];
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}
