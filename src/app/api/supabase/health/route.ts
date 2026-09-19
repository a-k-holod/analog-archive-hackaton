import { verifySupabaseConnection } from "@/lib/supabase/verify";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await verifySupabaseConnection();
  const status = result.ok ? 200 : result.reason === "unreachable" ? 502 : 503;

  return NextResponse.json(result, { status });
}
