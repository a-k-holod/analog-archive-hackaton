import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

if (!url || !key) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

if (isPlaceholder(url) || isPlaceholder(key)) {
  fail(
    "Placeholders detected in .env.local. Set real values from Supabase → Project Settings → API, then re-run.",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: sessionError } = await supabase.auth.getSession();

if (sessionError) {
  fail(`Could not reach Supabase: ${sessionError.message}`);
}

const { error: notesError } = await supabase
  .from("notes")
  .select("id, text, image_url, ocr_text")
  .limit(1);

if (notesError) {
  if (/ocr_text/i.test(notesError.message)) {
    fail(
      `notes.ocr_text is missing. Apply supabase/migrations/20260919150000_notes_ocr_text.sql (DATABASE_URL=... npm run db:migrate -- --only 20260919150000_notes_ocr_text.sql).`,
    );
  }
  fail(`notes schema check failed: ${notesError.message}`);
}

console.log(`OK — connected to ${new URL(url).host}; notes.ocr_text present`);

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

function isPlaceholder(value) {
  return (
    value.includes("your_supabase") ||
    value === "supabase_project_url" ||
    value === "supabase_publishable_key"
  );
}

function fail(message) {
  console.error(`FAIL — ${message}`);
  process.exit(1);
}
