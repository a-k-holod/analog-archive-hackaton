import type { AnalyzePayload, RollAnalysis } from "@/lib/types";
import { normalizeLocation } from "@/lib/location";

export function analyzeRoll(payload: AnalyzePayload): RollAnalysis {
  const locations = unique(
    payload.frames
      .map((frame) => normalizeLocation(frame.location))
      .filter((value) => value.length > 0),
  );
  const captions = payload.frames
    .map((frame) => frame.caption.trim())
    .filter((value) => value.length > 0);
  const exposures = payload.frames.filter(
    (frame) => frame.aperture.trim().length > 0 || frame.shutterSpeed.trim().length > 0,
  );
  const photographed = payload.frames.filter((frame) => frame.hasImage).length;
  const stock = payload.filmStock.trim() || "unlabeled stock";
  const camera = payload.camera.trim() || "an unspecified camera";
  const iso = payload.iso.trim();

  const summary = buildSummary({
    title: payload.title,
    stock,
    camera,
    frameCount: payload.frames.length,
    photographed,
    locations,
    captions,
    noteCount: payload.notes.length,
  });

  const technicalRead = buildTechnicalRead({
    stock,
    iso,
    camera,
    exposures,
    photographed,
    frameCount: payload.frames.length,
  });

  const themes = buildThemes({ locations, captions, notes: payload.notes, stock });

  return {
    generatedAt: new Date().toISOString(),
    summary,
    technicalRead,
    themes,
    source: "local",
  };
}

function buildSummary({
  title,
  stock,
  camera,
  frameCount,
  photographed,
  locations,
  captions,
  noteCount,
}: {
  title: string;
  stock: string;
  camera: string;
  frameCount: number;
  photographed: number;
  locations: string[];
  captions: string[];
  noteCount: number;
}): string {
  if (frameCount === 0) {
    return `${title} is still an empty roll of ${stock}, shot on ${camera}. Add frames before the archive can describe the sequence.`;
  }

  const place =
    locations.length === 1
      ? ` It stays close to ${locations[0]}.`
      : locations.length > 1
        ? ` It moves through ${locations.slice(0, 3).join(", ")}.`
        : "";
  const captionHint =
    captions.length > 0 ? ` Captions point toward ${captions.slice(0, 2).join("; ")}.` : "";
  const notesHint =
    noteCount > 0 ? ` ${noteCount} field ${noteCount === 1 ? "note sits" : "notes sit"} alongside the frames.` : "";

  return `${title} is a ${frameCount}-frame roll of ${stock} on ${camera}. ${photographed} ${photographed === 1 ? "photograph is" : "photographs are"} on file.${place}${captionHint}${notesHint}`;
}

function buildTechnicalRead({
  stock,
  iso,
  camera,
  exposures,
  photographed,
  frameCount,
}: {
  stock: string;
  iso: string;
  camera: string;
  exposures: AnalyzePayload["frames"];
  photographed: number;
  frameCount: number;
}): string {
  const isoLine = iso.length > 0 ? ` rated at ISO ${iso}` : "";
  if (exposures.length === 0) {
    return `${stock}${isoLine} in ${camera}. Exposure data is sparse: ${photographed} of ${frameCount} frames have a scan attached, but aperture and shutter values are mostly missing.`;
  }

  const apertures = unique(exposures.map((frame) => frame.aperture).filter(Boolean));
  const shutters = unique(exposures.map((frame) => frame.shutterSpeed).filter(Boolean));
  return `${stock}${isoLine} in ${camera}. Logged exposures use ${apertures.join(", ") || "unspecified apertures"} and ${shutters.join(", ") || "unspecified shutter speeds"}. ${photographed} scanned frames are available for a contact reading.`;
}

function buildThemes({
  locations,
  captions,
  notes,
  stock,
}: {
  locations: string[];
  captions: string[];
  notes: string[];
  stock: string;
}): string[] {
  const themes: string[] = [];

  if (locations.length > 0) {
    themes.push(`Place: ${locations.slice(0, 3).join(", ")}`);
  }

  const joined = [...captions, ...notes].join(" ").toLowerCase();
  if (/(street|crowd|corner|city|station)/.test(joined)) {
    themes.push("Street observation");
  }
  if (/(portrait|face|person|family)/.test(joined)) {
    themes.push("People");
  }
  if (/(light|shadow|window|hour|dusk|dawn)/.test(joined)) {
    themes.push("Light");
  }
  if (/(home|room|kitchen|interior)/.test(joined)) {
    themes.push("Interior");
  }
  if (themes.length === 0) {
    themes.push(`${stock} sequence`);
    themes.push("Work in progress");
  }

  return unique(themes).slice(0, 5);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
