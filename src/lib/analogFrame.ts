/**
 * Contact-sheet analog presentation mode + conservative film-edge detection.
 * Presentation only — never mutates stored photographs or Storage URLs.
 */

export type AnalogFrameMode = "off" | "auto" | "on";

export const ANALOG_FRAME_MODES: readonly AnalogFrameMode[] = ["off", "auto", "on"];

/** Aspect class from decoded pixel dimensions. */
export type ImageAspectOrientation = "landscape" | "portrait" | "square";

/**
 * Where sprocket / rebate evidence sits relative to the scan.
 * `unknown` when evidence does not confidently establish a rail axis.
 */
export type FilmRailAxis = "horizontal" | "vertical" | "unknown";

/**
 * Decorative layout for the contact-sheet cell.
 * - horizontal: rails on top/bottom (classic 35mm landscape scan)
 * - vertical: rails on left/right (portrait scan / rotated strip metaphor)
 * - restrained: soft rebate only — no sprocket motif
 */
export type AnalogFrameLayout = "horizontal" | "vertical" | "restrained";

/** Near-square band — prefer restrained treatment over inventing rails. */
export const SQUARE_ASPECT_TOLERANCE = 0.08;

export type ResolveAnalogFrameOptions = {
  /**
   * Optional detection result for Auto mode.
   * Pass the result of `detectFilmEdge()` when available.
   */
  detection?: FilmEdgeDetection | null;
};

/**
 * Decide whether the decorative analog frame should render.
 *
 * - off  → never
 * - on   → always
 * - auto → conservative: only when detection positively finds a film border.
 *          Without detection, Auto shows no frame (false positives over a real
 *          film border are worse than skipping the decorative frame).
 */
