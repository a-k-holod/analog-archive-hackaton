/**
 * OCR-only image preprocessing for photographed handwritten notes.
 * Operates on in-memory grayscale buffers — never mutates stored originals.
 */

export type GrayImage = {
  width: number;
  height: number;
  /** Row-major luminance, 0 (black) … 255 (white). */
  pixels: Uint8ClampedArray;
};

export type PreprocessVariantId =
  | "contrast"
  | "adaptive"
  | "grid_suppressed"
  | "upscaled_contrast";

export type PreprocessVariant = {
  id: PreprocessVariantId;
  label: string;
  image: GrayImage;
  /** True when a regular grid was detected and softened. */
  gridRemoved: boolean;
};

export type RgbaImage = {
  width: number;
  height: number;
  /** RGBA length = width * height * 4 */
  data: Uint8ClampedArray;
};

const TARGET_MIN_EDGE = 900;
const MAX_EDGE = 1600;

/** Convert RGBA into luminance grayscale. */
export function rgbaToGray(rgba: RgbaImage): GrayImage {
  const { width, height, data } = rgba;
  const pixels = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    pixels[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return { width, height, pixels };
}

/** Encode grayscale as opaque RGBA (for canvas / Tesseract). */
export function grayToRgba(gray: GrayImage): RgbaImage {
  const { width, height, pixels } = gray;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 1) {
    const v = pixels[i]!;
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  return { width, height, data };
}

export function cloneGray(gray: GrayImage): GrayImage {
  return {
    width: gray.width,
    height: gray.height,
    pixels: new Uint8ClampedArray(gray.pixels),
  };
}

/** Percentile-based contrast stretch toward full range. */
export function stretchContrast(gray: GrayImage, lowPct = 2, highPct = 98): GrayImage {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.pixels.length; i += 1) {
    hist[gray.pixels[i]!]! += 1;
  }

  const total = gray.pixels.length;
  const lowCount = (total * lowPct) / 100;
  const highCount = (total * highPct) / 100;
  let low = 0;
  let high = 255;
  let seen = 0;
  for (let v = 0; v < 256; v += 1) {
    seen += hist[v]!;
    if (seen >= lowCount) {
      low = v;
      break;
    }
  }
  seen = 0;
  for (let v = 0; v < 256; v += 1) {
    seen += hist[v]!;
    if (seen >= highCount) {
      high = v;
      break;
    }
  }

  if (high <= low + 8) {
    return cloneGray(gray);
  }

  const scale = 255 / (high - low);
  const pixels = new Uint8ClampedArray(gray.pixels.length);
  for (let i = 0; i < gray.pixels.length; i += 1) {
    pixels[i] = Math.max(0, Math.min(255, Math.round((gray.pixels[i]! - low) * scale)));
  }
  return { width: gray.width, height: gray.height, pixels };
}

/** Light 3×3 box blur — softens photographic noise without erasing strokes. */
export function softenNoise(gray: GrayImage): GrayImage {
  const { width, height, pixels } = gray;
  const out = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += pixels[yy * width + xx]!;
          count += 1;
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return { width, height, pixels: out };
}

/**
 * Crop near-uniform margins when a darker document region is obvious.
 * Conservative: requires a clear content bbox; otherwise returns the input.
 */
