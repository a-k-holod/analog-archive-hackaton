import {
  formatFilmStockEdgeLabel,
  formatFrameNumber,
  resolveAnalogFrameLayout,
  type AnalogFrameLayout,
  type ImageAspectOrientation,
} from "./analogFrame.ts";
import {
  adjacentFrameId,
  canNavigateNext,
  canNavigatePrevious,
  findFrameIndex,
} from "./frames.ts";
import type { Frame } from "./types.ts";

/**
 * Gallery film-frame toggle — Off/On only (no Auto).
 * Default Off matches the least-intrusive clean photograph viewer.
 */
export type ViewerFilmFrameMode = "off" | "on";

export const VIEWER_FILM_FRAME_MODES: readonly ViewerFilmFrameMode[] = ["off", "on"];

export const DEFAULT_VIEWER_FILM_FRAME_MODE: ViewerFilmFrameMode = "off";

/** Whether the decorative AnalogFrame treatment should render. */
export function shouldShowViewerFilmFrame(mode: ViewerFilmFrameMode): boolean {
  return mode === "on";
}

/**
 * Presentation props for the gallery photograph surface.
 * Passthrough only — never rewrites `imageUrl`, `frameId`, or `frameNumber`.
 */
export type ViewerFilmFramePresentation = {
  mode: ViewerFilmFrameMode;
  showFrame: boolean;
  /**
   * When On without a known orientation, omit layout so AnalogFrame measures
   * natural dimensions (same as contact-sheet On).
   */
  layout: AnalogFrameLayout | undefined;
  imageUrl: string | null | undefined;
  frameId: string;
  frameNumber: number;
  filmStockLabel: string | null;
};

export function resolveViewerFilmFramePresentation(input: {
  mode: ViewerFilmFrameMode;
  imageUrl: string | null | undefined;
  frameId: string;
  frameNumber: number;
  filmStock?: string | null;
  iso?: string | null;
  /** When known (e.g. tests), resolve orientation-aware layout explicitly. */
  imageOrientation?: ImageAspectOrientation | null;
}): ViewerFilmFramePresentation {
  const showFrame = shouldShowViewerFilmFrame(input.mode);
  const layout =
    showFrame && input.imageOrientation
      ? resolveAnalogFrameLayout({
          imageOrientation: input.imageOrientation,
          filmRailAxis: "unknown",
          hasFilmBorder: false,
        })
      : undefined;

  return {
    mode: input.mode,
    showFrame,
    layout,
    imageUrl: input.imageUrl,
    frameId: input.frameId,
    frameNumber: input.frameNumber,
    filmStockLabel: formatFilmStockEdgeLabel(input.filmStock, input.iso),
  };
}

/**
 * Quiet inspect affordance for the gallery photograph.
 * Cursor + restrained hover — no overlay copy.
 */
export function viewerPhotographInspectClassName(): string {
  return [
    "cursor-zoom-in",
    "transition-[filter,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
    "hover:brightness-[1.035] hover:contrast-[1.02]",
    "active:brightness-[1.02]",
  ].join(" ");
}

/** Accessible name for opening the source scan. */
export function viewerPhotographInspectLabel(frameNumber: number): string {
  return `Inspect frame ${formatFrameNumber(frameNumber)}`;
}

/** Minimum horizontal travel (px) before a touch gesture counts as a swipe. */
export const VIEWER_SWIPE_THRESHOLD_PX = 56;

/** Reject swipes that are mostly vertical (scrolling metadata). */
export const VIEWER_SWIPE_AXIS_RATIO = 1.35;

export type ViewerNavDirection = "previous" | "next";

export type ViewerFramePosition = {
  index: number;
  total: number;
  frameNumber: number;
  /** e.g. "FRAME 08 / 18" */
  counterLabel: string;
  hasPrevious: boolean;
  hasNext: boolean;
  previousFrameNumber: number | null;
  nextFrameNumber: number | null;
};

/**
 * Position of the open frame within its roll sequence.
 * Navigation stays constrained to `frames` (the current roll).
 */
