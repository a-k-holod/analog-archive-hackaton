/**
 * Browser-local OCR via Tesseract.js (WASM + Web Worker).
 * Images never leave the device; no cloud OCR / AI API keys.
 *
 * Pipeline: OCR-specific in-memory preprocess variants → multiple PSM hypotheses
 * → confidence + readability scoring → optional conservative darkroom cleanup.
 * The stored photograph is never modified; OCR text is a derived interpretation.
 *
 * Developer logs: `localStorage.setItem("analog-archive:debug-ocr", "1")` then
 * re-run Read handwriting. Each hypothesis logs variant, size, raw text, scores.
 *
 * First run downloads ~8–12 MB (engine + eng/pol language data) and caches
 * traineddata in IndexedDB. Handwriting accuracy is approximate — suitable
 * for search discovery, not archival transcription.
 */

import { normalizeOcrText, type OcrResult } from "./ocrText.ts";
import { buildPreprocessVariants, grayToRgba, type PreprocessVariant } from "./preprocess.ts";
import {
  isUsableOcrHypothesis,
  pickBestHypothesis,
  scoreOcrHypothesis,
  softenDarkroomOcrText,
  type ScoredOcrHypothesis,
} from "./textQuality.ts";

export type { OcrResult };
export { normalizeOcrText };

export type OcrProgress = {
  status: string;
  progress: number;
  message: string;
};

type ProgressListener = (progress: OcrProgress) => void;

let progressListener: ProgressListener | null = null;
let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

/** Page segmentation modes suited to short handwritten darkroom notes. */
const PAGE_SEG_MODES = ["6", "4", "11"] as const;

function setProgress(status: string, progress: number, detail?: string): void {
  progressListener?.({
    status,
    progress,
    message: detail ?? statusMessage(status, progress),
  });
}

function statusMessage(status: string, progress: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  switch (status) {
    case "loading tesseract core":
      return "Loading reader…";
    case "initializing tesseract":
      return "Starting reader…";
    case "loading language traineddata":
      return `Loading language data… ${pct}%`;
    case "initializing api":
      return "Preparing to read…";
    case "recognizing text":
      return `Reading handwriting… ${pct}%`;
    case "preprocessing":
      return "Preparing photograph for reading…";
    case "scoring":
      return "Choosing clearest reading…";
    default:
      return progress > 0 && progress < 1 ? `Working… ${pct}%` : "Working…";
  }
}

async function getWorker(): Promise<import("tesseract.js").Worker> {
  if (typeof window === "undefined") {
    throw new Error("Local OCR only runs in the browser.");
  }

  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      // eng+pol: Latin alphabet with Polish diacritics (ą ć ę ł ń ó ś ź ż).
      return createWorker(["eng", "pol"], 1, {
        logger: (message) => {
          if (typeof message.status === "string") {
            setProgress(message.status, typeof message.progress === "number" ? message.progress : 0);
          }
        },
      });
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }

  return workerPromise;
}

/**
 * Run local OCR on an image URL or Blob.
 * Safe to call repeatedly; failures leave any prior ocrText unchanged.
 * Preprocessing runs only in memory — the archival photograph is untouched.
 */
