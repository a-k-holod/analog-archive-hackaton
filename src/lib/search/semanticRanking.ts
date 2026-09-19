/**
 * Cosine similarity and semantic ranking helpers.
 * Pure math — no model dependency. Used once local embeddings exist.
 */

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type SemanticCandidate = {
  frameId: string;
  embedding: ArrayLike<number>;
};

export type SemanticRankedHit = {
  frameId: string;
  score: number;
};

/**
 * Rank candidates by cosine similarity to a query embedding.
 * Drops scores at or below `minScore` (default 0 — keep all non-negative).
 */
export function rankByCosineSimilarity(
  query: ArrayLike<number>,
  candidates: SemanticCandidate[],
  options: { limit?: number; minScore?: number } = {},
): SemanticRankedHit[] {
  const limit = options.limit ?? 50;
  const minScore = options.minScore ?? 0;

  const ranked: SemanticRankedHit[] = [];

  for (const candidate of candidates) {
    const score = cosineSimilarity(query, candidate.embedding);
    if (score > minScore) {
      ranked.push({ frameId: candidate.frameId, score });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