export function cropDocumentMargins(gray: GrayImage, pad = 8): GrayImage {
  const { width, height, pixels } = gray;
  if (width < 40 || height < 40) {
    return cloneGray(gray);
  }

  let sum = 0;
  for (let i = 0; i < pixels.length; i += 1) {
    sum += pixels[i]!;
  }
  const mean = sum / pixels.length;
  // Ink / content is darker than paper; threshold sits below mean.
  const threshold = Math.max(40, Math.min(220, mean - 18));

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let dark = 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (pixels[row + x]! < threshold) {
        dark += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const area = width * height;
  if (dark < area * 0.004 || maxX <= minX || maxY <= minY) {
    return cloneGray(gray);
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  // Skip crop when content already fills most of the frame.
  if (contentW * contentH > area * 0.82) {
    return cloneGray(gray);
  }

  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(width - 1, maxX + pad);
  const y1 = Math.min(height - 1, maxY + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 24 || h < 24) {
    return cloneGray(gray);
  }

  const cropped = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y += 1) {
    const src = (y0 + y) * width + x0;
    cropped.set(pixels.subarray(src, src + w), y * w);
  }
  return { width: w, height: h, pixels: cropped };
}

/** Nearest-neighbor scale (deterministic, stroke-preserving for upscales). */
export function scaleGray(gray: GrayImage, scale: number): GrayImage {
  if (scale === 1 || !Number.isFinite(scale) || scale <= 0) {
    return cloneGray(gray);
  }
  const width = Math.max(1, Math.round(gray.width * scale));
  const height = Math.max(1, Math.round(gray.height * scale));
  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(gray.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(gray.width - 1, Math.floor(x / scale));
      pixels[y * width + x] = gray.pixels[sy * gray.width + sx]!;
    }
  }
  return { width, height, pixels };
}

export function ensureReadableScale(gray: GrayImage): GrayImage {
  const minEdge = Math.min(gray.width, gray.height);
  const maxEdge = Math.max(gray.width, gray.height);
  let scale = 1;
  if (minEdge < TARGET_MIN_EDGE) {
    scale = TARGET_MIN_EDGE / minEdge;
  }
  if (maxEdge * scale > MAX_EDGE) {
    scale = MAX_EDGE / maxEdge;
  }
  if (scale < 1.05) {
    return cloneGray(gray);
  }
  return scaleGray(gray, scale);
}

/**
 * Sauvola-style adaptive threshold → binary (ink black / paper white).
 * Window must be odd and >= 3.
 */
export function adaptiveThreshold(gray: GrayImage, windowSize = 31, k = 0.28): GrayImage {
  const wSize = Math.max(3, windowSize | 1);
  const { width, height, pixels } = gray;
  const integral = buildIntegral(pixels, width, height);
  const half = (wSize - 1) >> 1;
  const out = new Uint8ClampedArray(pixels.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - half);
      const y0 = Math.max(0, y - half);
      const x1 = Math.min(width - 1, x + half);
      const y1 = Math.min(height - 1, y + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = rectSum(integral, width, x0, y0, x1, y1);
      const mean = sum / area;
      // Approximate std via mean absolute deviation proxy using global R=128.
      const threshold = mean * (1 + k * (mean / 128 - 1));
      const v = pixels[y * width + x]!;
      out[y * width + x] = v < threshold ? 0 : 255;
    }
  }

  return { width, height, pixels: out };
}

function buildIntegral(pixels: Uint8ClampedArray, width: number, height: number): Float64Array {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += pixels[(y - 1) * width + (x - 1)]!;
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x]! + rowSum;
    }
  }
  return integral;
}

function rectSum(
  integral: Float64Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const stride = width + 1;
  const A = integral[y0 * stride + x0]!;
  const B = integral[y0 * stride + (x1 + 1)]!;
  const C = integral[(y1 + 1) * stride + x0]!;
  const D = integral[(y1 + 1) * stride + (x1 + 1)]!;
  return D - B - C + A;
}

export type GridDetection = {
  rowMask: Uint8Array;
  colMask: Uint8Array;
  periodY: number;
  periodX: number;
  confidence: number;
};

/**
 * Detect regular graph-paper lines via row/column darkness + periodic spacing.
 * Returns null when spacing is irregular or confidence is low (caller keeps handwriting).
 */
