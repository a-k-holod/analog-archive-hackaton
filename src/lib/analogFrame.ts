/**
 * Contact-sheet analog presentation mode.
 * Presentation only — never mutates stored photographs or Storage URLs.
 */

export type AnalogFrameMode = "off" | "auto" | "on";

export const ANALOG_FRAME_MODES: readonly AnalogFrameMode[] = ["off", "auto", "on"];

/** Result shape for a future film-edge / sprocket helper. */
export type FilmEdgeDetection = {
  /** True only when a film rebate/border is confidently present. */
  hasFilmBorder: boolean;
};

export type ResolveAnalogFrameOptions = {
  /**
   * Optional detection result for Auto mode.
   * Omit or pass null until `detectFilmEdge()` (or similar) exists.
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
 * Future hook for conservative film-edge detection.
 * Not implemented in this iteration — always returns no border so Auto stays off.
 * Plug a real detector here later without changing contact-sheet UI architecture.
 */
export async function detectFilmEdge(imageUrl: string): Promise<FilmEdgeDetection> {
  void imageUrl;
  return { hasFilmBorder: false };
}

export function formatFrameNumber(frameNumber: number): string {
  return String(frameNumber).padStart(2, "0");
}

export type ContactSheetCellPresentation = {
  showFrame: boolean;
  /** Passthrough — never rewritten by presentation logic. */
  imageUrl: string | null | undefined;
  frameNumberLabel: string;
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
}): ContactSheetCellPresentation {
  return {
    showFrame: shouldShowAnalogFrame(input.mode, { detection: input.detection }),
    imageUrl: input.imageUrl,
    frameNumberLabel: formatFrameNumber(input.frameNumber),
  };
}
