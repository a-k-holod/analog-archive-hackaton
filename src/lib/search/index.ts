export type {
  ArchiveObjectKind,
  EmbeddingModelInfo,
  EmbeddingProviderStatus,
  FrameEmbeddingRecord,
  FrameIndexIdentity,
  FrameSearchDocument,
  MetadataMatchField,
  SearchHit,
  SearchIndexMeta,
  SearchMatchKind,
  SearchQuery,
} from "./types.ts";

export {
  buildFrameIndexIdentity,
  collectIndexableFrames,
  frameContentKey,
  hashContentString,
} from "./indexIdentity.ts";

export {
  decideIndexingAction,
  planIncrementalIndexing,
  type IndexingDecision,
  type StoredIndexCursor,
} from "./incremental.ts";

export { normalizeSearchText, textIncludes, tokenizeQuery } from "./normalize.ts";

export {
  documentsFromRolls,
  formatSearchHitSummary,
  groupSearchHitsByKind,
  METADATA_FIELD_WEIGHTS,
  noteHitKey,
  noteSearchFields,
  photographHitKey,
  rollHitKey,
  searchMetadata,
  summarizeSearchHits,
  type GroupedSearchHits,
  type SearchHitSummary,
} from "./textSearch.ts";

export { mergeSearchHits, normalizeScores, withNormalizedScores } from "./ranking.ts";

export {
  cosineSimilarity,
  rankByCosineSimilarity,
  type SemanticCandidate,
  type SemanticRankedHit,
} from "./semanticRanking.ts";

export {
  INTENDED_CLIP_MODEL,
  type EmbeddingProvider,
} from "./embeddingProvider.ts";

export {
  createDefaultEmbeddingProvider,
  DeferredEmbeddingProvider,
} from "./deferredEmbeddingProvider.ts";

export { searchArchive, type ArchiveSearchOptions } from "./searchArchive.ts";

export {
  draftQueryForUrlChange,
  noteResultHref,
  resolvePhotographOpenTarget,
  resultActivationRequiresStableForm,
  rollResultHref,
  searchQueryNeedsUrlCommit,
  type PhotographOpenTarget,
} from "./searchInteraction.ts";