export function resolveViewerFramePosition(
  frames: readonly Frame[],
  frameId: string,
): ViewerFramePosition | null {
  const index = findFrameIndex(frames, frameId);
  if (index < 0) {
    return null;
  }

  const frame = frames[index]!;
  const total = frames.length;
  const previous = index > 0 ? frames[index - 1]! : null;
  const next = index < total - 1 ? frames[index + 1]! : null;

  return {
    index,
    total,
    frameNumber: frame.number,
    counterLabel: formatViewerCounter(frame.number, total),
    hasPrevious: canNavigatePrevious(frames, frameId),
    hasNext: canNavigateNext(frames, frameId),
    previousFrameNumber: previous?.number ?? null,
    nextFrameNumber: next?.number ?? null,
  };
}

/** Archive counter: FRAME 08 / 18 */
export function formatViewerCounter(frameNumber: number, total: number): string {
  return `FRAME ${formatFrameNumber(frameNumber)} / ${String(total).padStart(2, "0")}`;
}

/**
 * Accessible label for previous/next controls.
 * Example: "Previous frame, frame 7"
 */
export function viewerNavAriaLabel(
  direction: ViewerNavDirection,
  adjacentFrameNumber: number | null,
): string {
  if (adjacentFrameNumber === null) {
    return direction === "previous" ? "Previous frame" : "Next frame";
  }
  const word = direction === "previous" ? "Previous" : "Next";
  return `${word} frame, frame ${adjacentFrameNumber}`;
}

/**
 * Resolve the next frame id for a navigation intent within the roll.
 * Returns null at boundaries or when the current frame is missing.
 */
export function resolveViewerNavigation(
  frames: readonly Frame[],
  frameId: string,
  direction: ViewerNavDirection,
): string | null {
  return adjacentFrameId(frames, frameId, direction);
}

/**
 * Image URLs for the current frame and immediate neighbours.
 * Used to warm the browser cache without preloading the whole archive.
 */
export function adjacentViewerImageUrls(
  frames: readonly Frame[],
  frameId: string,
): string[] {
  const index = findFrameIndex(frames, frameId);
  if (index < 0) {
    return [];
  }

  const urls: string[] = [];
  for (const offset of [-1, 0, 1] as const) {
    const frame = frames[index + offset];
    if (frame?.imageUrl) {
      urls.push(frame.imageUrl);
    }
  }
  return urls;
}

export type ViewerSwipeIntent = ViewerNavDirection | null;

/**
 * Map a completed touch gesture to previous/next (or null).
 * Does not animate — keyboard navigation remains authoritative.
 */
export function resolveViewerSwipe(
  deltaX: number,
  deltaY: number,
  thresholdPx: number = VIEWER_SWIPE_THRESHOLD_PX,
): ViewerSwipeIntent {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < thresholdPx) {
    return null;
  }
  if (absX < absY * VIEWER_SWIPE_AXIS_RATIO) {
    return null;
  }
  // Finger moves right → reveal previous (as if pulling the strip).
  return deltaX > 0 ? "previous" : "next";
}

export type ViewerKeyboardAction = "close" | "cancel-edit" | ViewerNavDirection | null;

/**
 * Pure keyboard mapping for the gallery (Escape / arrows).
 * Editing suppresses arrow navigation; Escape cancels edit first.
 */
export function resolveViewerKeyboardAction(
  key: string,
  options: { editing: boolean },
): ViewerKeyboardAction {
  if (key === "Escape") {
    return options.editing ? "cancel-edit" : "close";
  }
  if (options.editing) {
    return null;
  }
  if (key === "ArrowLeft") {
    return "previous";
  }
  if (key === "ArrowRight") {
    return "next";
  }
  return null;
}

/** Restrained caption/meta lines shown under the photograph. */
export type ViewerMetaPresentation = {
  caption: string;
  stockLine: string;
  location: string;
  exposureLine: string;
};

export function buildViewerMetaPresentation(input: {
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
  filmStock: string;
  camera: string;
}): ViewerMetaPresentation {
  const stockLine = [input.filmStock || null, input.camera || null].filter(Boolean).join(" · ");
  const exposureLine = [input.aperture || null, input.shutterSpeed || null]
    .filter(Boolean)
    .join(" · ");

  return {
    caption: input.caption.trim() || "Untitled",
    stockLine,
    location: input.location.trim(),
    exposureLine,
  };
}
