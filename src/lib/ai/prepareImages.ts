/**
 * Provider-neutral rate limiting surface for future AI insight calls.
 *
 * Intended scopes:
 * - ip: per-client request budget
 * - roll: per-roll regeneration budget
 * - global_daily: AI_DAILY_CALL_CAP across the deployment
 *
 * This module does NOT implement a distributed limiter. An in-memory stub
 * would be unsafe across Vercel instances — plug in Upstash (or similar) later.
 */

export type RateLimitScope = "ip" | "roll" | "global_daily";

export type RateLimitCheck = {
  scope: RateLimitScope;
  key: string;
  limit: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining?: number;
  reason?: string;
};

export type RateLimiter = {
  check(input: RateLimitCheck): Promise<RateLimitDecision>;
};

/**
 * No-op limiter used until a real distributed backend is connected.
 * Does not claim production safety; AI_ANALYSIS_ENABLED remains the kill switch.
 */
export function createNoopRateLimiter(): RateLimiter {
  return {
    async check() {
      return { allowed: true };
    },
  };
}
