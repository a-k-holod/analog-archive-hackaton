import type { ArchiveState, FilmRoll, Frame } from "@/lib/types";

const STORAGE_KEY = "analog-archive:v1";

export function loadArchive(): ArchiveState {
  if (typeof window === "undefined") {
    return { rolls: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { rolls: [] };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isArchiveState(parsed)) {
      return { rolls: [] };
    }

    return {
      rolls: parsed.rolls.map(normalizeRoll),
    };
  } catch {
    return { rolls: [] };
  }
}

function normalizeRoll(roll: FilmRoll & { frames: Array<Frame & { imageDataUrl?: string | null }> }): FilmRoll {
  return {
    ...roll,
    frames: roll.frames.map((frame) => {
      const legacy = frame as Frame & { imageDataUrl?: string | null };
      return {
        ...frame,
        imageUrl: frame.imageUrl ?? legacy.imageDataUrl ?? null,
      };
    }),
  };
}

export function saveArchive(state: ArchiveState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isArchiveState(value: unknown): value is ArchiveState {
  if (typeof value !== "object" || value === null || !("rolls" in value)) {
    return false;
  }

  return Array.isArray((value as ArchiveState).rolls);
}
