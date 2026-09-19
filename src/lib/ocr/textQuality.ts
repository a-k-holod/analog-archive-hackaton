/**
 * OCR result quality scoring and conservative darkroom-oriented cleanup.
 * Never invents content — only normalizes obvious OCR confusions in derived text.
 */

import { normalizeOcrText, type OcrResult } from "./ocrText.ts";

export type ScoredOcrHypothesis = OcrResult & {
  variantId: string;
  pageSegMode: number;
  qualityScore: number;
  readableRatio: number;
};

/** Latin letters / digits share of non-space characters (0–1). */
export function readableCharRatio(text: string): number {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return 0;
  let good = 0;
  for (const ch of compact) {
    if (/[A-Za-zÀ-ž0-9]/.test(ch)) {
      good += 1;
    }
  }
  return good / compact.length;
}

/**
 * Heuristic quality score combining Tesseract confidence with text readability.
 * Higher is better. Used to pick among preprocessing / PSM hypotheses.
 */
export function scoreOcrHypothesis(
  text: string,
  confidence: number,
): { qualityScore: number; readableRatio: number } {
  const normalized = normalizeOcrText(text);
  const compact = normalized.replace(/\s+/g, "");
  if (!compact) {
    return { qualityScore: 0, readableRatio: 0 };
  }

  const readableRatio = readableCharRatio(normalized);
  const lengthScore = Math.min(1, compact.length / 24);
  const confScore = Math.max(0, Math.min(1, confidence / 100));

  // Penalize strings that are mostly punctuation / symbols.
  const garbagePenalty = readableRatio < 0.45 ? 0.35 : readableRatio < 0.65 ? 0.12 : 0;

  // Mild bonus when text looks like darkroom notation (does not rewrite text).
  const domainBonus = darkroomPatternBonus(normalized);

  const qualityScore =
    confScore * 0.4 +
    readableRatio * 0.35 +
    lengthScore * 0.15 +
    domainBonus * 0.1 -
    garbagePenalty;

  return {
    qualityScore: Math.max(0, Math.min(1, qualityScore)),
    readableRatio,
  };
}

/**
 * Bonus for recognizable darkroom note shapes (ratios, times, temps).
 * Detection-only — does not alter the string.
 */
export function darkroomPatternBonus(text: string): number {
  let hits = 0;
  if (/\b\d+\s*[:＋+]\s*\d+\b/.test(text)) hits += 1;
  if (/\b\d+\s*(?:min|mins|minutes|sec|s)\b/i.test(text)) hits += 1;
  if (/\b\d+\s*°?\s*[cCfF]\b/.test(text) || /\b\d+\s*degrees?\b/i.test(text)) hits += 1;
  if (/\b(?:iso|asa)\s*\d+\b/i.test(text) || /\b\d+\s*(?:iso|asa)\b/i.test(text)) hits += 1;
  if (
    /\b(?:rodinal|d[- ]?76|hc[- ]?110|xtol|dd[- ]?x|ilford|kodak|fomapan|trix|hp5|delta|tmax|rodinal)\b/i.test(
      text,
    )
  ) {
    hits += 1;
  }
  return Math.min(1, hits / 3);
}

export function pickBestHypothesis(hypotheses: ScoredOcrHypothesis[]): ScoredOcrHypothesis | null {
  if (hypotheses.length === 0) return null;
  let best = hypotheses[0]!;
  for (let i = 1; i < hypotheses.length; i += 1) {
    const h = hypotheses[i]!;
    if (h.qualityScore > best.qualityScore + 0.02) {
      best = h;
      continue;
    }
    // Near-ties: prefer higher readable ratio, then confidence.
    if (Math.abs(h.qualityScore - best.qualityScore) <= 0.02) {
      if (h.readableRatio > best.readableRatio + 0.05) {
        best = h;
      } else if (
        Math.abs(h.readableRatio - best.readableRatio) <= 0.05 &&
        h.confidence > best.confidence
      ) {
        best = h;
      }
    }
  }
  return best;
}

/**
 * Conservative cleanup of common OCR misreads in darkroom notes.
 * Only applies high-confidence pattern fixes; never substitutes free vocabulary.
 */
export function softenDarkroomOcrText(raw: string): string {
  let text = normalizeOcrText(raw);
  if (!text) return "";

  // Dilution separators: 1;25 / 1/25 / 1＋25 → 1:25 or 1+25 when clearly a ratio.
  text = text.replace(/\b(\d{1,3})\s*[;／/]\s*(\d{1,3})\b/g, "$1:$2");
  text = text.replace(/\b(\d{1,3})\s*＋\s*(\d{1,3})\b/g, "$1+$2");

  // Temperature: 20oC / 20ºC / 20 deg C → 20°C
  text = text.replace(/\b(\d{1,3})\s*(?:°|º|˚|o|O)\s*([cCfF])\b/g, "$1°$2");
  text = text.replace(/\b(\d{1,3})\s*(?:deg|degrees?)\s*([cCfF])\b/gi, (_, n, u) => `${n}°${u.toUpperCase() === "F" ? "F" : "C"}`);

  // Time: 15rnin / 15rnin / 15 mn → 15min (only clear rn→m confusion)
  text = text.replace(/\b(\d{1,3})\s*rnin\b/gi, "$1min");
  text = text.replace(/\b(\d{1,3})\s*rnins\b/gi, "$1mins");
  text = text.replace(/\b(\d{1,3})\s*m1n\b/gi, "$1min");
  text = text.replace(/\b(\d{1,3})\s*mn\b/gi, "$1min");

  // Developer: Rodina1 / R0dinal when almost Rodinal (single known brand, high specificity)
  text = text.replace(/\b[Rr]odina1\b/g, "Rodinal");
  text = text.replace(/\bR0dinal\b/g, "Rodinal");
  text = text.replace(/\b[Rr]odinai\b/g, "Rodinal");

  return normalizeOcrText(text);
}

/**
 * Whether a hypothesis is worth presenting / persisting.
 * Prefers readable text over high-confidence punctuation garbage.
 */
export function isUsableOcrHypothesis(result: {
  text: string;
  confidence: number;
  qualityScore?: number;
  readableRatio?: number;
}): boolean {
  const text = normalizeOcrText(result.text);
  if (!text) return false;

  const compact = text.replace(/\s+/g, "");
  if (compact.length < 3) return false;

  const readableRatio = result.readableRatio ?? readableCharRatio(text);
  if (readableRatio < 0.4) return false;

  // Very low Tesseract confidence with short text is usually noise.
  if (result.confidence > 0 && result.confidence < 28 && compact.length < 12) {
    return false;
  }

  if (typeof result.qualityScore === "number" && result.qualityScore < 0.22) {
    return false;
  }

  return true;
}