export async function extractHandwritingText(
  image: string | Blob,
  onProgress?: ProgressListener,
): Promise<OcrResult> {
  progressListener = onProgress ?? null;
  try {
    setProgress("loading tesseract core", 0);
    const worker = await getWorker();

    setProgress("preprocessing", 0.05, "Preparing photograph for reading…");
    const variants = await prepareOcrVariants(image);

    const hypotheses: ScoredOcrHypothesis[] = [];
    const totalSteps = Math.max(1, variants.length * PAGE_SEG_MODES.length);
    let step = 0;

    for (const variant of variants) {
      const canvas = grayToCanvas(variant.image);
      for (const psm of PAGE_SEG_MODES) {
        step += 1;
        const portion = step / totalSteps;
        setProgress(
          "recognizing text",
          0.1 + portion * 0.85,
          `Reading handwriting… ${Math.round(portion * 100)}%`,
        );

        await worker.setParameters({
          // PSM string values match tesseract.js enum members (SINGLE_BLOCK / COLUMN / SPARSE_TEXT).
          tessedit_pageseg_mode: psm as import("tesseract.js").PSM,
        });

        const { data } = await worker.recognize(canvas);
        const rawText = data.text ?? "";
        const softened = softenDarkroomOcrText(rawText);
        const { qualityScore, readableRatio } = scoreOcrHypothesis(softened, data.confidence ?? 0);
        const hypothesis: ScoredOcrHypothesis = {
          text: softened,
          confidence: softened ? (data.confidence ?? 0) : 0,
          variantId: variant.id,
          pageSegMode: Number(psm),
          qualityScore,
          readableRatio,
        };
        logOcrHypothesis(variant, hypothesis, rawText);
        hypotheses.push(hypothesis);
      }
    }

    setProgress("scoring", 0.97, "Choosing clearest reading…");
    const usable = hypotheses.filter((h) => isUsableOcrHypothesis(h));
    const best = pickBestHypothesis(usable.length > 0 ? usable : hypotheses);
    if (isOcrDebugEnabled()) {
      console.info("[ocr-best]", best ? { ...best, usable: isUsableOcrHypothesis(best) } : null);
    }

    if (!best || !best.text) {
      return { text: "", confidence: 0 };
    }

    return {
      text: best.text,
      confidence: best.confidence,
    };
  } finally {
    progressListener = null;
  }
}

async function prepareOcrVariants(image: string | Blob): Promise<PreprocessVariant[]> {
  const rgba = await loadRgbaImage(image);
  const variants = buildPreprocessVariants(rgba);
  // Cap work: at most 3 variants × 3 PSMs to stay lightweight in-browser.
  return variants.slice(0, 3);
}

async function loadRgbaImage(source: string | Blob): Promise<{
  width: number;
  height: number;
  data: Uint8ClampedArray;
}> {
  if (typeof window === "undefined") {
    throw new Error("Local OCR only runs in the browser.");
  }

  const blob =
    typeof source === "string"
      ? await fetch(source).then((response) => {
          if (!response.ok) {
            throw new Error("Could not load note photograph for OCR.");
          }
          return response.blob();
        })
      : source;

  // Prefer EXIF-aware decode; fall back if the option is unsupported.
  const bitmap = await createImageBitmapWithOrientation(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Could not prepare note photograph for OCR.");
    }
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return {
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
    };
  } finally {
    bitmap.close();
  }
}

async function createImageBitmapWithOrientation(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(blob);
  }
}

/** Enable with `localStorage.setItem("analog-archive:debug-ocr", "1")` or `globalThis.__ANALOG_OCR_DEBUG__ = true`. */
function isOcrDebugEnabled(): boolean {
  const flagged = (globalThis as { __ANALOG_OCR_DEBUG__?: unknown }).__ANALOG_OCR_DEBUG__;
  if (flagged) return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("analog-archive:debug-ocr") === "1";
  } catch {
    return false;
  }
}

function logOcrHypothesis(
  variant: PreprocessVariant,
  hypothesis: ScoredOcrHypothesis,
  rawText: string,
): void {
  if (!isOcrDebugEnabled()) return;
  const compact = hypothesis.text.replace(/\s+/g, "");
  console.info("[ocr-hypothesis]", {
    variant: variant.id,
    width: variant.image.width,
    height: variant.image.height,
    rawText,
    text: hypothesis.text,
    confidence: hypothesis.confidence,
    qualityScore: hypothesis.qualityScore,
    readableRatio: hypothesis.readableRatio,
    compactLength: compact.length,
    usable: isUsableOcrHypothesis(hypothesis),
  });
}

function grayToCanvas(gray: {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}): HTMLCanvasElement {
  const rgba = grayToRgba(gray);
  const canvas = document.createElement("canvas");
  canvas.width = gray.width;
  canvas.height = gray.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not encode OCR preview canvas.");
  }
  const imageData = context.createImageData(gray.width, gray.height);
  imageData.data.set(new Uint8ClampedArray(rgba.data));
  context.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Whether OCR output is worth storing as searchable text.
 * Empty or very low-confidence / garbage readings should not pretend to understand the note.
 * The photograph remains the archival original either way.
 */
export function isUsableOcrResult(result: OcrResult): boolean {
  return isUsableOcrHypothesis(result);
}

export { isUsableOcrHypothesis, softenDarkroomOcrText, scoreOcrHypothesis };
