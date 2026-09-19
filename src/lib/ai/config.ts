/**
 * Server-only AI analysis configuration.
 * Defaults keep vision analysis disabled unless explicitly enabled.
 * Never expose these via NEXT_PUBLIC_*.
 */

export type AiAnalysisConfig = {
  /** Global kill switch. Must be explicitly true to allow provider calls. */
  enabled: boolean;
  /** Maximum frames included in a single vision request. */
  maxFrames: number;
  /** Maximum bytes per prepared image submitted to a provider. */
  maxImageBytes: number;
  /**
   * Reserved daily global call cap for a future distributed rate limiter.
   * Read here so config is ready; enforcement lives behind RateLimiter.
   */
  dailyCallCap: number;
};

const DEFAULT_MAX_FRAMES = 36;
const DEFAULT_MAX_IMAGE_BYTES = 1_500_000;
const DEFAULT_DAILY_CALL_CAP = 50;

export function getAiAnalysisConfig(
  env: NodeJS.ProcessEnv = process.env,
): AiAnalysisConfig {
  return {
    enabled: parseEnabledFlag(env.AI_ANALYSIS_ENABLED),
    maxFrames: parsePositiveInt(env.AI_MAX_FRAMES, DEFAULT_MAX_FRAMES),
    maxImageBytes: parsePositiveInt(env.AI_MAX_IMAGE_BYTES, DEFAULT_MAX_IMAGE_BYTES),
    dailyCallCap: parsePositiveInt(env.AI_DAILY_CALL_CAP, DEFAULT_DAILY_CALL_CAP),
  };
}

/**
 * Only an explicit true/1 enables AI. Missing, empty, or ambiguous values stay off.
 */
function parseEnabledFlag(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") {
    return true;
  }
  return false;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
