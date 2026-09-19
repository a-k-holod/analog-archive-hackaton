import { createClient } from "@/lib/supabase/client";
import type { FilmRoll, Frame, Note, NewFrameInput, NewRollInput } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_BUCKET = "photographs";

type RollRow = {
  id: string;
  name: string;
  film_stock: string | null;
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

type NoteRow = {
  id: string;
  roll_id: string;
  frame_id: string | null;
  text: string | null;
  created_at: string;
};

export async function fetchArchive(): Promise<FilmRoll[]> {
  const supabase = createClient();

  const { data: rolls, error: rollsError } = await supabase
    .from("rolls")
    .select(
      "id, name, film_stock, iso, camera, frame_count, started_on, contact_sheet_generated_at, created_at",
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

  const [{ data: frames, error: framesError }, { data: notes, error: notesError }] =
    await Promise.all([
      supabase
        .from("frames")
        .select(
          "id, roll_id, frame_number, image_url, title, location, aperture, shutter_speed, created_at",
        )
        .in("roll_id", rollIds)
        .order("frame_number", { ascending: true }),
      supabase
        .from("notes")
        .select("id, roll_id, frame_id, text, created_at")
        .in("roll_id", rollIds)
        .order("created_at", { ascending: true }),
    ]);

  if (framesError) {
    throw new Error(framesError.message);
  }
  if (notesError) {
    throw new Error(notesError.message);
  }

  const framesByRoll = groupBy((frames ?? []) as FrameRow[], (frame) => frame.roll_id);
  const notesByRoll = groupBy((notes ?? []) as NoteRow[], (note) => note.roll_id);

  return rollRows.map((roll) => mapRoll(roll, framesByRoll.get(roll.id) ?? [], notesByRoll.get(roll.id) ?? []));
}

export async function insertRoll(input: NewRollInput & { id: string; createdAt: string }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("rolls").insert({
    id: input.id,
    name: input.title.trim(),
    film_stock: emptyToNull(input.filmStock),
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
  createdAt: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notes").insert({
    id: params.noteId,
    roll_id: params.rollId,
    frame_id: null,
    text: params.body,
    created_at: params.createdAt,
  });

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

export async function uploadPhotograph(params: {
  rollId: string;
  frameId: string;
  blob: Blob;
}): Promise<string> {
  const supabase = createClient();
  const path = `${params.rollId}/${params.frameId}.jpg`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, params.blob, {
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

function mapRoll(roll: RollRow, frames: FrameRow[], notes: NoteRow[]): FilmRoll {
  return {
    id: roll.id,
    title: roll.name,
    filmStock: roll.film_stock ?? "",
    iso: roll.iso ?? "",
    camera: roll.camera ?? "",
    startedOn: roll.started_on ?? "",
    createdAt: roll.created_at,
    frames: frames.map(mapFrame),
    notes: notes.map(mapNote),
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

function mapNote(note: NoteRow): Note {
  return {
    id: note.id,
    body: note.text ?? "",
    createdAt: note.created_at,
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
