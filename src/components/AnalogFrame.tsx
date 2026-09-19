"use client";

import {
  formatFilmStockEdgeLabel,
  formatFrameNumber,
  resolveAnalogFrameLayout,
  resolveImageOrientation,
  resolveRebateLabelPlacement,
  type AnalogFrameLayout,
  type ImageAspectOrientation,
} from "@/lib/analogFrame";
import { useState, type SyntheticEvent } from "react";

type AnalogFrameProps = {
  imageUrl: string | null | undefined;
  frameNumber: number;
  /** When true, render the decorative film rebate + sprockets. */
  showFrame: boolean;
  /**
   * Preferred layout from detection / parent.
   * When omitted, layout is derived from the image's natural dimensions on load.
   */
  layout?: AnalogFrameLayout;
  /** Roll film stock from archive metadata — presentation only. */
  filmStock?: string | null;
  /** Roll ISO from archive metadata — presentation only. */
  iso?: string | null;
  alt?: string;
  /**
   * Contact sheet uses archival grayscale; gallery keeps natural photograph color.
   * Default preserves existing contact-sheet appearance.
   */
  imageTone?: "archival" | "natural";
  /**
   * sheet — fixed aspect gates for contact-sheet cells (default)
   * gallery — fill available space under parent max constraints
   */
  surface?: "sheet" | "gallery";
  /** Extra classes on the photograph (e.g. gallery inspect hover). */
  imageClassName?: string;
  /** When set, the photograph itself is an inspect link (not the sprocket rails). */
  inspectHref?: string | null;
  inspectLabel?: string;
};

/**
 * Analog film-edge presentation shared by contact sheet and photograph gallery.
 * Decorative only — `imageUrl` is passed through unchanged; no cropping of the source file.
 * Sprocket rails follow image orientation (or detector rail axis via `layout`).
 * Film stock / ISO markings use archive metadata in the rebate — never over the photograph.
 */
