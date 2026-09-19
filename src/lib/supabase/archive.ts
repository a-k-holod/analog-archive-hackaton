import { createClient } from "@/lib/supabase/client";
import {
  buildDevelopmentUpsertRow,
  pickDevelopmentForRoll,
  type DevelopmentRow,
} from "@/lib/developments";
import {
  buildFrameUpdateRow,
  resolveFrameMetadata,
  type FrameMetadataPatch,
} from "@/lib/frames";
import {
  buildNoteInsertRow,
  buildNoteOcrUpdate,
  mapNoteRow,
  notePhotographPath,
  type NoteRow,
} from "@/lib/notes";
import { normalizeFilmStockId } from "@/lib/filmCatalog";
import type {
  DevelopmentRecordInput,
  FilmRoll,
  Frame,
  NewFrameInput,
  NewRollInput,
  UpdateRollFilmStockInput,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_BUCKET = "photographs";

type RollRow = {
  id: string;
  name: string;
  film_stock: string | null;
  film_stock_id: string | null;
  iso: string | null;
  camera: string | null;
  frame_count: number;
  started_on: string | null;
  contact_sheet_generated_at: string | null;
  created_at: string;
};

type FrameRow = {
  id: string;
  roll_id: string;
  frame_number: number;
  image_url: string | null;
  title: string | null;
  location: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  created_at: string;
};

type NoteQueryRow = NoteRow & {
  roll_id: string;
  frame_id: string | null;
};

export async function fetchArchive(): Promise<FilmRoll[]> {
  const supabase = createClient();

  const { data: rolls, error: rollsError } = await supabase
    .from("rolls")
    .select(
      "id, name, film_stock, film_stock_id, iso, camera, frame_count, started_on, contact_sheet_generated_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (rollsError) {
    throw new Error(rollsError.message);
  }

  const rollRows = (rolls ?? []) as RollRow[];
  if (rollRows.length === 0) {
    return [];
  }

  const rollIds = rollRows.map((roll) => roll.id);

  const [
    { data: frames, error: framesError },
    { data: notes, error: notesError },
    { data: developments, error: developmentsError },
  ] = await Promise.all([
    supabase
      .from("frames")
      .select(
        "id, roll_id, frame_number, image_url, title, location, aperture, shutter_speed, created_at",
      )
      .in("roll_id", rollIds)
      .order("frame_number", { ascending: true }),
    supabase
      .from("notes")
      .select("id, roll_id, frame_id, text, image_url, ocr_text, created_at")
      .in("roll_id", rollIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("developments")
      .select(
        "id, roll_id, developer, dilution, temperature, development_time, agitation, method, exposure_index, notes, source_recipe_id, created_at, updated_at",
      )
      .in("roll_id", rollIds)
      .order("updated_at", { ascending: false }),
  ]);

  if (framesError) {
    throw new Error(framesError.message);
  }
  if (notesError) {
    throw new Error(notesError.message);
  }
  if (developmentsError) {
    throw new Error(developmentsError.message);
  }

  const framesByRoll = groupBy((frames ?? []) as FrameRow[], (frame) => frame.roll_id);
  const notesByRoll = groupBy((notes ?? []) as NoteQueryRow[], (note) => note.roll_id);
  const developmentsByRoll = groupBy(
    (developments ?? []) as DevelopmentRow[],
    (row) => row.roll_id,
  );

  return rollRows.map((roll) =>
    mapRoll(
      roll,
      framesByRoll.get(roll.id) ?? [],
      notesByRoll.get(roll.id) ?? [],
      developmentsByRoll.get(roll.id) ?? [],
    ),
  );
}

export async function insertRoll(input: NewRollInput & { id: string; createdAt: string }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("rolls").insert({
    id: input.id,
    name: input.title.trim(),
    film_stock: emptyToNull(input.filmStock),
    film_stock_id: normalizeFilmStockId(input.filmStockId),
    iso: emptyToNull(input.iso),
    camera: emptyToNull(input.camera),
    started_on: emptyToNull(input.startedOn),
    frame_count: 0,
    contact_sheet_generated_at: null,
    created_at: input.createdAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRollFilmStockMetadata(
  rollId: string,
  input: UpdateRollFilmStockInput,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("rolls")
    .update({
      film_stock: emptyToNull(input.filmStock),
      film_stock_id: normalizeFilmStockId(input.filmStockId),
      iso: emptyToNull(input.iso),
    })
    .eq("id", rollId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function insertFrame(params: {
  rollId: string;
  frameId: string;
  number: number;
  input: NewFrameInput;
  imageUrl: string | null;
  createdAt: string;
  nextFrameCount: number;
}): Promise<void> {
  const supabase = createClient();

  const { error: frameError } = await supabase.from("frames").insert({
    id: params.frameId,
    roll_id: params.rollId,
    frame_number: params.number,
    image_url: params.imageUrl,
    title: emptyToNull(params.input.caption),
    location: emptyToNull(params.input.location),
    aperture: emptyToNull(params.input.aperture),
    shutter_speed: emptyToNull(params.input.shutterSpeed),
    created_at: params.createdAt,
  });

  if (frameError) {
    throw new Error(frameError.message);
  }

  const { error: rollError } = await supabase
    .from("rolls")
    .update({
      frame_count: params.nextFrameCount,
      contact_sheet_generated_at: null,
    })
    .eq("id", params.rollId);

  if (rollError) {
    throw new Error(rollError.message);
  }
}

export async function insertNote(params: {
  noteId: string;
  rollId: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notes").insert(buildNoteInsertRow(params));

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateNoteOcrText(params: {
  noteId: string;
  ocrText: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notes")
    .update(buildNoteOcrUpdate(params.ocrText))
    .eq("id", params.noteId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update metadata on an existing frame row.
 * Never inserts; never changes id, frame_number, or image_url.
 */
export async function updateFrameMetadata(params: {
  frameId: string;
  current: Frame;
  patch: FrameMetadataPatch;
}): Promise<void> {
  const fields = resolveFrameMetadata(params.current, params.patch);
  const supabase = createClient();
  const { error } = await supabase
    .from("frames")
    .update(buildFrameUpdateRow(fields))
    .eq("id", params.frameId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateContactSheetGeneratedAt(rollId: string, generatedAt: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("rolls")
    .update({ contact_sheet_generated_at: generatedAt })
    .eq("id", rollId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Insert or update the photographer's personal development record for a roll.
 * Never writes to the bundled manufacturer catalog.
 */
export async function upsertDevelopmentRecord(params: {
  id: string;
  rollId: string;
  input: DevelopmentRecordInput;
  createdAt: string;
  updatedAt: string;
}): Promise<void> {
  const supabase = createClient();
  const row = buildDevelopmentUpsertRow(params);
  const { error } = await supabase.from("developments").upsert(row, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadPhotograph(params: {
  rollId: string;
  frameId: string;
  blob: Blob;
}): Promise<string> {
  const supabase = createClient();
  const path = `${params.rollId}/${params.frameId}.jpg`;
  return uploadJpeg(supabase, path, params.blob);
}

export async function uploadNotePhotograph(params: {
  rollId: string;
  noteId: string;
  blob: Blob;
}): Promise<string> {
  const supabase = createClient();
  const path = notePhotographPath(params.rollId, params.noteId);
  return uploadJpeg(supabase, path, params.blob);
}

async function uploadJpeg(supabase: SupabaseClient, path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return publicPhotographUrl(supabase, path);
}

function publicPhotographUrl(supabase: SupabaseClient, path: string): string {
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function mapRoll(
  roll: RollRow,
  frames: FrameRow[],
  notes: NoteQueryRow[],
  developments: DevelopmentRow[],
): FilmRoll {
  return {
    id: roll.id,
    title: roll.name,
    filmStock: roll.film_stock ?? "",
    filmStockId: normalizeFilmStockId(roll.film_stock_id),
    iso: roll.iso ?? "",
    camera: roll.camera ?? "",
    startedOn: roll.started_on ?? "",
    createdAt: roll.created_at,
    frames: frames.map(mapFrame),
    notes: notes.map(mapNoteRow),
    development: pickDevelopmentForRoll(developments),
    contactSheetGeneratedAt: roll.contact_sheet_generated_at,
    analysis: null,
  };
}

function mapFrame(frame: FrameRow): Frame {
  return {
    id: frame.id,
    number: frame.frame_number,
    imageUrl: frame.image_url,
    caption: frame.title ?? "",
    location: frame.location ?? "",
    aperture: frame.aperture ?? "",
    shutterSpeed: frame.shutter_speed ?? "",
    createdAt: frame.created_at,
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const group = key(item);
    const current = map.get(group);
    if (current) {
      current.push(item);
    } else {
      map.set(group, [item]);
    }
  }
  return map;
}