export function shouldShowAnalogFrame(
  mode: AnalogFrameMode,
  options?: ResolveAnalogFrameOptions,
): boolean {
  switch (mode) {
    case "off":
      return false;
    case "on":
      return true;
    case "auto":
      return options?.detection?.hasFilmBorder === true;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Classify image aspect from real pixel dimensions.
 * Square/near-square stays conservative for decorative sprocket placement.
 */
export function resolveImageOrientation(
  width: number,
  height: number,
): ImageAspectOrientation {
  if (!(width > 0) || !(height > 0)) {
    return "square";
  }
  const ratio = width / height;
  if (Math.abs(ratio - 1) <= SQUARE_ASPECT_TOLERANCE) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}

/**
 * Choose decorative rail layout from detection evidence and/or image aspect.
 *
 * Priority:
 * 1. Confident detector rail axis (sprocket evidence on that pair of edges)
 * 2. Film border without a clear axis → restrained
 * 3. Image aspect fallback (On mode / no rail evidence):
 *    landscape → horizontal, portrait → vertical, square → restrained
 */
export function resolveAnalogFrameLayout(input: {
  imageOrientation: ImageAspectOrientation;
  filmRailAxis?: FilmRailAxis | null;
  /** True when Auto/On has positive film-border evidence but axis may be unknown. */
  hasFilmBorder?: boolean;
}): AnalogFrameLayout {
  const axis = input.filmRailAxis ?? "unknown";

  if (axis === "horizontal") return "horizontal";
  if (axis === "vertical") return "vertical";

  // Evidence of a border without a trustworthy rail direction: do not invent sprockets.
  if (input.hasFilmBorder && axis === "unknown") {
    return "restrained";
  }

  switch (input.imageOrientation) {
    case "landscape":
      return "horizontal";
    case "portrait":
      return "vertical";
    case "square":
      return "restrained";
    default: {
      const _exhaustive: never = input.imageOrientation;
      return _exhaustive;
    }
  }
}

/**
 * Conservative film-edge / rebate / sprocket detection for Auto mode.
 * Analyzes a downsampled browser decode of `imageUrl`; never rewrites the URL.
 * Results are cached in-memory per URL for the page session.
 */
export async function detectFilmEdge(imageUrl: string): Promise<FilmEdgeDetection> {
  return getOrDetectFilmEdge(imageUrl);
}

export function formatFrameNumber(frameNumber: number): string {
  return String(frameNumber).padStart(2, "0");
}

/**
 * Normalize a stored ISO value for edge marking.
 * Strips a leading "ISO" prefix; returns null when empty/unknown.
 */
export function normalizeIsoValue(iso: string | null | undefined): string | null {
  if (iso == null) return null;
  const trimmed = String(iso).trim();
  if (!trimmed) return null;
  const withoutPrefix = trimmed.replace(/^ISO\s*/i, "").trim();
  return withoutPrefix || null;
}

/**
 * Archival-inspired film-stock / ISO rebate label.
 *
 * Uses archive metadata only — does not invent a manufacturer when stock is unknown.
 * Collapses redundant ISO when the stock name already ends with the same value
 * (e.g. "Fomapan 400" + ISO 400 → "FOMAPAN 400").
 * Strips inline "ISO" tokens so "Ilford HP5 Plus ISO 400" → "ILFORD HP5 PLUS 400".
 */
export function formatFilmStockEdgeLabel(
  filmStock: string | null | undefined,
  iso?: string | null | undefined,
): string | null {
  if (filmStock == null) return null;
  const trimmedStock = String(filmStock).trim();
  if (!trimmedStock) return null;

  // Collapse whitespace and drop standalone "ISO" tokens before a speed number.
  let label = trimmedStock
    .replace(/\s+/g, " ")
    .replace(/\bISO\s+(?=\d)/gi, "")
    .trim()
    .toUpperCase();

  if (!label) return null;

  const isoValue = normalizeIsoValue(iso);
  if (isoValue) {
    const isoUpper = isoValue.toUpperCase();
    const alreadyPresent = new RegExp(
      `(?:^|\\s)${escapeRegExp(isoUpper)}$`,
      "i",
    ).test(label);
    if (!alreadyPresent) {
      label = `${label} ${isoUpper}`;
    }
  }

  return label;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Where the stock/frame rebate marking sits relative to the decorative rails.
 * Mirrors AnalogFrame caption orientation — detector-selected layout still wins.
 */
export type RebateLabelPlacement = "horizontal" | "vertical" | "stacked";

export function resolveRebateLabelPlacement(layout: AnalogFrameLayout): RebateLabelPlacement {
  switch (layout) {
    case "horizontal":
      return "horizontal";
    case "vertical":
      return "vertical";
    case "restrained":
      return "stacked";
    default: {
      const _exhaustive: never = layout;
      return _exhaustive;
    }
  }
}

export type ContactSheetCellPresentation = {
  showFrame: boolean;
  layout: AnalogFrameLayout;
  /** Passthrough — never rewritten by presentation logic. */
  imageUrl: string | null | undefined;
  frameNumberLabel: string;
  /** Formatted stock/ISO rebate text, or null when stock is unknown. */
  filmStockLabel: string | null;
};

/**
 * Resolve presentation props for one contact-sheet cell.
 * Keeps image URLs and frame numbers independent of decorative framing.
 */
export function resolveContactSheetCell(input: {
  mode: AnalogFrameMode;
  imageUrl: string | null | undefined;
  frameNumber: number;
  detection?: FilmEdgeDetection | null;
  /** Optional explicit dimensions when detection is absent (e.g. On mode). */
  width?: number;
  height?: number;
  filmStock?: string | null;
  iso?: string | null;
}): ContactSheetCellPresentation {
  const showFrame = shouldShowAnalogFrame(input.mode, { detection: input.detection });

  const orientationFromDetection = input.detection?.imageOrientation;
  const orientationFromSize =
    input.width !== undefined && input.height !== undefined
      ? resolveImageOrientation(input.width, input.height)
      : undefined;
  const imageOrientation = orientationFromDetection ?? orientationFromSize ?? "square";

  const layout = showFrame
    ? resolveAnalogFrameLayout({
        imageOrientation,
        filmRailAxis: input.detection?.filmRailAxis,
        hasFilmBorder: input.detection?.hasFilmBorder === true,
      })
    : "restrained";

  return {
    showFrame,
    layout,
    imageUrl: input.imageUrl,
    frameNumberLabel: formatFrameNumber(input.frameNumber),
    filmStockLabel: formatFilmStockEdgeLabel(input.filmStock, input.iso),
  };
}

// ---------------------------------------------------------------------------
// Film-edge detection (pure pixel analysis + browser canvas decode)
// ---------------------------------------------------------------------------

/** Longest analysis edge; keep well below contact-sheet decode size. */
export const FILM_EDGE_ANALYSIS_MAX = 288;

/**
 * Confidence required before Auto may show a decorative frame.
 * False positives are worse than false negatives.
 */
export const FILM_EDGE_CONFIDENCE_THRESHOLD = 0.72;

export type FilmEdgeDetection = {
  hasFilmBorder: boolean;
  confidence: number;
  reasons: string[];
  /** Aspect of the analyzed (possibly downsampled) bitmap. */
  imageOrientation: ImageAspectOrientation;
  /**
   * Axis where sprocket/rebate evidence was strongest.
   * Prefer this over inventing rails from aspect alone when set.
   */
  filmRailAxis: FilmRailAxis;
};

export type PixelBuffer = {
  width: number;
  height: number;
  /** RGBA, length === width * height * 4 */
  data: Uint8ClampedArray | Uint8Array;
};

const emptyResult = (
  reasons: string[],
  confidence = 0,
  orientation: ImageAspectOrientation = "square",
  filmRailAxis: FilmRailAxis = "unknown",
): FilmEdgeDetection => ({
  hasFilmBorder: false,
  confidence,
  reasons,
  imageOrientation: orientation,
  filmRailAxis,
});

/** In-memory session cache — avoids re-decoding the same URL on re-renders. */
const filmEdgeDetectionCache = new Map<string, Promise<FilmEdgeDetection>>();

function getOrDetectFilmEdge(imageUrl: string): Promise<FilmEdgeDetection> {
  const existing = filmEdgeDetectionCache.get(imageUrl);
  if (existing) return existing;

  const pending = detectFilmEdgeFromUrl(imageUrl);
  filmEdgeDetectionCache.set(imageUrl, pending);
  return pending;
}

/** Test helper — clears the in-memory detection cache. */
export function clearFilmEdgeDetectionCache(): void {
  filmEdgeDetectionCache.clear();
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function samplePixel(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  x: number,
  y: number,
): { y: number; chroma: number } {
  const i = (y * width + x) * 4;
  const r = data[i] ?? 0;
  const g = data[i + 1] ?? 0;
  const b = data[i + 2] ?? 0;
  const yLum = luminance(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { y: yLum, chroma: max - min };
}

type StripStats = {
  meanY: number;
  /** Approximate median via 64-bin luminance histogram. */
  medianY: number;
  stdY: number;
  meanChroma: number;
  darkFraction: number;
};

function stripStats(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  region: { x0: number; y0: number; x1: number; y1: number },
  step = 1,
): StripStats {
  let sumY = 0;
  let sumY2 = 0;
  let sumChroma = 0;
  let dark = 0;
  let n = 0;
  const bins = new Uint32Array(64);

  for (let y = region.y0; y < region.y1; y += step) {
    for (let x = region.x0; x < region.x1; x += step) {
      const p = samplePixel(data, width, x, y);
      sumY += p.y;
      sumY2 += p.y * p.y;
      sumChroma += p.chroma;
      if (p.y < 55) dark += 1;
      const bin = Math.min(63, Math.floor(p.y / 4));
      bins[bin] = (bins[bin] ?? 0) + 1;
      n += 1;
    }
  }

  if (n === 0) {
    return { meanY: 0, medianY: 0, stdY: 0, meanChroma: 0, darkFraction: 0 };
  }

  const meanY = sumY / n;
  const variance = Math.max(0, sumY2 / n - meanY * meanY);
  const target = n / 2;
  let seen = 0;
  let medianY = meanY;
  for (let b = 0; b < 64; b += 1) {
    seen += bins[b] ?? 0;
    if (seen >= target) {
      medianY = b * 4 + 2;
      break;
    }
  }

  return {
    meanY,
    medianY,
    stdY: Math.sqrt(variance),
    meanChroma: sumChroma / n,
    darkFraction: dark / n,
  };
}

function edgeBandThickness(size: number): number {
  return Math.max(3, Math.min(18, Math.round(size * 0.06)));
}

type EdgeBundle = {
  top: StripStats;
  bottom: StripStats;
  left: StripStats;
  right: StripStats;
  interior: StripStats;
};

function measureEdges(image: PixelBuffer): EdgeBundle {
  const { width, height, data } = image;
  const bandY = edgeBandThickness(height);
  const bandX = edgeBandThickness(width);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 96));

  return {
    top: stripStats(data, width, height, { x0: 0, y0: 0, x1: width, y1: bandY }, step),
    bottom: stripStats(
      data,
      width,
      height,
      { x0: 0, y0: height - bandY, x1: width, y1: height },
      step,
    ),
    left: stripStats(data, width, height, { x0: 0, y0: 0, x1: bandX, y1: height }, step),
    right: stripStats(
      data,
      width,
      height,
      { x0: width - bandX, y0: 0, x1: width, y1: height },
      step,
    ),
    interior: stripStats(
      data,
      width,
      height,
      { x0: bandX, y0: bandY, x1: width - bandX, y1: height - bandY },
      step + 1,
    ),
  };
}

function isDarkContinuousRebate(edge: StripStats, interior: StripStats): boolean {
  // Prefer median so bright sprocket holes do not wash out a dark rebate base.
  const darkEnough = edge.medianY < 55 && edge.darkFraction >= 0.45;
  const lowChroma = edge.meanChroma < 48;
  // Allow higher variance when holes punch through a mostly-dark strip.
  const stable = edge.stdY < 75 || edge.darkFraction >= 0.55;
  const contrastsInterior = interior.meanY - edge.medianY >= 28;
  return darkEnough && lowChroma && stable && contrastsInterior;
}

function isLetterboxLike(edges: EdgeBundle): boolean {
  const { top, bottom, left, right, interior } = edges;
  const longDark =
    top.meanY < 35 &&
    bottom.meanY < 35 &&
    top.stdY < 22 &&
    bottom.stdY < 22 &&
    top.darkFraction > 0.85 &&
    bottom.darkFraction > 0.85;
  const sidesMatchInterior =
    Math.abs(left.meanY - interior.meanY) < 18 &&
    Math.abs(right.meanY - interior.meanY) < 18;
  return longDark && sidesMatchInterior;
}

function longEdgeProfile(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  which: "top" | "bottom",
): Float64Array {
  const band = edgeBandThickness(height);
  const y0 = which === "top" ? 0 : height - band;
  const profile = new Float64Array(width);

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = y0; y < y0 + band; y += 1) {
      sum += samplePixel(data, width, x, y).y;
    }
    profile[x] = sum / band;
  }
  return profile;
}

function shortEdgeProfile(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  which: "left" | "right",
): Float64Array {
  const band = edgeBandThickness(width);
  const x0 = which === "left" ? 0 : width - band;
  const profile = new Float64Array(height);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = x0; x < x0 + band; x += 1) {
      sum += samplePixel(data, width, x, y).y;
    }
    profile[y] = sum / band;
  }
  return profile;
}