export function AnalogFrame({
  imageUrl,
  frameNumber,
  showFrame,
  layout: layoutProp,
  filmStock,
  iso,
  alt = "",
  imageTone = "archival",
  surface = "sheet",
  imageClassName = "",
  inspectHref = null,
  inspectLabel,
}: AnalogFrameProps) {
  const numberLabel = formatFrameNumber(frameNumber);
  const stockLabel = formatFilmStockEdgeLabel(filmStock, iso);
  const [orientation, setOrientation] = useState<ImageAspectOrientation | null>(null);
  const photoClassName = [
    surface === "gallery" ? "max-h-full max-w-full object-contain" : "h-full w-full object-contain",
    imageTone === "archival" ? "grayscale" : "",
    imageClassName,
  ]
    .filter(Boolean)
    .join(" ");

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    setOrientation(resolveImageOrientation(img.naturalWidth, img.naturalHeight));
  }

  function renderPhotograph(url: string) {
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        onLoad={handleImageLoad}
        className={photoClassName}
        draggable={false}
      />
    );
    if (!inspectHref) {
      return image;
    }
    return (
      <a
        href={inspectHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={inspectLabel ?? `Inspect frame ${numberLabel}`}
        className="block h-full w-full outline-offset-4 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#8a9bb0]"
      >
        {image}
      </a>
    );
  }

  const measuredLayout =
    orientation !== null
      ? resolveAnalogFrameLayout({
          imageOrientation: orientation,
          filmRailAxis: "unknown",
          hasFilmBorder: false,
        })
      : null;

  const layout = layoutProp ?? measuredLayout;
  const gateOrientation: ImageAspectOrientation = orientation ?? "landscape";

  if (!showFrame) {
    return (
      <figure className="bg-black" data-analog-frame="off" data-frame-layout={layout ?? "none"}>
        <div className={gateClass(gateOrientation, surface)}>
          {imageUrl ? renderPhotograph(imageUrl) : <EmptyCell />}
        </div>
        {surface === "sheet" ? (
          <figcaption className="px-1 py-1 text-center text-[0.65rem] text-[#b7b19f]">
            {numberLabel}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  // Wait for natural dimensions before inventing sprocket placement (On mode).
  if (layout === null) {
    return (
      <figure className="bg-[#0c0d0f]" data-analog-frame="pending" data-frame-number={numberLabel}>
        <div className={`relative bg-[#050505] ${gateClass("landscape", surface)}`}>
          {imageUrl ? renderPhotograph(imageUrl) : <EmptyCell />}
        </div>
        <RebateCaption
          layout="restrained"
          stockLabel={stockLabel}
          frameLabel={numberLabel}
        />
      </figure>
    );
  }

  if (layout === "vertical") {
    return (
      <figure
        className={
          surface === "gallery"
            ? "flex max-h-full max-w-full overflow-hidden bg-[#0c0d0f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            : "flex overflow-hidden bg-[#0c0d0f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        }
        data-analog-frame="on"
        data-frame-layout="vertical"
        data-rebate-label={resolveRebateLabelPlacement("vertical")}
        data-frame-number={numberLabel}
        data-film-stock={stockLabel ?? undefined}
      >
        <SprocketRail orientation="vertical" surface={surface} />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div
            className={`relative mx-px bg-[#050505] ${
              surface === "gallery" ? "my-[6%]" : "my-[5%]"
            } ${gateClass("portrait", surface)}`}
          >
            <GateEdge />
            {imageUrl ? renderPhotograph(imageUrl) : <EmptyCell />}
          </div>
        </div>
        <VerticalRebateLabel stockLabel={stockLabel} frameLabel={numberLabel} surface={surface} />
        <SprocketRail orientation="vertical" surface={surface} />
      </figure>
    );
  }

  if (layout === "restrained") {
    return (
      <figure
        className={
          surface === "gallery"
            ? "max-h-full max-w-full overflow-hidden bg-[#0c0d0f] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            : "overflow-hidden bg-[#0c0d0f] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        }
        data-analog-frame="on"
        data-frame-layout="restrained"
        data-rebate-label={resolveRebateLabelPlacement("restrained")}
        data-frame-number={numberLabel}
        data-film-stock={stockLabel ?? undefined}
      >
        <div
          className={`relative bg-[#050505] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ${gateClass(
            orientation ?? "square",
            surface,
          )}`}
        >
          {imageUrl ? renderPhotograph(imageUrl) : <EmptyCell />}
        </div>
        <RebateCaption
          layout="restrained"
          stockLabel={stockLabel}
          frameLabel={numberLabel}
        />
      </figure>
    );
  }

  // Horizontal — classic top/bottom sprocket rails
  return (
    <figure
      className={
        surface === "gallery"
          ? "max-h-full max-w-full overflow-hidden bg-[#0c0d0f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
          : "overflow-hidden bg-[#0c0d0f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      }
      data-analog-frame="on"
      data-frame-layout="horizontal"
      data-rebate-label={resolveRebateLabelPlacement("horizontal")}
      data-frame-number={numberLabel}
      data-film-stock={stockLabel ?? undefined}
    >
      <SprocketRail orientation="horizontal" surface={surface} />
      <div className={`relative mx-[7%] bg-[#050505] ${gateClass("landscape", surface)}`}>
        <GateEdge />
        {imageUrl ? renderPhotograph(imageUrl) : <EmptyCell />}
      </div>
      <RebateCaption
        layout="horizontal"
        stockLabel={stockLabel}
        frameLabel={numberLabel}
      />
      <SprocketRail orientation="horizontal" surface={surface} />
    </figure>
  );
}

function gateClass(orientation: ImageAspectOrientation, surface: "sheet" | "gallery"): string {
  const aspect = gateAspectClass(orientation);
  if (surface === "gallery") {
    return `${aspect} max-h-[min(64vh,calc(100dvh-15rem))] w-auto max-w-full`;
  }
  return aspect;
}

function gateAspectClass(orientation: ImageAspectOrientation): string {
  switch (orientation) {
    case "portrait":
      return "aspect-[2/3]";
    case "square":
      return "aspect-square";
    case "landscape":
    default:
      return "aspect-[3/2]";
  }
}

function GateEdge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
    />
  );
}

function EmptyCell() {
  return (
    <div className="flex h-full items-center justify-center text-[0.65rem] text-[#9a9588]">
      empty
    </div>
  );
}

/**
 * Horizontal / restrained rebate markings — stock above or beside frame number,
 * never overlaid on the photograph.
 */
function RebateCaption({
  layout,
  stockLabel,
  frameLabel,
}: {
  layout: "horizontal" | "restrained";
  stockLabel: string | null;
  frameLabel: string;
}) {
  if (layout === "horizontal") {
    return (
      <figcaption
        className="flex items-end justify-between gap-2 px-[7%] pb-0.5 pt-0.5"
        data-rebate-label="horizontal"
      >
        {stockLabel ? (
          <span className="min-w-0 truncate font-mono text-[0.45rem] leading-tight tracking-[0.14em] text-[#7a756a]">
            {stockLabel}
          </span>
        ) : (
          <span
            aria-hidden
            className="select-none font-mono text-[0.55rem] tracking-[0.12em] text-[#6e6a60]"
          >
            ···
          </span>
        )}
        <span className="shrink-0 font-mono text-[0.65rem] tracking-[0.14em] text-[#c4bfb2]">
          {frameLabel}
        </span>
      </figcaption>
    );
  }

  return (
    <figcaption
      className="space-y-0.5 pt-1 text-center"
      data-rebate-label="restrained"
    >
      {stockLabel ? (
        <span className="block font-mono text-[0.45rem] tracking-[0.14em] text-[#7a756a]">
          {stockLabel}
        </span>
      ) : null}
      <span className="block font-mono text-[0.65rem] tracking-[0.14em] text-[#c4bfb2]">
        {frameLabel}
      </span>
    </figcaption>
  );
}

/**
 * Vertical-rail rebate sits between the gate and the trailing sprocket rail
 * (same strip order as the horizontal caption: rail → gate → markings → rail).
 * Stock and frame number occupy opposite ends of the marked edge.
 */
function VerticalRebateLabel({
  stockLabel,
  frameLabel,
  surface = "sheet",
}: {
  stockLabel: string | null;
  frameLabel: string;
  surface?: "sheet" | "gallery";
}) {
  const gallery = surface === "gallery";
  const sideways = {
    writingMode: "vertical-rl" as const,
    transform: "rotate(180deg)",
  };
  return (
    <figcaption
      className={
        gallery
          ? "flex w-[12px] shrink-0 flex-col items-center justify-between self-stretch py-[6%]"
          : "flex w-[10px] shrink-0 flex-col items-center justify-between self-stretch py-[7%]"
      }
      data-rebate-label="vertical"
    >
      {stockLabel ? (
        <span
          className={
            gallery
              ? "max-h-[58%] overflow-hidden font-mono text-[0.42rem] leading-none tracking-[0.2em] text-[#7a756a]"
              : "max-h-[52%] overflow-hidden font-mono text-[0.36rem] leading-none tracking-[0.18em] text-[#7a756a]"
          }
          style={sideways}
        >
          {stockLabel}
        </span>
      ) : (
        <span aria-hidden className="select-none font-mono text-[0.38rem] text-[#6e6a60]">
          ·
        </span>
      )}
      <span
        className={
          gallery
            ? "font-mono text-[0.6rem] leading-none tracking-[0.1em] text-[#c4bfb2]"
            : "font-mono text-[0.5rem] leading-none tracking-[0.1em] text-[#c4bfb2]"
        }
        style={sideways}
      >
        {frameLabel}
      </span>
    </figcaption>
  );
}

/** Sprocket motif along the physical-film long edges for this scan. */
function SprocketRail({
  orientation,
  surface = "sheet",
}: {
  orientation: "horizontal" | "vertical";
  surface?: "sheet" | "gallery";
}) {
  const gallery = surface === "gallery";
  // Vertical strips use a denser count so pitch stays believable on tall gates.
  const holeCount =
    orientation === "vertical" ? (gallery ? 11 : 8) : gallery ? 8 : 6;

  const holes = Array.from({ length: holeCount }, (_, index) => (
    <span
      key={index}
      className={
        orientation === "horizontal"
          ? gallery
            ? "h-[5px] w-[7px] shrink-0 rounded-[0.5px] bg-[#1e2024] ring-1 ring-inset ring-[#2e3036]"
            : "h-[4px] w-[5px] shrink-0 rounded-[0.5px] bg-[#1e2024] ring-1 ring-inset ring-[#2e3036]"
          : gallery
            ? "h-[6px] w-[3.5px] shrink-0 rounded-[0.5px] bg-[#1e2024] ring-1 ring-inset ring-[#2e3036]"
            : "h-[5px] w-[3px] shrink-0 rounded-[0.5px] bg-[#1e2024] ring-1 ring-inset ring-[#2e3036]"
      }
    />
  ));

  if (orientation === "vertical") {
    return (
      <div
        className={
          gallery
            ? "flex w-[11px] shrink-0 flex-col items-center justify-evenly py-[5%]"
            : "flex w-[9px] shrink-0 flex-col items-center justify-evenly py-[6%]"
        }
        aria-hidden
      >
        {holes}
      </div>
    );
  }

  return (
    <div
      className={
        gallery
          ? "flex justify-between gap-[3px] px-[8%] py-[4px]"
          : "flex justify-between gap-[2px] px-[8%] py-[3px]"
      }
      aria-hidden
    >
      {holes}
    </div>
  );
}
