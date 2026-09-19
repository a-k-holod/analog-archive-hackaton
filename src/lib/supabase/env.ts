export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }

  if (isPlaceholder(url) || isPlaceholder(publishableKey)) {
    throw new Error(
      "Supabase environment variables still use placeholders. Replace them with values from your Supabase project settings.",
    );
  }

  return { url, publishableKey };
}

export function hasConfiguredSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  return url.length > 0 && publishableKey.length > 0 && !isPlaceholder(url) && !isPlaceholder(publishableKey);
}

function isPlaceholder(value: string): boolean {
  return (
    value.includes("your_supabase") ||
    value === "supabase_project_url" ||
    value === "supabase_publishable_key"
  );
}
