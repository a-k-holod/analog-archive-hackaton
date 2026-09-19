import type { FrameIndexIdentity } from "./types.ts";

/** Minimal stored index row used to decide whether reindexing is needed. */
export type StoredIndexCursor = {
  frameId: string;
  contentKey: string;
  modelId: string;
};

export type IndexingDecision =
  | { action: "skip"; reason: "already-current" }
  | { action: "index"; reason: "new" | "content-changed" | "model-changed" }
  | { action: "remove"; reason: "no-longer-indexable" | "orphaned" };

/**
 * Decide whether a candidate frame needs (re)indexing given what is already stored.
 * Never silently reuse an embedding when contentKey or modelId differs.
 */
export function decideIndexingAction(
  candidate: FrameIndexIdentity | null,
  stored: StoredIndexCursor | null,
): IndexingDecision {
  if (!candidate) {
    if (stored) {
      return { action: "remove", reason: "no-longer-indexable" };
    }
    return { action: "skip", reason: "already-current" };
  }

  if (!stored) {
    return { action: "index", reason: "new" };
  }

  if (stored.frameId !== candidate.frameId) {
    return { action: "index", reason: "new" };
  }

  if (stored.modelId !== candidate.modelId) {
    return { action: "index", reason: "model-changed" };
  }

  if (stored.contentKey !== candidate.contentKey) {
    return { action: "index", reason: "content-changed" };
  }

  return { action: "skip", reason: "already-current" };
}

/**
 * Incremental plan: only frames that are new or changed, plus orphans to drop.
 * Opening search must not reprocess every photograph.
 */
export function planIncrementalIndexing(
  candidates: FrameIndexIdentity[],
  stored: StoredIndexCursor[],
): {
  toIndex: FrameIndexIdentity[];
  toRemove: string[];
} {
  const storedByFrame = new Map(stored.map((row) => [row.frameId, row]));
  const candidateIds = new Set(candidates.map((c) => c.frameId));
  const toIndex: FrameIndexIdentity[] = [];
  const toRemove: string[] = [];

  for (const candidate of candidates) {
    const decision = decideIndexingAction(candidate, storedByFrame.get(candidate.frameId) ?? null);
    if (decision.action === "index") {
      toIndex.push(candidate);
    }
  }

  for (const row of stored) {
    if (!candidateIds.has(row.frameId)) {
      toRemove.push(row.frameId);
    } else {
      const candidate = candidates.find((c) => c.frameId === row.frameId) ?? null;
      const decision = decideIndexingAction(candidate, row);
      if (decision.action === "remove") {
        toRemove.push(row.frameId);
      }
    }
  }

  return { toIndex, toRemove };
}