type PeriodicityHit = {
  score: number;
  peakCount: number;
  meanPeriod: number;
};

function detectSprocketPeriodicity(profile: Float64Array): PeriodicityHit {
  const n = profile.length;
  if (n < 32) {
    return { score: 0, peakCount: 0, meanPeriod: 0 };
  }

  const smooth = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = profile[Math.max(0, i - 1)] ?? 0;
    const b = profile[i] ?? 0;
    const c = profile[Math.min(n - 1, i + 1)] ?? 0;
    smooth[i] = (a + b + c) / 3;
  }

  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += smooth[i] ?? 0;
  mean /= n;

  let variance = 0;
  for (let i = 0; i < n; i += 1) {
    const d = (smooth[i] ?? 0) - mean;
    variance += d * d;
  }
  const std = Math.sqrt(variance / n);
  if (std < 8) {
    return { score: 0, peakCount: 0, meanPeriod: 0 };
  }

  const brightPeaks = findPeriodicPeaks(smooth, mean + std * 0.55, true);
  const darkPeaks = findPeriodicPeaks(smooth, mean - std * 0.55, false);
  return brightPeaks.score >= darkPeaks.score ? brightPeaks : darkPeaks;
}

function findPeriodicPeaks(
  signal: Float64Array,
  threshold: number,
  bright: boolean,
): PeriodicityHit {
  const n = signal.length;
  const peaks: number[] = [];
  const minSeparation = Math.max(4, Math.floor(n / 28));

  for (let i = 2; i < n - 2; i += 1) {
    const v = signal[i] ?? 0;
    const passes = bright ? v >= threshold : v <= threshold;
    if (!passes) continue;
    const isExtrema = bright
      ? v >= (signal[i - 1] ?? 0) && v >= (signal[i + 1] ?? 0)
      : v <= (signal[i - 1] ?? 0) && v <= (signal[i + 1] ?? 0);
    if (!isExtrema) continue;
    const last = peaks[peaks.length - 1];
    if (last !== undefined && i - last < minSeparation) {
      const prev = signal[last] ?? 0;
      if ((bright && v > prev) || (!bright && v < prev)) {
        peaks[peaks.length - 1] = i;
      }
      continue;
    }
    peaks.push(i);
  }

  if (peaks.length < 4) {
    return { score: 0, peakCount: peaks.length, meanPeriod: 0 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i += 1) {
    intervals.push((peaks[i] ?? 0) - (peaks[i - 1] ?? 0));
  }
  const meanPeriod = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (meanPeriod < 6 || meanPeriod > n / 3.5) {
    return { score: 0, peakCount: peaks.length, meanPeriod };
  }

  let intervalVar = 0;
  for (const d of intervals) {
    const err = d - meanPeriod;
    intervalVar += err * err;
  }
  const intervalStd = Math.sqrt(intervalVar / intervals.length);
  const regularity = 1 - Math.min(1, intervalStd / meanPeriod);

  if (regularity < 0.55 || peaks.length < 4) {
    return { score: 0, peakCount: peaks.length, meanPeriod };
  }

  const countFactor = clamp01((peaks.length - 3) / 5);
  const score = clamp01(0.35 + regularity * 0.45 + countFactor * 0.25);
  return { score, peakCount: peaks.length, meanPeriod };
}

function aspectWeakPrior(width: number, height: number): number {
  const ratio = width / height;
  const candidates = [3 / 2, 2 / 3, 36 / 24, 24 / 36, 1.8, 1 / 1.8];
  let best = Infinity;
  for (const c of candidates) {
    best = Math.min(best, Math.abs(ratio - c));
  }
  if (best < 0.12) return 0.05;
  if (best < 0.22) return 0.02;
  return 0;
}

type AxisAssessment = {
  axis: "horizontal" | "vertical";
  sprocketA: PeriodicityHit;
  sprocketB: PeriodicityHit;
  dualSprocket: boolean;
  rebateBoth: boolean;
  rebateOneSide: boolean;
  shortRebateBoth: boolean;
  shortRebateAny: boolean;
  /** Combined strength used to pick the winning rail axis. */
  strength: number;
};

function assessAxis(
  axis: "horizontal" | "vertical",
  sprocketA: PeriodicityHit,
  sprocketB: PeriodicityHit,
  rebateA: boolean,
  rebateB: boolean,
  shortRebateBoth: boolean,
  shortRebateAny: boolean,
): AxisAssessment {
  const dualSprocket =
    sprocketA.score >= 0.55 &&
    sprocketB.score >= 0.55 &&
    Math.abs(sprocketA.meanPeriod - sprocketB.meanPeriod) <=
      Math.max(sprocketA.meanPeriod, sprocketB.meanPeriod) * 0.35;

  const rebateBoth = rebateA && rebateB;
  const rebateOneSide = (rebateA || rebateB) && !rebateBoth;

  let strength = 0;
  if (dualSprocket) strength += 0.7;
  else strength += Math.max(sprocketA.score, sprocketB.score) * 0.35;
  if (rebateBoth) strength += 0.25;
  else if (rebateOneSide) strength += 0.05;
  if (shortRebateBoth) strength += 0.1;
  else if (shortRebateAny) strength += 0.04;

  return {
    axis,
    sprocketA,
    sprocketB,
    dualSprocket,
    rebateBoth,
    rebateOneSide,
    shortRebateBoth,
    shortRebateAny,
    strength,
  };
}

/**
 * Pure multi-signal film-edge detector over an RGBA buffer.
 * Intended for aggressively downsampled pixels (~256–320px longest edge).
 * Scores both rail axes and reports which one carried the evidence.
 */
export function analyzeFilmEdgePixels(image: PixelBuffer): FilmEdgeDetection {
  const { width, height, data } = image;
  const reasons: string[] = [];
  const imageOrientation = resolveImageOrientation(width, height);

  if (width < 24 || height < 24 || data.length < width * height * 4) {
    return emptyResult(["image-too-small"], 0, imageOrientation);
  }

  const edges = measureEdges(image);
  if (isLetterboxLike(edges)) {
    return emptyResult(["letterbox-like-borders"], 0.12, imageOrientation);
  }

  const rebateTop = isDarkContinuousRebate(edges.top, edges.interior);
  const rebateBottom = isDarkContinuousRebate(edges.bottom, edges.interior);
  const rebateLeft = isDarkContinuousRebate(edges.left, edges.interior);
  const rebateRight = isDarkContinuousRebate(edges.right, edges.interior);

  const sprocketTop = detectSprocketPeriodicity(longEdgeProfile(data, width, height, "top"));
  const sprocketBottom = detectSprocketPeriodicity(
    longEdgeProfile(data, width, height, "bottom"),
  );
  const sprocketLeft = detectSprocketPeriodicity(shortEdgeProfile(data, width, height, "left"));
  const sprocketRight = detectSprocketPeriodicity(
    shortEdgeProfile(data, width, height, "right"),
  );

  const horizontal = assessAxis(
    "horizontal",
    sprocketTop,
    sprocketBottom,
    rebateTop,
    rebateBottom,
    rebateLeft && rebateRight,
    rebateLeft || rebateRight,
  );
  const vertical = assessAxis(
    "vertical",
    sprocketLeft,
    sprocketRight,
    rebateLeft,
    rebateRight,
    rebateTop && rebateBottom,
    rebateTop || rebateBottom,
  );

  // Prefer the axis with stronger sprocket/rebate evidence — not merely image aspect.
  const primary =
    vertical.strength > horizontal.strength + 0.08
      ? vertical
      : horizontal.strength > vertical.strength + 0.08
        ? horizontal
        : imageOrientation === "portrait"
          ? vertical.strength >= horizontal.strength
            ? vertical
            : horizontal
          : horizontal.strength >= vertical.strength
            ? horizontal
            : vertical;

  const { sprocketA, sprocketB, dualSprocket } = primary;
  const longRebateBoth = primary.rebateBoth;
  const shortRebateBoth = primary.shortRebateBoth;
  const shortRebateAny = primary.shortRebateAny;
  const longRebateOneSide = primary.rebateOneSide;

  if (longRebateOneSide && sprocketA.score < 0.5 && sprocketB.score < 0.5) {
    return emptyResult(["one-sided-weak-border"], 0.18, imageOrientation, "unknown");
  }

  let confidence = 0;

  if (dualSprocket) {
    // Matching periodic structure on both rails is the strongest signal.
    confidence += 0.62;
    reasons.push(
      `dual-sprocket-periodicity(${sprocketA.peakCount}+${sprocketB.peakCount})`,
    );
    reasons.push(`rail-axis-${primary.axis}`);
  } else if (sprocketA.score >= 0.6 || sprocketB.score >= 0.6) {
    // One strong rail is suggestive but not sufficient alone.
    confidence += 0.18;
    reasons.push("single-rail-sprocket");
    reasons.push(`rail-axis-${primary.axis}`);
  }

  if (longRebateBoth) {
    confidence += 0.22;
    reasons.push("dual-long-edge-rebate");
  }

  if (shortRebateBoth) {
    confidence += 0.14;
    reasons.push("dual-short-edge-rebate");
  } else if (shortRebateAny && longRebateBoth) {
    confidence += 0.08;
    reasons.push("partial-short-edge-rebate");
  }

  if (edges.interior.meanY > 55 && edges.interior.stdY > 18) {
    confidence += 0.06;
    reasons.push("photographic-interior");
  } else if (longRebateBoth || dualSprocket) {
    confidence -= 0.08;
    reasons.push("flat-or-dark-interior");
  }

  const aspectBoost = aspectWeakPrior(width, height);
  if (aspectBoost > 0) {
    confidence += aspectBoost;
    reasons.push("aspect-weak-prior");
  }

  const genericBlackFrame =
    longRebateBoth &&
    !dualSprocket &&
    sprocketA.score < 0.4 &&
    sprocketB.score < 0.4 &&
    (primary.axis === "horizontal"
      ? edges.top.stdY < 12 && edges.bottom.stdY < 12
      : edges.left.stdY < 12 && edges.right.stdY < 12) &&
    !shortRebateAny;
  if (genericBlackFrame) {
    confidence = Math.min(confidence, 0.4);
    reasons.push("generic-black-border-capped");
  }

  confidence = clamp01(confidence);

  const corroborated =
    dualSprocket ||
    (longRebateBoth && shortRebateAny && confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD) ||
    (longRebateBoth &&
      (sprocketA.score >= 0.5 || sprocketB.score >= 0.5) &&
      confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD);

  const hasFilmBorder =
    corroborated && confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD;

  // Only claim a rail axis when sprocket evidence (or strong dual rebate + sprocket hint) supports it.
  let filmRailAxis: FilmRailAxis = "unknown";
  if (hasFilmBorder) {
    if (dualSprocket || sprocketA.score >= 0.5 || sprocketB.score >= 0.5) {
      filmRailAxis = primary.axis;
    } else if (longRebateBoth && shortRebateAny) {
      // Rebate-only positive: axis follows which pair carried the dual rebate.
      filmRailAxis = primary.axis;
    }
  }

  if (!hasFilmBorder && reasons.length === 0) {
    reasons.push("insufficient-evidence");
  } else if (!hasFilmBorder) {
    reasons.push("below-confidence-threshold");
  }

  return {
    hasFilmBorder,
    confidence,
    reasons,
    imageOrientation,
    filmRailAxis,
  };
}

function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for film-edge detection."));
    image.src = src;
  });
}

