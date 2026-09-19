export type Frame = {
  id: string;
  number: number;
  imageUrl: string | null;
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
  createdAt: string;
};

export type Note = {
  id: string;
  body: string;
  /** Public URL of the original handwritten-note photograph, when captured. */
  imageUrl: string | null;
  /**
   * Derived local OCR of the handwritten photograph.
   * Never replaces the image; distinct from manually entered `body`.
   */
  ocrText: string;
  createdAt: string;
};

export type RollAnalysis = {
  generatedAt: string;
  summary: string;
  technicalRead: string;
  themes: string[];
  source: "local";
};

/** Where an insight claim comes from — keeps models from inventing certainty. */
export type EvidenceKind = "photograph" | "photographer" | "inferred";

export type EvidencedClaim = {
  text: string;
  kind: EvidenceKind;
  frameNumbers?: number[];
};

export type FrameSequence = {
  label: string;
  frameNumbers: number[];
  reading: EvidencedClaim;
};

export type FrameTag = {
  frameNumber: number;
  tags: string[];
  kind: EvidenceKind;
};

/**
 * Structured whole-roll vision analysis.
 * Separate from RollAnalysis (deterministic metadata summary).
 */
export type RollInsight = {
  version: 1;
  generatedAt: string;
  provider: string;
  model: string | null;
  contentHash: string;
  summary: EvidencedClaim;
  recurringSubjects: EvidencedClaim[];
  recurringThemes: EvidencedClaim[];
  sequences: FrameSequence[];
  frameTags: FrameTag[];
  technicalObservations: EvidencedClaim[];
  nonObviousObservations: EvidencedClaim[];
  uncertainties: string[];
};

/** Stable archive fields used to fingerprint a roll for insight caching. */
export type RollContentFingerprint = {
  rollId: string;
  title: string;
  filmStock: string;
  iso: string;
  camera: string;
  startedOn: string;
  frames: Array<{
    number: number;
    caption: string;
    location: string;
    aperture: string;
    shutterSpeed: string;
    imageUrl: string | null;
  }>;
  notes: string[];
};

export type FilmRoll = {
  id: string;
  title: string;
  filmStock: string;
  iso: string;
  camera: string;
  startedOn: string;
  createdAt: string;
  frames: Frame[];
  notes: Note[];
  contactSheetGeneratedAt: string | null;
  analysis: RollAnalysis | null;
};

export type ArchiveState = {
  rolls: FilmRoll[];
};

export type NewRollInput = {
  title: string;
  filmStock: string;
  iso: string;
  camera: string;
  startedOn: string;
};

export type NewFrameInput = {
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
  imageBlob: Blob | null;
};

export type NewNoteInput = {
  body: string;
  /** Original photograph of handwriting; uploaded as the archival artifact. */
  imageBlob: Blob | null;
};

export type AnalyzePayload = {
  title: string;
  filmStock: string;
  iso: string;
  camera: string;
  frames: Array<{
    number: number;
    caption: string;
    location: string;
    aperture: string;
    shutterSpeed: string;
    hasImage: boolean;
  }>;
  notes: string[];
};
