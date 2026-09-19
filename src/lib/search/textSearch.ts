import { indexableNoteText } from "../notes.ts";
import type { FilmRoll, Note } from "../types.ts";
import { normalizeSearchText, textIncludes, tokenizeQuery } from "./normalize.ts";
import type {
  ArchiveObjectKind,
  FrameSearchDocument,
  MetadataMatchField,
  SearchHit,
  SearchQuery,
} from "./types.ts";

/** Field weights for metadata ranking (higher = more important). */
export const METADATA_FIELD_WEIGHTS: Record<MetadataMatchField, number> = {
  caption: 4,
  location: 3.5,
  rollTitle: 3,
  note: 2.5,
  filmStock: 2,
  camera: 2,
  ocr: 2,
  startedOn: 1.5,
  aperture: 1,
  shutterSpeed: 1,
};

export function photographHitKey(frameId: string): string {
  return `photograph:${frameId}`;
}

export function rollHitKey(rollId: string): string {
  return `roll:${rollId}`;
}

export function noteHitKey(noteId: string): string {
  return `note:${noteId}`;
}

export function documentsFromRolls(rolls: FilmRoll[]): FrameSearchDocument[] {
  const docs: FrameSearchDocument[] = [];

  for (const roll of rolls) {
    const notes = roll.notes
      .map((note) => indexableNoteText(note))
      .filter((text) => text.length > 0);
    for (const frame of roll.frames) {
      docs.push({
        rollId: roll.id,
        rollTitle: roll.title,
        filmStock: roll.filmStock,
        camera: roll.camera,
        startedOn: roll.startedOn,
        frameId: frame.id,
        frameNumber: frame.number,
        imageUrl: frame.imageUrl,
        caption: frame.caption,
        location: frame.location,
        aperture: frame.aperture,
        shutterSpeed: frame.shutterSpeed,
        notes,
        ocrText: roll.notes
          .map((note) => (note.ocrText ?? "").trim())
          .filter((text) => text.length > 0)
          .join("\n"),
      });
    }
  }

  return docs;
}

type FieldHit = {
  field: MetadataMatchField;
  weight: number;
  tokenHits: number;
};

type ScoredFields = {
  score: number;
  matchedFields: MetadataMatchField[];
};

function scoreFields(
  fieldValues: Array<{ field: MetadataMatchField; value: string }>,
  tokens: string[],
): ScoredFields | null {
  if (tokens.length === 0) {
    return null;
  }

  const hits: FieldHit[] = [];
  const matchedTokenSet = new Set<string>();

  for (const token of tokens) {
    let tokenMatched = false;
    for (const { field, value } of fieldValues) {
      if (!value || !textIncludes(value, token)) {
        continue;
      }
      tokenMatched = true;
      const existing = hits.find((h) => h.field === field);
      if (existing) {
        existing.tokenHits += 1;
      } else {
        hits.push({
          field,
          weight: METADATA_FIELD_WEIGHTS[field],
          tokenHits: 1,
        });
      }
    }
    if (tokenMatched) {
      matchedTokenSet.add(token);
    }
  }

  if (hits.length === 0) {
    return null;
  }

  const phrase = tokens.join(" ");
  let phraseBonus = 0;
  for (const { value } of fieldValues) {
    if (value && normalizeSearchText(value).includes(phrase)) {
      phraseBonus = 2;
      break;
    }
  }

  const fieldScore = hits.reduce((sum, hit) => sum + hit.weight * hit.tokenHits, 0);
  const coverage = matchedTokenSet.size / tokens.length;
  const score = (fieldScore + phraseBonus) * (0.5 + 0.5 * coverage);

  const matchedFields = [...new Set(hits.map((h) => h.field))];
  return { score, matchedFields };
}

function emptyHitBase(roll: FilmRoll): Omit<
  SearchHit,
  "hitKey" | "objectKind" | "score" | "kinds" | "matchedFields"
> {
  return {
    rollId: roll.id,
    rollTitle: roll.title,
    frameId: "",
    frameNumber: 0,
    frameCount: roll.frames.length,
    imageUrl: null,
    caption: "",
    location: "",
    aperture: "",
    shutterSpeed: "",
    filmStock: roll.filmStock,
    camera: roll.camera,
    startedOn: roll.startedOn,
    noteId: null,
    noteBody: "",
    noteOcrText: "",
    noteImageUrl: null,
  };
}

function firstFrameThumb(roll: FilmRoll): string | null {
  for (const frame of roll.frames) {
    if (frame.imageUrl) {
      return frame.imageUrl;
    }
  }
  return null;
}

function buildRollHit(roll: FilmRoll, scored: ScoredFields): SearchHit {
  return {
    ...emptyHitBase(roll),
    hitKey: rollHitKey(roll.id),
    objectKind: "roll",
    imageUrl: firstFrameThumb(roll),
    score: scored.score,
    kinds: ["metadata"],
    matchedFields: scored.matchedFields,
  };
}

function buildNoteHit(roll: FilmRoll, note: Note, scored: ScoredFields): SearchHit {
  return {
    ...emptyHitBase(roll),
    hitKey: noteHitKey(note.id),
    objectKind: "note",
    imageUrl: note.imageUrl ?? firstFrameThumb(roll),
    noteId: note.id,
    noteBody: note.body,
    noteOcrText: note.ocrText ?? "",
    noteImageUrl: note.imageUrl,
    score: scored.score,
    kinds: ["metadata"],
    matchedFields: scored.matchedFields,
  };
}