export function detectGridLines(gray: GrayImage): GridDetection | null {
  const { width, height, pixels } = gray;
  if (width < 48 || height < 48) {
    return null;
  }

  const rowMean = new Float64Array(height);
  const colMean = new Float64Array(width);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      sum += pixels[row + x]!;
    }
    rowMean[y] = sum / width;
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = 0; y < height; y += 1) {
      sum += pixels[y * width + x]!;
    }
    colMean[x] = sum / height;
  }

  const maxPeriodY = Math.min(96, Math.max(24, Math.floor(height / 3)));
  const maxPeriodX = Math.min(96, Math.max(24, Math.floor(width / 3)));
  const rows = pickPeriodicDarkLines(rowMean, 6, maxPeriodY);
  const cols = pickPeriodicDarkLines(colMean, 6, maxPeriodX);

  if (!rows || !cols) {
    return null;
  }

  // Both axes should look like a grid; require moderate agreement.
  const confidence = Math.min(rows.confidence, cols.confidence);
  if (confidence < 0.55) {
    return null;
  }

  const rowMask = new Uint8Array(height);
  for (const i of rows.indices) {
    rowMask[i] = 1;
    if (i > 0) rowMask[i - 1] = 1;
    if (i + 1 < height) rowMask[i + 1] = 1;
  }
  const colMask = new Uint8Array(width);
  for (const i of cols.indices) {
    colMask[i] = 1;
    if (i > 0) colMask[i - 1] = 1;
    if (i + 1 < width) colMask[i + 1] = 1;
  }

  return {
    rowMask,
    colMask,
    periodY: rows.period,
    periodX: cols.period,
    confidence,
  };
}

/**
 * Soften thin grid lines while preserving darker handwriting strokes that cross them.
 * If detection is uncertain, returns the input unchanged and gridRemoved=false.
 */
export function suppressGridLines(gray: GrayImage): { image: GrayImage; gridRemoved: boolean; confidence: number } {
  const detection = detectGridLines(gray);
  if (!detection) {
    return { image: cloneGray(gray), gridRemoved: false, confidence: 0 };
  }

  const { width, height, pixels } = gray;
  const { rowMask, colMask } = detection;
  const out = new Uint8ClampedArray(pixels);

  // Estimate typical paper brightness from non-grid samples.
  let paperSum = 0;
  let paperCount = 0;
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      if (rowMask[y] || colMask[x]) continue;
      paperSum += pixels[y * width + x]!;
      paperCount += 1;
    }
  }
  const paper = paperCount > 0 ? paperSum / paperCount : 240;

  // Grid ink is usually only moderately darker than paper; handwriting is darker.
  const gridCeiling = paper - 12;
  const strokeFloor = paper - 70;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!rowMask[y] && !colMask[x]) continue;
      const i = y * width + x;
      const v = pixels[i]!;
      // Keep strong ink (handwriting).
      if (v < strokeFloor) continue;
      // Only lighten mid-gray grid marks.
      if (v > gridCeiling) continue;
      out[i] = Math.round(v * 0.25 + paper * 0.75);
    }
  }

  return {
    image: { width, height, pixels: out },
    gridRemoved: true,
    confidence: detection.confidence,
  };
}

type PeriodicLines = {
  indices: number[];
  period: number;
  confidence: number;
};

/**
 * Find darker-than-local lines that recur at a stable period.
 * Pure / deterministic — used by tests with synthetic grid images.
 */
