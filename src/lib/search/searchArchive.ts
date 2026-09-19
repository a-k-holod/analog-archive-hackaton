import type { FilmRoll } from "../types.ts";
import { createDefaultEmbeddingProvider } from "./deferredEmbeddingProvider.ts";
import type { EmbeddingProvider } from "./embeddingProvider.ts";
import { mergeSearchHits, withNormalizedScores } from "./ranking.ts";
import { rankByCosineSimilarity } from "./semanticRanking.ts";
import { photographHitKey, searchMetadata } from "./textSearch.ts";
import type { FrameEmbeddingRecord, SearchHit, SearchQuery } from "./types.ts";

export type ArchiveSearchOptions = {
  embeddingProvider?: EmbeddingProvider;
  /**
   * Device-local frame embeddings. When empty / provider unavailable,
   * only metadata search runs.
   */
  embeddings?: FrameEmbeddingRecord[];
};

/**
 * Hybrid archive search: always runs metadata; semantic layer runs only when
 * a ready provider and matching embeddings are present.
 */
export async function searchArchive(
  rolls: FilmRoll[],
  query: SearchQuery,
  options: ArchiveSearchOptions = {},
): Promise<SearchHit[]> {
  const limit = query.limit ?? 50;
  const metadataHits = searchMetadata(rolls, { ...query, limit });

  const provider = options.embeddingProvider ?? createDefaultEmbeddingProvider();
  const status = provider.getStatus();
  const embeddings = options.embeddings ?? [];

  if (status.state !== "ready" || embeddings.length === 0) {
    return withNormalizedScores(metadataHits).slice(0, limit);
  }

  let queryEmbedding: Float32Array;
  try {
    queryEmbedding = await provider.embedText(query.text);
  } catch {
    return withNormalizedScores(metadataHits).slice(0, limit);
  }

  const modelId = provider.modelId;
  const usable = embeddings.filter(
    (row) => row.modelId === modelId && row.embedding.length === queryEmbedding.length,
  );

  const ranked = rankByCosineSimilarity(
    queryEmbedding,
    usable.map((row) => ({ frameId: row.frameId, embedding: row.embedding })),
    { limit, minScore: 0.15 },
  );

  const docByFrame = new Map<string, FilmRoll["frames"][number] & { roll: FilmRoll }>();
  for (const roll of rolls) {
    for (const frame of roll.frames) {
      docByFrame.set(frame.id, { ...frame, roll });
    }
  }

  const semanticHits: SearchHit[] = [];
  for (const rankedHit of ranked) {
    const frame = docByFrame.get(rankedHit.frameId);
    if (!frame) {
      continue;
    }
    semanticHits.push({
      hitKey: photographHitKey(frame.id),
      objectKind: "photograph",
      rollId: frame.roll.id,
      rollTitle: frame.roll.title,
      frameId: frame.id,
      frameNumber: frame.number,
      frameCount: frame.roll.frames.length,
      imageUrl: frame.imageUrl,
      caption: frame.caption,
      location: frame.location,
      aperture: frame.aperture,
      shutterSpeed: frame.shutterSpeed,
      filmStock: frame.roll.filmStock,
      camera: frame.roll.camera,
      startedOn: frame.roll.startedOn,
      noteId: null,
      noteBody: "",
      noteOcrText: "",
      noteImageUrl: null,
      score: rankedHit.score,
      kinds: ["semantic"],
      matchedFields: [],
    });
  }

  const merged = mergeSearchHits([
    withNormalizedScores(metadataHits),
    withNormalizedScores(semanticHits),
  ]);

  return merged.slice(0, limit);
}
