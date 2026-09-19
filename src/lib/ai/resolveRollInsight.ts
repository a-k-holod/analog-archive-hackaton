import { getAiAnalysisConfig } from "@/lib/ai/config";
import { hashRoll } from "@/lib/ai/contentHash";
import { findLatestInsightMatchingContentHash } from "@/lib/ai/insightsStore";
import { loadRollById } from "@/lib/ai/loadRoll";
import { createNoopRateLimiter, type RateLimiter } from "@/lib/ai/rateLimit";
import { createVisionRollAnalyzer } from "@/lib/ai/visionAnalyzer";
import { analyzeRoll } from "@/lib/analyzeRoll";
import type { AnalyzePayload, FilmRoll, RollAnalysis, RollInsight } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RollInsightStatus = "cached" | "disabled";

export type ResolveRollInsightResult = {
  status: RollInsightStatus;
  rollId: string;
  contentHash: string;
  insight: RollInsight | null;
  /** Local metadata analysis — never written to roll_insights. */
  localAnalysis: RollAnalysis;
  reason?: string;
};

export type ResolveRollInsightDeps = {
  supabase: SupabaseClient;
  rateLimiter?: RateLimiter;
  /**
   * Optional override for tests. Production uses createVisionRollAnalyzer().
   */
  getAnalyzer?: typeof createVisionRollAnalyzer;
};

/**
 * Server-owned whole-roll insight resolution.
 * Accepts only a rollId at the API boundary; loads archive state here.
 * Never calls a vendor when config/provider is disabled.
 *
 * Future provider path (not wired yet):
 * 1. prepareFrameImages({ roll, config }) — Storage download + AI_MAX_* caps
 * 2. analyzer.analyzeRollWithVisionModel({ roll, contentHash, frames })
 * 3. insertRollInsight(supabase, rollId, insight) — append-only history
 */
export async function resolveRollInsight(
  rollId: string,
  deps: ResolveRollInsightDeps,
): Promise<ResolveRollInsightResult | { error: "not_found" } | { error: "invalid_id" }> {
  if (!isUuid(rollId)) {
    return { error: "invalid_id" };
  }

  const roll = await loadRollById(deps.supabase, rollId);
  if (!roll) {
    return { error: "not_found" };
  }

  const contentHash = hashRoll(roll);
  const localAnalysis = analyzeRoll(rollToAnalyzePayload(roll));

  const cached = await findLatestInsightMatchingContentHash(
    deps.supabase,
    rollId,
    contentHash,
  );
  if (cached) {
    return {
      status: "cached",
      rollId,
      contentHash,
      insight: cached.insight,
      localAnalysis,
    };
  }

  const config = getAiAnalysisConfig();
  if (!config.enabled) {
    return {
      status: "disabled",
      rollId,
      contentHash,
      insight: null,
      localAnalysis,
      reason: "AI_ANALYSIS_ENABLED is not explicitly enabled.",
    };
  }

  const rateLimiter = deps.rateLimiter ?? createNoopRateLimiter();
  const daily = await rateLimiter.check({
    scope: "global_daily",
    key: "ai-insight",
    limit: config.dailyCallCap,
  });
  if (!daily.allowed) {
    return {
      status: "disabled",
      rollId,
      contentHash,
      insight: null,
      localAnalysis,
      reason: daily.reason ?? "Daily AI call cap reached.",
    };
  }

  const analyzer = (deps.getAnalyzer ?? createVisionRollAnalyzer)();
  if (!analyzer) {
    return {
      status: "disabled",
      rollId,
      contentHash,
      insight: null,
      localAnalysis,
      reason: "No vision provider is configured.",
    };
  }

  // A provider object may exist in tests, but this foundation phase never invokes it.
  void analyzer;
  return {
    status: "disabled",
    rollId,
    contentHash,
    insight: null,
    localAnalysis,
    reason: "Vision provider invocation is not enabled in this foundation phase.",
  };
}

export function rollToAnalyzePayload(roll: FilmRoll): AnalyzePayload {
  return {
    title: roll.title,
    filmStock: roll.filmStock,
    iso: roll.iso,
    camera: roll.camera,
    frames: roll.frames.map((frame) => ({
      number: frame.number,
      caption: frame.caption,
      location: frame.location,
      aperture: frame.aperture,
      shutterSpeed: frame.shutterSpeed,
      hasImage: Boolean(frame.imageUrl),
    })),
    notes: roll.notes.map((note) => note.body),
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
