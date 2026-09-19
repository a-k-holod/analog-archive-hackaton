#!/usr/bin/env node
/**
 * Applies Analog Archive SQL migrations via psql.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" \
 *     node scripts/apply-migrations.mjs
 *
 * Apply a single file (preferred when older migrations may already be applied):
 *   DATABASE_URL="..." node scripts/apply-migrations.mjs --only 20260919150000_notes_ocr_text.sql
 *
 * Or set SUPABASE_DB_PASSWORD in .env.local (with NEXT_PUBLIC_SUPABASE_URL).
 *
 * Passwords with @, &, etc. are fine — this script percent-encodes them and
 * prefers the direct db.*.supabase.co:5432 host for DDL (not the pooler).
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
const onlyArgIndex = process.argv.indexOf("--only");
const onlyFile =
  onlyArgIndex !== -1 ? process.argv[onlyArgIndex + 1]?.trim() : null;

const files = onlyFile
  ? [onlyFile]
  : readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

for (const file of files) {
  const sqlPath = resolve(migrationsDir, file);
  if (!existsSync(sqlPath)) {
    console.error(`FAIL — migration not found: ${file}`);
    process.exit(1);
  }

  console.log(`Applying ${file}…`);
  const result = runPsql(databaseUrl, sqlPath);

  if (result.status !== 0) {
    console.error(sanitizeSecrets(result.stderr || result.stdout || ""));
    console.error(`FAIL — ${file}`);
    process.exit(result.status ?? 1);
  }

  console.log(`OK — ${file}`);
}

console.log("OK — all requested migrations applied.");

function runPsql(databaseUrl, sqlPath) {
  const parts = parseDatabaseUrl(databaseUrl);
  if (!parts) {
    return spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
      encoding: "utf8",
    });
  }

  // Prefer discrete params + PGPASSWORD so special characters in the
  // password never depend on URI percent-encoding.
  return spawnSync(
    "psql",
    [
      "-h",
      parts.host,
      "-p",
      parts.port,
      "-U",
      parts.user,
      "-d",
      parts.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      sqlPath,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PGPASSWORD: parts.password,
        PGSSLMODE: "require",
      },
    },
  );
}

function parseDatabaseUrl(url) {
  const match = url.match(
    /^(postgres(?:ql)?):\/\/([^:/?#]+):(.+)@([^:/?#]+):(\d+)(\/[^?]*)?/i,
  );
  if (!match) {
    return null;
  }
  return {
    user: decodeURIComponent(match[2]),
    password: decodeURIComponent(match[3]),
    host: match[4],
    port: match[5],
    database: (match[6] || "/postgres").replace(/^\//, "") || "postgres",
  };
}
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return normalizeDatabaseUrl(stripQuotes(process.env.DATABASE_URL.trim()));
  }

  const password = stripQuotes(process.env.SUPABASE_DB_PASSWORD?.trim() ?? "");
  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "");
  if (!password || !url) {
    return null;
  }

  const host = new URL(url).hostname;
  const projectRef = host.split(".")[0];
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

/**
 * Rebuild the URI with an encoded password.
 * Uses the last "@" as the credentials/host separator so passwords may contain "@".
 *
 * Keeps Supabase pooler hosts as-is (often reachable when direct db.* is IPv6-only).
 * For pooler transaction URLs (`?pgbouncer`), prefer session port 5432 when present
 * as `:6543` so DDL/migrations are reliable.
 */
function normalizeDatabaseUrl(raw) {
  const value = stripQuotes(raw.trim());
  const match = value.match(
    /^(postgres(?:ql)?):\/\/([^:/?#]+):(.+)@([^/?#]+)([/?#].*)?$/i,
  );
  if (!match) {
    return value;
  }

  const scheme = match[1].toLowerCase() === "postgres" ? "postgresql" : match[1];
  const user = match[2];
  const password = match[3];
  let hostPort = match[4];
  let rest = match[5] ?? "/postgres";

  // Drop query flags like ?pgbouncer[=true]; encode password instead.
  if (rest.includes("?")) {
    rest = rest.slice(0, rest.indexOf("?")) || "/postgres";
  }
  if (!rest.startsWith("/")) {
    rest = `/${rest}`;
  }

  // Prefer pooler session mode (5432) over transaction mode (6543) for DDL.
  if (hostPort.includes("pooler.supabase.com") && hostPort.endsWith(":6543")) {
    hostPort = `${hostPort.slice(0, -5)}:5432`;
  }

  return `${scheme}://${user}:${encodeURIComponent(password)}@${hostPort}${rest}`;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function sanitizeSecrets(text) {
  return text.replace(/postgresql:\/\/[^\s]+/gi, "postgresql://***");
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
    const value = stripQuotes(trimmed.slice(eq + 1).trim());
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}
