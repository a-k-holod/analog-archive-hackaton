import type { FilmRoll, Frame } from "@/lib/types";
import { mapNoteRow, type NoteRow } from "@/lib/notes";
import type { SupabaseClient } from "@supabase/supabase-js";

type RollRow = {
  id: string;
  name: string;
  film_stock: string | null;
  iso: string | null;
  camera: string | null;
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

/** Server-owned archive lookup for insight analysis. Browser never supplies images. */
export async function loadRollById(
  supabase: SupabaseClient,
  rollId: string,
): Promise<FilmRoll | null> {
  const { data: roll, error: rollError } = await supabase
    .from("rolls")
    .select(
      "id, name, film_stock, iso, camera, started_on, contact_sheet_generated_at, created_at",
    )
    .eq("id", rollId)
    .maybeSingle();

  if (rollError) {
    throw new Error(rollError.message);
  }
  if (!roll) {
    return null;
  }

  const rollRow = roll as RollRow;

  const [{ data: frames, error: framesError }, { data: notes, error: notesError }] =
    await Promise.all([
      supabase
        .from("frames")
        .select(
          "id, roll_id, frame_number, image_url, title, location, aperture, shutter_speed, created_at",
        )
        .eq("roll_id", rollId)
        .order("frame_number", { ascending: true }),
      supabase
        .from("notes")
        .select("id, roll_id, text, image_url, ocr_text, created_at")
        .eq("roll_id", rollId)
        .order("created_at", { ascending: true }),
    ]);

  if (framesError) {
    throw new Error(framesError.message);
  }
  if (notesError) {
    throw new Error(notesError.message);
  }

  return {
    id: rollRow.id,
    title: rollRow.name,
    filmStock: rollRow.film_stock ?? "",
    iso: rollRow.iso ?? "",
    camera: rollRow.camera ?? "",
    startedOn: rollRow.started_on ?? "",
    createdAt: rollRow.created_at,
    frames: ((frames ?? []) as FrameRow[]).map(mapFrame),
    notes: ((notes ?? []) as NoteRow[]).map(mapNoteRow),
    contactSheetGeneratedAt: rollRow.contact_sheet_generated_at,
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
