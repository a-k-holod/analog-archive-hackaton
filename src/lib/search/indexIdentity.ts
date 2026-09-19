import type { Frame, FilmRoll } from "../types.ts";
import type { FrameIndexIdentity } from "./types.ts";

/**
 * Deterministic FNV-1a 32-bit hash → hex. Sync and works in Node + browser
 * without pulling in node:crypto (kept out of client bundles).
 */
export function hashContentString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Content identity for a frame photograph.
 * Based on the stable image URL / content id — when the photograph changes
 * (new URL), the key changes and any prior embedding must not be reused.
 * Frames without an image are not indexable.
 */
export function frameContentKey(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null;
  }
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    return null;
  }
  return `img:v1:${hashContentString(trimmed)}`;
}

export function buildFrameIndexIdentity(
  rollId: string,
  frame: Pick<Frame, "id" | "imageUrl">,
  modelId: string,
): FrameIndexIdentity | null {
  const contentKey = frameContentKey(frame.imageUrl);
  if (!contentKey) {
    return null;
  }

  return {
    frameId: frame.id,
    rollId,
    contentKey,
    modelId,
  };
}

/** Collect index identities for every frame that currently has an image. */
export function collectIndexableFrames(
  rolls: FilmRoll[],
  modelId: string,
): FrameIndexIdentity[] {
  const identities: FrameIndexIdentity[] = [];

  for (const roll of rolls) {
    for (const frame of roll.frames) {
      const identity = buildFrameIndexIdentity(roll.id, frame, modelId);
      if (identity) {
        identities.push(identity);
      }
    }
  }

  return identities;
}
