import type { Frame } from "@/lib/types";

/** Editable frame fields — never includes id, number, or image. */
export type FrameMetadataFields = {
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
};

export type FrameMetadataPatch = Partial<FrameMetadataFields>;

/** Supabase `frames` columns touched by a metadata update. */
export type FrameUpdateRow = {
  title: string | null;
  location: string | null;
  aperture: string | null;
  shutter_speed: string | null;
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Index of a frame in the roll's ordered list (already sorted by frame_number).
 * Does not reorder.
 */
export function findFrameIndex(frames: readonly Frame[], frameId: string): number {
  return frames.findIndex((frame) => frame.id === frameId);
}

export function canNavigatePrevious(frames: readonly Frame[], frameId: string): boolean {
  return findFrameIndex(frames, frameId) > 0;
}

export function canNavigateNext(frames: readonly Frame[], frameId: string): boolean {
  const index = findFrameIndex(frames, frameId);
  return index >= 0 && index < frames.length - 1;
}

/**
 * Adjacent frame id in the existing ordered roll list.
 * Returns null at boundaries or when the frame is missing.
 */
export function adjacentFrameId(
  frames: readonly Frame[],
  frameId: string,
  direction: "previous" | "next",
): string | null {
  const index = findFrameIndex(frames, frameId);
  if (index < 0) {
    return null;
  }
  if (direction === "previous") {
    return index > 0 ? frames[index - 1]!.id : null;
  }
  return index < frames.length - 1 ? frames[index + 1]!.id : null;
}

/**
 * Map app metadata fields to a Supabase update row.
 * Always writes all four columns so omitted patch keys keep current values
 * (caller must merge with the existing frame first).
 */
export function buildFrameUpdateRow(fields: FrameMetadataFields): FrameUpdateRow {
  return {
    title: emptyToNull(fields.caption),
    location: emptyToNull(fields.location),
    aperture: emptyToNull(fields.aperture),
    shutter_speed: emptyToNull(fields.shutterSpeed),
  };
}

/**
 * Apply a metadata patch while preserving frame identity and archival fields.
 * Unspecified patch keys keep their existing values.
 */
export function applyFrameMetadata(frame: Frame, patch: FrameMetadataPatch): Frame {
  return {
    id: frame.id,
    number: frame.number,
    imageUrl: frame.imageUrl,
    createdAt: frame.createdAt,
    caption: patch.caption !== undefined ? patch.caption.trim() : frame.caption,
    location: patch.location !== undefined ? patch.location.trim() : frame.location,
    aperture: patch.aperture !== undefined ? patch.aperture.trim() : frame.aperture,
    shutterSpeed:
      patch.shutterSpeed !== undefined ? patch.shutterSpeed.trim() : frame.shutterSpeed,
  };
}

/** Resolve the full metadata payload for persistence from a patch + current frame. */
export function resolveFrameMetadata(
  frame: Frame,
  patch: FrameMetadataPatch,
): FrameMetadataFields {
  const next = applyFrameMetadata(frame, patch);
  return {
    caption: next.caption,
    location: next.location,
    aperture: next.aperture,
    shutterSpeed: next.shutterSpeed,
  };
}
