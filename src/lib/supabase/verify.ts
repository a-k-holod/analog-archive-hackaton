import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, hasConfiguredSupabaseEnv } from "@/lib/supabase/env";

export type SupabaseConnectionResult =
  | { ok: true; projectHost: string; message: string }
  | { ok: false; reason: "missing_env" | "placeholder_env" | "unreachable"; message: string };

export async function verifySupabaseConnection(): Promise<SupabaseConnectionResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    return {
      ok: false,
      reason: "missing_env",
      message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
    };
  }

  if (!hasConfiguredSupabaseEnv()) {
    return {
      ok: false,
      reason: "placeholder_env",
      message: "Replace the placeholders in .env.local with your Supabase project URL and publishable key.",
    };
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const projectHost = new URL(url).host;
  const supabase = createSupabaseClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.getSession();

  if (error) {
    return {
      ok: false,
      reason: "unreachable",
      message: `Could not reach Supabase (${projectHost}): ${error.message}`,
    };
  }

  return {
    ok: true,
    projectHost,
    message: `Connected to Supabase at ${projectHost}.`,
  };
}
