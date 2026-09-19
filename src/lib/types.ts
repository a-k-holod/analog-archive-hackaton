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
  createdAt: string;
};

export type RollAnalysis = {
  generatedAt: string;
  summary: string;
  technicalRead: string;
  themes: string[];
  source: "local";
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
