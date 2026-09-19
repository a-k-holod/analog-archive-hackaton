import { createHash } from "node:crypto";
import type { FilmRoll, RollContentFingerprint } from "@/lib/types";

/**
 * Deterministic content fingerprint for a roll archive state.
 * Same inputs always produce the same hash; frame order matters.
 * Does not include generatedAt, provider, or model.
 */
export function hashRollContent(input: RollContentFingerprint): string {
  const canonical = canonicalize(input);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function fingerprintFromRoll(roll: FilmRoll): RollContentFingerprint {
  const frames = [...roll.frames]
    .sort((a, b) => a.number - b.number)
    .map((frame) => ({
      number: frame.number,
      caption: frame.caption,
      location: frame.location,
      aperture: frame.aperture,
      shutterSpeed: frame.shutterSpeed,
      imageUrl: frame.imageUrl,
    }));

  return {
    rollId: roll.id,
    title: roll.title,
    filmStock: roll.filmStock,
    iso: roll.iso,
    camera: roll.camera,
    startedOn: roll.startedOn,
    frames,
    notes: roll.notes.map((note) => note.body),
  };
}

export function hashRoll(roll: FilmRoll): string {
  return hashRollContent(fingerprintFromRoll(roll));
}

function canonicalize(input: RollContentFingerprint): string {
  // Fixed field order; frames already ordered by number before call sites serialize.
  const lines: string[] = [
    "v1",
    `rollId:${escape(input.rollId)}`,
    `title:${escape(input.title)}`,
    `filmStock:${escape(input.filmStock)}`,
    `iso:${escape(input.iso)}`,
    `camera:${escape(input.camera)}`,
    `startedOn:${escape(input.startedOn)}`,
    `frameCount:${input.frames.length}`,
  ];

  for (const frame of input.frames) {
    lines.push(
      [
        "frame",
        String(frame.number),
        escape(frame.caption),
        escape(frame.location),
        escape(frame.aperture),
        escape(frame.shutterSpeed),
        escape(frame.imageUrl ?? ""),
      ].join("\t"),
    );
  }

  lines.push(`noteCount:${input.notes.length}`);
  for (const note of input.notes) {
    lines.push(`note:${escape(note)}`);
  }

  return lines.join("\n");
}

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}