/** Manual body → note; derived OCR → ocr; image-only → handwritten surrogate. */
export function noteSearchFields(
  note: Pick<Note, "body" | "imageUrl" | "ocrText">,
): Array<{ field: MetadataMatchField; value: string }> {
  const fields: Array<{ field: MetadataMatchField; value: string }> = [];
  const body = note.body.trim();
  const ocr = (note.ocrText ?? "").trim();

  if (body.length > 0) {
    fields.push({ field: "note", value: body });
  }
  if (ocr.length > 0) {
    fields.push({ field: "ocr", value: ocr });
  }
  if (body.length === 0 && ocr.length === 0 && note.imageUrl) {
    fields.push({ field: "note", value: "handwritten note" });
  }

  return fields;
}

function buildPhotographHit(
  roll: FilmRoll,
  frame: FilmRoll["frames"][number],
  scored: ScoredFields,
): SearchHit {
  return {
    ...emptyHitBase(roll),
    hitKey: photographHitKey(frame.id),
    objectKind: "photograph",
    frameId: frame.id,
    frameNumber: frame.number,
    imageUrl: frame.imageUrl,
    caption: frame.caption,
    location: frame.location,
    aperture: frame.aperture,
    shutterSpeed: frame.shutterSpeed,
    score: scored.score,
    kinds: ["metadata"],
    matchedFields: scored.matchedFields,
  };
}

/**
 * Metadata search over the current in-memory archive.
 * Rebuilds documents from `rolls` on every call — newly imported frames and
 * newly saved notes are searchable immediately (no separate index rebuild).
 */
export function searchMetadata(rolls: FilmRoll[], query: SearchQuery): SearchHit[] {
  const tokens = tokenizeQuery(query.text);
  if (tokens.length === 0) {
    return [];
  }

  const limit = query.limit ?? 50;
  const hits: SearchHit[] = [];

  for (const roll of rolls) {
    const rollScored = scoreFields(
      [
        { field: "rollTitle", value: roll.title },
        { field: "filmStock", value: roll.filmStock },
        { field: "camera", value: roll.camera },
        { field: "startedOn", value: roll.startedOn },
      ],
      tokens,
    );
    if (rollScored) {
      hits.push(buildRollHit(roll, rollScored));
    }

    for (const note of roll.notes) {
      const fields = noteSearchFields(note);
      if (fields.length === 0) {
        continue;
      }
      const noteScored = scoreFields(fields, tokens);
      if (noteScored) {
        hits.push(buildNoteHit(roll, note, noteScored));
      }
    }

    for (const frame of roll.frames) {
      const photoScored = scoreFields(
        [
          { field: "caption", value: frame.caption },
          { field: "location", value: frame.location },
          { field: "aperture", value: frame.aperture },
          { field: "shutterSpeed", value: frame.shutterSpeed },
        ],
        tokens,
      );
      if (photoScored) {
        hits.push(buildPhotographHit(roll, frame, photoScored));
      }
    }
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      objectKindRank(a.objectKind) - objectKindRank(b.objectKind) ||
      a.frameNumber - b.frameNumber ||
      a.rollTitle.localeCompare(b.rollTitle),
  );
  return hits.slice(0, limit);
}

function objectKindRank(kind: ArchiveObjectKind): number {
  switch (kind) {
    case "photograph":
      return 0;
    case "roll":
      return 1;
    case "note":
      return 2;
  }
}

export type SearchHitSummary = {
  total: number;
  photographs: number;
  rolls: number;
  notes: number;
};

export type GroupedSearchHits = {
  photographs: SearchHit[];
  rolls: SearchHit[];
  notes: SearchHit[];
};

/** Partition hits by archive object kind, preserving relative order within each group. */
export function groupSearchHitsByKind(hits: SearchHit[]): GroupedSearchHits {
  const grouped: GroupedSearchHits = {
    photographs: [],
    rolls: [],
    notes: [],
  };
  for (const hit of hits) {
    if (hit.objectKind === "photograph") grouped.photographs.push(hit);
    else if (hit.objectKind === "roll") grouped.rolls.push(hit);
    else grouped.notes.push(hit);
  }
  return grouped;
}

export function summarizeSearchHits(hits: SearchHit[]): SearchHitSummary {
  const summary: SearchHitSummary = {
    total: hits.length,
    photographs: 0,
    rolls: 0,
    notes: 0,
  };
  for (const hit of hits) {
    if (hit.objectKind === "photograph") summary.photographs += 1;
    else if (hit.objectKind === "roll") summary.rolls += 1;
    else summary.notes += 1;
  }
  return summary;
}

/** Concise kind counts, e.g. "1 photograph · 1 roll". */
export function formatSearchHitSummary(summary: SearchHitSummary): string {
  if (summary.total === 0) {
    return "No matches";
  }

  const parts: string[] = [];
  if (summary.photographs > 0) {
    parts.push(
      `${summary.photographs} ${summary.photographs === 1 ? "photograph" : "photographs"}`,
    );
  }
  if (summary.rolls > 0) {
    parts.push(`${summary.rolls} ${summary.rolls === 1 ? "roll" : "rolls"}`);
  }
  if (summary.notes > 0) {
    parts.push(`${summary.notes} ${summary.notes === 1 ? "note" : "notes"}`);
  }
  return parts.join(" · ");
}
