import type { Note } from "@/lib/types";

/** Deterministic Storage path for a handwritten-note photograph. */
export function notePhotographPath(rollId: string, noteId: string): string {
  return `${rollId}/notes/${noteId}.jpg`;
}

export type NoteRow = {
  id: string;
  text: string | null;
  image_url: string | null;
  ocr_text: string | null;
  created_at: string;
};

export type NoteInsertRow = {
  id: string;
  roll_id: string;
  frame_id: null;
  text: string | null;
  image_url: string | null;
  /** Always null on insert; OCR is written later via update. */
  ocr_text: null;
  created_at: string;
};

/** Map a Supabase notes row to the app Note model. */
export function mapNoteRow(note: NoteRow): Note {
  return {
    id: note.id,
    body: note.text ?? "",
    imageUrl: note.image_url,
    ocrText: note.ocr_text ?? "",
    createdAt: note.created_at,
  };
}

/**
 * Fill missing note fields after localStorage / partial reloads.
 * Notes without OCR stay valid (`ocrText` → "").
 */
export function normalizeNoteFields(
  note: Partial<Note> & Pick<Note, "id" | "createdAt">,
): Note {
  return {
    id: note.id,
    body: note.body ?? "",
    imageUrl: note.imageUrl ?? null,
    ocrText: note.ocrText ?? "",
    createdAt: note.createdAt,
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Row shape for creating a note before optional OCR.
 * Image-only and text-only notes both use `ocr_text: null`.
 */
export function buildNoteInsertRow(params: {
  noteId: string;
  rollId: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
}): NoteInsertRow {
  return {
    id: params.noteId,
    roll_id: params.rollId,
    frame_id: null,
    text: emptyToNull(params.body),
    image_url: params.imageUrl,
    ocr_text: null,
    created_at: params.createdAt,
  };
}

/** Patch applied after local OCR succeeds on an existing note. */
export function buildNoteOcrUpdate(ocrText: string): { ocr_text: string | null } {
  return { ocr_text: emptyToNull(ocrText) };
}

/** Whether a note can be persisted under the DB check (text and/or image). */
export function isPersistableNote(body: string, imageUrl: string | null): boolean {
  return body.trim().length > 0 || Boolean(imageUrl);
}

/**
 * Text indexed for metadata search.
 * Prefers manual body, then derived OCR; image-only notes get a stable surrogate.
 */
export function indexableNoteText(
  note: Pick<Note, "body" | "imageUrl" | "ocrText">,
): string {
  const body = note.body.trim();
  const ocr = (note.ocrText ?? "").trim();
  if (body.length > 0 && ocr.length > 0) {
    return `${body}\n${ocr}`;
  }
  if (body.length > 0) {
    return body;
  }
  if (ocr.length > 0) {
    return ocr;
  }
  if (note.imageUrl) {
    return "handwritten note";
  }
  return "";
}
