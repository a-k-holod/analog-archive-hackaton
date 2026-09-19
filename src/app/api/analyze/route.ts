import { analyzeRoll } from "@/lib/analyzeRoll";
import type { AnalyzePayload } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body: unknown = await request.json();

  if (!isAnalyzePayload(body)) {
    return NextResponse.json({ error: "Invalid roll payload." }, { status: 400 });
  }

  const analysis = analyzeRoll(body);
  return NextResponse.json(analysis);
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
