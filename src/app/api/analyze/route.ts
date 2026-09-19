import { analyzeRoll } from "@/lib/analyzeRoll";
import { resolveRollInsight } from "@/lib/ai/resolveRollInsight";
import { createClient } from "@/lib/supabase/server";
import type { AnalyzePayload } from "@/lib/types";
import { NextResponse } from "next/server";

/**
 * POST /api/analyze
 *
 * Two request shapes:
 * 1. Legacy AnalyzePayload → local deterministic RollAnalysis (existing UI).
 * 2. { rollId } → server-owned insight resolution (cache / disabled; no vendor).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (isRollIdRequest(body)) {
    return handleInsightRequest(body.rollId);
  }

  if (isAnalyzePayload(body)) {
    const analysis = analyzeRoll(body);
    return NextResponse.json(analysis);
  }

  return NextResponse.json(
    { error: "Expected AnalyzePayload or { rollId }." },
    { status: 400 },
  );
}

async function handleInsightRequest(rollId: string) {
  const supabase = await createClient();
  const result = await resolveRollInsight(rollId, { supabase });

  if ("error" in result) {
    if (result.error === "invalid_id") {
      return NextResponse.json({ error: "Invalid rollId." }, { status: 400 });
    }
    return NextResponse.json({ error: "Roll not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}

function isRollIdRequest(value: unknown): value is { rollId: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  // Prefer explicit rollId-only requests; do not treat AnalyzePayload as insight.
  return (
    typeof payload.rollId === "string" &&
    payload.title === undefined &&
    payload.frames === undefined
  );
}

function isAnalyzePayload(value: unknown): value is AnalyzePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<AnalyzePayload>;
  return (
    typeof payload.title === "string" &&
    typeof payload.filmStock === "string" &&
    typeof payload.iso === "string" &&
    typeof payload.camera === "string" &&
    Array.isArray(payload.frames) &&
    Array.isArray(payload.notes)
  );
}