/**
 * Browser entry: decode `imageUrl` onto a small canvas and analyze pixels.
 * On failure / non-browser environments, returns a conservative negative.
 */
async function detectFilmEdgeFromUrl(imageUrl: string): Promise<FilmEdgeDetection> {
  if (!imageUrl) {
    return emptyResult(["missing-image-url"]);
  }

  if (typeof document === "undefined" || typeof Image === "undefined") {
    return emptyResult(["detection-unavailable-outside-browser"]);
  }

  try {
    const image = await loadImageElement(imageUrl);
    const naturalW = image.naturalWidth || image.width;
    const naturalH = image.naturalHeight || image.height;
    const orientation = resolveImageOrientation(naturalW, naturalH);
    const { width, height } = fitWithin(naturalW, naturalH, FILM_EDGE_ANALYSIS_MAX);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return emptyResult(["canvas-unavailable"], 0, orientation);
    }

    context.drawImage(image, 0, 0, width, height);
    let pixels: ImageData;
    try {
      pixels = context.getImageData(0, 0, width, height);
    } catch {
      return emptyResult(["canvas-tainted-cors"], 0, orientation);
    }

    return analyzeFilmEdgePixels({
      width: pixels.width,
      height: pixels.height,
      data: pixels.data,
    });
  } catch {
    return emptyResult(["image-load-failed"]);
  }
}
