import type { FilmRoll, RollInsight } from "@/lib/types";

/**
 * Prepared image bytes for a future vision provider call.
 * Server-side download, resize, and byte capping happen before this shape
 * is passed to VisionRollAnalyzer (see prepareFrameImages).
 */
export type PreparedImage = {
  mimeType: string;
  bytes: Uint8Array;
};

export type VisionFrameInput = {
  frameNumber: number;
  /** Null when the frame has no photograph or preparation failed/skipped. */
  image: PreparedImage | null;
};

export type VisionRollAnalyzeInput = {
  roll: FilmRoll;
  contentHash: string;
  frames: VisionFrameInput[];
};

/**
 * Provider-neutral whole-roll vision analyzer.
 * Implementations must not be selected by the browser.
 */
export type VisionRollAnalyzer = {
  analyzeRollWithVisionModel(input: VisionRollAnalyzeInput): Promise<RollInsight>;
};

/**
 * Factory for the configured vision provider.
 * Returns null while no provider is wired — callers must treat null as disabled.
 */
export function createVisionRollAnalyzer(): VisionRollAnalyzer | null {
  return null;
}
