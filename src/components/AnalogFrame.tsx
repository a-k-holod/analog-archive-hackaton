import { formatFrameNumber } from "@/lib/analogFrame";

type AnalogFrameProps = {
  imageUrl: string | null | undefined;
  frameNumber: number;
  /** When true, render the decorative film rebate + sprockets. */
  showFrame: boolean;
  alt?: string;
};

/**
 * Contact-sheet cell presentation.
 * Decorative only — `imageUrl` is passed through unchanged; no cropping of the source file.
 */
export function AnalogFrame({ imageUrl, frameNumber, showFrame, alt = "" }: AnalogFrameProps) {
  const numberLabel = formatFrameNumber(frameNumber);

  if (!showFrame) {
    return (
      <figure className="bg-black" data-analog-frame="off">
        <div className="aspect-[3/2]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={alt} className="h-full w-full object-cover grayscale" />
          ) : (
            <EmptyCell />
          )}
        </div>
        <figcaption className="px-1 py-1 text-center text-[0.65rem] text-[#b7b19f]">
          {numberLabel}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure
      className="overflow-hidden bg-[#0c0d0f] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      data-analog-frame="on"
      data-frame-number={numberLabel}
    >
      <SprocketRail />
      <div className="relative mx-[7%] aspect-[3/2] bg-[#050505]">
        {/* Soft gate edge — archival, not brand-specific */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
        />
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={alt} className="h-full w-full object-contain grayscale" />
        ) : (
          <EmptyCell />
        )}
      </div>
      <div className="flex items-center justify-between px-[7%] pb-0.5 pt-0.5">
        <span
          aria-hidden
          className="select-none font-mono text-[0.55rem] tracking-[0.12em] text-[#6e6a60]"
        >
          ···
        </span>
        <figcaption className="font-mono text-[0.65rem] tracking-[0.14em] text-[#c4bfb2]">
          {numberLabel}
        </figcaption>
        <span
          aria-hidden
          className="select-none font-mono text-[0.55rem] tracking-[0.12em] text-[#6e6a60]"
        >
          ···
        </span>
      </div>
      <SprocketRail />
    </figure>
  );
}

function EmptyCell() {
  return (
    <div className="flex h-full items-center justify-center text-[0.65rem] text-[#9a9588]">
      empty
    </div>
  );
}

/** Restrained sprocket motif along the long film edges. */
function SprocketRail() {
  return (
    <div className="flex justify-between gap-[2px] px-[8%] py-[3px]" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="h-[4px] w-[5px] shrink-0 rounded-[0.5px] bg-[#1e2024] ring-1 ring-inset ring-[#2e3036]"
        />
      ))}
    </div>
  );
}
