/**
 * Local-first archive search domain.
 * Text/metadata search is always available; semantic vectors are optional
 * and device-local (IndexedDB), never sent to a third-party inference API.
 */

export type SearchMatchKind = "metadata" | "semantic";

/** Stable identity for a frame's visual embedding slot. */
export type FrameIndexIdentity = {
  frameId: string;
  rollId: string;
  /** Fingerprint of the photograph content (derived from image URL / content id). */
  contentKey: string;
  modelId: string;
};

/** Stored embedding row (device-local index). */
export type FrameEmbeddingRecord = {
  frameId: string;
  rollId: string;
  contentKey: string;
  modelId: string;
  dims: number;
  embedding: Float32Array;
  indexedAt: string;
};

export type EmbeddingModelInfo = {
  id: string;
  dims: number;
  label: string;
  /** Rough download size for UI copy, e.g. "~90 MB". */
  downloadHint?: string;
};

export type EmbeddingProviderStatus =
  | { state: "unavailable"; reason: string }
  | { state: "loading"; progress: number; message: string }
  | { state: "ready"; model: EmbeddingModelInfo }
  | { state: "error"; message: string };

export type MetadataMatchField =
  | "rollTitle"
  | "filmStock"
  | "camera"
  | "startedOn"
  | "caption"
  | "location"
  | "aperture"
  | "shutterSpeed"
  | "note"
  | "ocr";

/** Archive object represented by a search hit. */
export type ArchiveObjectKind = "photograph" | "roll" | "note";

export type FrameSearchDocument = {
  rollId: string;
  rollTitle: string;
  filmStock: string;
  camera: string;
  startedOn: string;
  frameId: string;
  frameNumber: number;
  imageUrl: string | null;
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
  /** Roll-level notes associated with this hit context. */
  notes: string[];
  /**
   * Frame-level OCR text when available.
   * Note handwriting OCR lives on Note.ocrText and is searched as note hits.
   */
  ocrText: string;
};

export type SearchHit = {
  /** Stable identity for merging metadata + semantic layers. */
  hitKey: string;
  objectKind: ArchiveObjectKind;
  rollId: string;
  rollTitle: string;
  /** Set for photograph hits; empty string otherwise. */
  frameId: string;
  frameNumber: number;
  /** Frame count on the parent roll (useful for roll result copy). */
  frameCount: number;
  imageUrl: string | null;
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
  filmStock: string;
  camera: string;
  startedOn: string;
  /** Set for note hits. */
  noteId: string | null;
  noteBody: string;
  /** Derived OCR text for note hits (distinct from manually entered body). */
  noteOcrText: string;
  noteImageUrl: string | null;
  score: number;
  kinds: SearchMatchKind[];
  matchedFields: MetadataMatchField[];
};

export type SearchQuery = {
  text: string;
  /** Soft cap on returned hits. */
  limit?: number;
};

export type SearchIndexMeta = {
  /** Distinguishes device-local visual index from Supabase archive data. */
  scope: "device-local";
  modelId: string | null;
  indexedFrameCount: number;
  updatedAt: string | null;
};
