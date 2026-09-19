/**
 * Shared OCR text normalization (no Tesseract / DOM dependency).
 */

export type OcrResult = {
  text: string;
  /** Average word confidence from Tesseract (0–100), or 0 when empty. */
  confidence: number;
};

/** Collapse whitespace; keep newlines between sparse handwriting lines. */
export function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}