export function pickPeriodicDarkLines(
  means: ArrayLike<number>,
  minPeriod: number,
  maxPeriod: number,
): PeriodicLines | null {
  const n = means.length;
  if (n < minPeriod * 3) {
    return null;
  }

  let globalSum = 0;
  for (let i = 0; i < n; i += 1) {
    globalSum += means[i]!;
  }
  const globalMean = globalSum / n;

  // Candidate dark lines: locally darker than neighbors and below global mean.
  const candidates: number[] = [];
  for (let i = 1; i < n - 1; i += 1) {
    const v = means[i]!;
    if (v >= globalMean - 2) continue;
    if (v <= means[i - 1]! && v <= means[i + 1]!) {
      candidates.push(i);
    }
  }

  if (candidates.length < 4) {
    return null;
  }

  let best: PeriodicLines | null = null;

  for (let period = minPeriod; period <= maxPeriod; period += 1) {
    // Score: how many candidates fall near multiples of `period` from a phase.
    for (let phase = 0; phase < period; phase += 1) {
      const hits: number[] = [];
      for (const c of candidates) {
        const rem = ((c - phase) % period + period) % period;
        if (rem <= 1 || rem >= period - 1) {
          hits.push(c);
        }
      }
      const expected = Math.floor((n - phase) / period);
      if (expected < 4 || hits.length < Math.max(4, Math.floor(expected * 0.55))) {
        continue;
      }
      // Spacing consistency among hits — prefer gaps near the candidate period.
      hits.sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < hits.length; i += 1) {
        const gap = hits[i]! - hits[i - 1]!;
        // Ignore multi-period skips when scoring regularity.
        if (gap <= period * 1.6) {
          gaps.push(gap);
        }
      }
      if (gaps.length < 3) continue;
      const gapMean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (Math.abs(gapMean - period) > period * 0.25) continue;
      if (gapMean < minPeriod * 0.7 || gapMean > maxPeriod * 1.3) continue;
      let varSum = 0;
      for (const g of gaps) {
        varSum += (g - gapMean) ** 2;
      }
      const gapStd = Math.sqrt(varSum / gaps.length);
      const regularity = Math.max(0, 1 - gapStd / Math.max(gapMean, 1));
      if (regularity < 0.65) continue;
      const coverage = Math.min(1, hits.length / expected);
      if (coverage < 0.5) continue;
      const confidence = regularity * 0.65 + coverage * 0.35;
      if (!best || confidence > best.confidence) {
        best = { indices: hits, period, confidence };
      }
    }
  }

  return best && best.confidence >= 0.5 ? best : null;
}

/**
 * Build a small set of OCR preprocessing variants from an RGBA photograph.
 * Always includes a safe contrast-enhanced path; grid suppression is optional.
 * Grid detection runs before upscaling so cell period stays within detector range.
 */
export function buildPreprocessVariants(rgba: RgbaImage): PreprocessVariant[] {
  const base = rgbaToGray(rgba);
  const cropped = cropDocumentMargins(base);
  // Stretch without blur first so thin graph lines stay measurable.
  const crisp = stretchContrast(cropped);
  const grid = suppressGridLines(crisp);
  const contrast = stretchContrast(softenNoise(grid.gridRemoved ? grid.image : cropped));
  const scaled = ensureReadableScale(contrast);

  const variants: PreprocessVariant[] = [
    {
      id: "contrast",
      label: "Contrast enhanced",
      // Safe baseline: never depends on grid removal succeeding.
      image: ensureReadableScale(stretchContrast(softenNoise(cropped))),
      gridRemoved: false,
    },
  ];

  variants.push({
    id: "adaptive",
    label: "Adaptive threshold",
    image: adaptiveThreshold(ensureReadableScale(stretchContrast(softenNoise(cropped))), 31, 0.28),
    gridRemoved: false,
  });

  if (grid.gridRemoved) {
    variants.push({
      id: "grid_suppressed",
      label: "Grid suppressed",
      image: scaled,
      gridRemoved: true,
    });
    variants.push({
      id: "upscaled_contrast",
      label: "Grid suppressed + adaptive",
      image: adaptiveThreshold(scaled, 31, 0.22),
      gridRemoved: true,
    });
  } else {
    const boost = scaleGray(scaled, 1.35);
    if (boost.width !== scaled.width || boost.height !== scaled.height) {
      variants.push({
        id: "upscaled_contrast",
        label: "Upscaled contrast",
        image: stretchContrast(boost),
        gridRemoved: false,
      });
    }
  }

  return variants;
}
