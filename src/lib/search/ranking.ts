import type { SearchHit, SearchMatchKind } from "./types.ts";

/** Clamp and map a raw score into [0, 1] given observed min/max. */
export function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) {
    return [];
  }

  let min = scores[0]!;
  let max = scores[0]!;
  for (const score of scores) {
    if (score < min) min = score;
    if (score > max) max = score;
  }

  if (max === min) {
    return scores.map(() => 1);
  }

  return scores.map((score) => (score - min) / (max - min));
}

export function withNormalizedScores(hits: SearchHit[]): SearchHit[] {
  const normalized = normalizeScores(hits.map((hit) => hit.score));
  return hits.map((hit, index) => ({
    ...hit,
    score: normalized[index]!,
  }));
}

/**
 * Merge metadata and semantic hits for the same archive object.
 * Prefers higher score; unions kinds and matched fields.
 */
export function mergeSearchHits(groups: SearchHit[][]): SearchHit[] {
  const byKey = new Map<string, SearchHit>();

  for (const group of groups) {
    for (const hit of group) {
      const existing = byKey.get(hit.hitKey);
      if (!existing) {
        byKey.set(hit.hitKey, {
          ...hit,
          kinds: [...hit.kinds],
          matchedFields: [...hit.matchedFields],
        });
        continue;
      }

      const kinds = unionKinds(existing.kinds, hit.kinds);
      const matchedFields = [...new Set([...existing.matchedFields, ...hit.matchedFields])];
      byKey.set(hit.hitKey, {
        ...existing,
        score: Math.max(existing.score, hit.score),
        kinds,
        matchedFields,
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.score - a.score || a.frameNumber - b.frameNumber,
  );
}

function unionKinds(a: SearchMatchKind[], b: SearchMatchKind[]): SearchMatchKind[] {
  const set = new Set<SearchMatchKind>([...a, ...b]);
  const order: SearchMatchKind[] = ["metadata", "semantic"];
  return order.filter((kind) => set.has(kind));
}
