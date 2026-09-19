"use client";

import { AnalogFrame } from "@/components/AnalogFrame";
import { Button } from "@/components/Button";
import { inputClassName } from "@/components/Field";
import { formatFrameNumber } from "@/lib/analogFrame";
import type { FrameMetadataPatch } from "@/lib/frames";
import {
  adjacentViewerImageUrls,
  buildViewerMetaPresentation,
  DEFAULT_VIEWER_FILM_FRAME_MODE,
  resolveViewerFilmFramePresentation,
  resolveViewerFramePosition,
  resolveViewerKeyboardAction,
  resolveViewerNavigation,
  resolveViewerSwipe,
  viewerNavAriaLabel,
  viewerPhotographInspectClassName,
  viewerPhotographInspectLabel,
  type ViewerFilmFrameMode,
  VIEWER_FILM_FRAME_MODES,
} from "@/lib/photographViewer";
import type { FilmRoll } from "@/lib/types";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";

type PhotographViewerProps = {
  roll: FilmRoll;
  frameId: string;
  onClose: () => void;
  onNavigate: (frameId: string) => void;
  onUpdateFrame: (rollId: string, frameId: string, patch: FrameMetadataPatch) => Promise<void>;
};

type EditDraft = {
  caption: string;
  location: string;
  aperture: string;
  shutterSpeed: string;
};

export function PhotographViewer({
  roll,
  frameId,
  onClose,
  onNavigate,
  onUpdateFrame,
}: PhotographViewerProps) {
  const frame = roll.frames.find((item) => item.id === frameId) ?? null;
  const position = frame ? resolveViewerFramePosition(roll.frames, frame.id) : null;
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFrameId, setActiveFrameId] = useState(frameId);
  const [filmFrameMode, setFilmFrameMode] = useState<ViewerFilmFrameMode>(
    DEFAULT_VIEWER_FILM_FRAME_MODE,
  );

  // Reset ephemeral edit state when navigating between frames (render-time adjust).
  // Film-frame preference stays for the open viewer session.
  if (frameId !== activeFrameId) {
    setActiveFrameId(frameId);
    setEditing(false);
    setDraft(null);
    setError(null);
    setBusy(false);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Warm adjacent frame images within this roll only — never the whole archive.
  useEffect(() => {
    if (typeof window === "undefined" || !frame) {
      return;
    }
    const warmed: HTMLImageElement[] = [];
    for (const url of adjacentViewerImageUrls(roll.frames, frame.id)) {
      if (url === frame.imageUrl) {
        continue;
      }
      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
      warmed.push(image);
    }
    return () => {
      for (const image of warmed) {
        image.src = "";
      }
    };
  }, [frame, roll.frames]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = resolveViewerKeyboardAction(event.key, { editing });
      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "close") {
        onClose();
        return;
      }
      if (action === "cancel-edit") {
        setEditing(false);
        setDraft(null);
        setError(null);
        return;
      }
      if (!frame) {
        return;
      }
      const nextId = resolveViewerNavigation(roll.frames, frame.id, action);
      if (nextId) {
        onNavigate(nextId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, frame, onClose, onNavigate, roll.frames]);

  function beginEdit() {
    if (!frame) {
      return;
    }
    setDraft({
      caption: frame.caption,
      location: frame.location,
      aperture: frame.aperture,
      shutterSpeed: frame.shutterSpeed,
    });
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setError(null);
    setEditing(false);
  }

  function goPrevious() {
    if (!frame || editing) {
      return;
    }
    const previousId = resolveViewerNavigation(roll.frames, frame.id, "previous");
    if (previousId) {
      onNavigate(previousId);
    }
  }

  function goNext() {
    if (!frame || editing) {
      return;
    }
    const nextId = resolveViewerNavigation(roll.frames, frame.id, "next");
    if (nextId) {
      onNavigate(nextId);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!frame || !draft) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onUpdateFrame(roll.id, frame.id, {
        caption: draft.caption,
        location: draft.location,
        aperture: draft.aperture,
        shutterSpeed: draft.shutterSpeed,
      });
      setEditing(false);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save photograph notes.");
    } finally {
      setBusy(false);
    }
  }

  function onDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (editing || event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || editing || !frame || event.changedTouches.length === 0) {
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    const intent = resolveViewerSwipe(touch.clientX - start.x, touch.clientY - start.y);
    if (!intent) {
      return;
    }
    const nextId = resolveViewerNavigation(roll.frames, frame.id, intent);
    if (nextId) {
      onNavigate(nextId);
    }
  }

  if (!frame || !position) {
    return null;
  }

  const meta = buildViewerMetaPresentation({
    caption: frame.caption,
    location: frame.location,
    aperture: frame.aperture,
    shutterSpeed: frame.shutterSpeed,
    filmStock: roll.filmStock,
    camera: roll.camera,
  });
  const frameLabel = `Frame ${formatFrameNumber(frame.number)}`;
  const atStart = !position.hasPrevious;
  const atEnd = !position.hasNext;
  const filmPresentation = resolveViewerFilmFramePresentation({
    mode: filmFrameMode,
    imageUrl: frame.imageUrl,
    frameId: frame.id,
    frameNumber: frame.number,
    filmStock: roll.filmStock,
    iso: roll.iso,
  });
  const inspectClassName = viewerPhotographInspectClassName();
  const inspectLabel = viewerPhotographInspectLabel(frame.number);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-[#0c0d0f] text-[#ece7dc]"
      onKeyDown={onDialogKeyDown}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <p
            id={titleId}
            className="font-mono text-[0.7rem] tracking-[0.14em] text-[#9a9588]"
          >
            {position.counterLabel}
          </p>
          <p className="mt-0.5 truncate font-serif text-[0.95rem] tracking-tight text-[#c4bfb2]">
            {roll.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ViewerFilmFrameControl mode={filmFrameMode} onChange={setFilmFrameMode} />
          {!editing ? (
            <button
              type="button"
              onClick={beginEdit}
              className="px-2 py-1.5 font-mono text-[0.7rem] tracking-[0.08em] text-[#8a8578] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#ece7dc] focus-visible:text-[#ece7dc] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#8a9bb0] active:scale-[0.97]"
            >
              Edit
            </button>
          ) : null}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close photograph"
            className="px-2 py-1.5 font-mono text-[0.7rem] tracking-[0.08em] text-[#8a8578] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#ece7dc] focus-visible:text-[#ece7dc] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#8a9bb0] active:scale-[0.97]"
          >
            Close
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-3 sm:px-10"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Previous — omit at roll start so no disabled control sits over the image */}
          {position.hasPrevious && !editing ? (
            <button
              type="button"
              onClick={goPrevious}
              aria-label={viewerNavAriaLabel("previous", position.previousFrameNumber)}
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 px-2 py-4 font-mono text-base text-[#8a8578] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#ece7dc] focus-visible:text-[#ece7dc] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#8a9bb0] active:scale-[0.97] sm:left-3 sm:text-lg"
            >
              ←
            </button>
          ) : null}

          {position.hasNext && !editing ? (
            <button
              type="button"
              onClick={goNext}
              aria-label={viewerNavAriaLabel("next", position.nextFrameNumber)}
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 px-2 py-4 font-mono text-base text-[#8a8578] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#ece7dc] focus-visible:text-[#ece7dc] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#8a9bb0] active:scale-[0.97] sm:right-3 sm:text-lg"
            >
              →
            </button>
          ) : null}

          <figure className="flex h-full max-h-full w-full max-w-6xl flex-col items-center justify-center px-9 sm:px-14">
            {filmPresentation.showFrame ? (
              <div
                className="relative flex max-h-full max-w-full items-center justify-center"
                data-viewer-film-frame="on"
              >
                <AnalogFrame
                  key={frame.id}
                  imageUrl={frame.imageUrl}
                  frameNumber={frame.number}
                  showFrame
                  filmStock={roll.filmStock}
                  iso={roll.iso}
                  alt={frame.caption || frameLabel}
                  imageTone="natural"
                  surface="gallery"
                  imageClassName={frame.imageUrl ? inspectClassName : ""}
                  inspectHref={frame.imageUrl}
                  inspectLabel={inspectLabel}
                />
              </div>
            ) : (
              <div
                className="relative flex max-h-full max-w-full items-center justify-center bg-[#050505] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                data-viewer-film-frame="off"
              >
                {frame.imageUrl ? (
                  <a
                    href={frame.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={inspectLabel}
                    className="block max-h-full max-w-full rounded-[1px] outline-offset-4 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#8a9bb0]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={frame.id}
                      src={frame.imageUrl}
                      alt={frame.caption || frameLabel}
                      className={`max-h-[min(72vh,calc(100dvh-13rem))] max-w-full object-contain sm:max-h-[min(78vh,calc(100dvh-14rem))] ${inspectClassName}`}
                      draggable={false}
                    />
                  </a>
                ) : (
                  <div className="flex aspect-[3/2] w-[min(100%,28rem)] items-center justify-center font-mono text-sm tracking-[0.08em] text-[#6e6a60]">
                    {frameLabel}
                  </div>
                )}
              </div>
            )}
            {(atStart || atEnd) && !editing ? (
              <figcaption className="mt-3 font-mono text-[0.65rem] tracking-[0.1em] text-[#5c5a52]">
                {atStart && atEnd
                  ? "Only frame in this roll"
                  : atStart
                    ? "First frame"
                    : "Last frame"}
              </figcaption>
            ) : null}
          </figure>
        </div>

        <footer className="shrink-0 border-t border-white/[0.06] px-4 py-4 sm:px-6 sm:py-5">
          {editing && draft ? (
            <form
              onSubmit={onSave}
              className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 sm:gap-5"
            >
              <p className="font-mono text-[0.7rem] tracking-[0.08em] text-[#9a9588] sm:col-span-2">
                Edit notes
              </p>
              <ViewerField label="Caption">
                <input
                  className={viewerInputClassName}
                  value={draft.caption}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, caption: event.target.value } : current,
                    )
                  }
                  disabled={busy}
                  autoFocus
                />
              </ViewerField>
              <ViewerField label="Location">
                <input
                  className={viewerInputClassName}
                  value={draft.location}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, location: event.target.value } : current,
                    )
                  }
                  disabled={busy}
                  placeholder="Sławinek, Lublin, PL"
                />
              </ViewerField>
              <ViewerField label="Aperture">
                <input
                  className={`${viewerInputClassName} font-mono tracking-wide`}
                  value={draft.aperture}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, aperture: event.target.value } : current,
                    )
                  }
                  disabled={busy}
                  placeholder="f/8"
                />
              </ViewerField>
              <ViewerField label="Shutter">
                <input
                  className={`${viewerInputClassName} font-mono tracking-wide`}
                  value={draft.shutterSpeed}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, shutterSpeed: event.target.value } : current,
                    )
                  }
                  disabled={busy}
                  placeholder="1/125"
                />
              </ViewerField>
              <div className="flex flex-wrap items-center gap-3 pt-1 sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelEdit}
                  className="font-mono text-[0.7rem] tracking-[0.08em] text-[#9a9588] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#ece7dc] focus-visible:text-[#ece7dc] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#8a9bb0] disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
              {error ? (
                <p className="text-sm text-[#e8a0a0] sm:col-span-2">{error}</p>
              ) : null}
            </form>
          ) : (
            <div className="mx-auto max-w-3xl">
              <p className="font-serif text-xl leading-snug tracking-tight text-[#ece7dc] sm:text-[1.35rem]">
                {meta.caption}
              </p>
              <div className="mt-2 space-y-0.5 font-mono text-[0.7rem] leading-relaxed tracking-[0.04em] text-[#8a8578] sm:text-[0.75rem]">
                {meta.stockLine ? <p>{meta.stockLine}</p> : null}
                {meta.location ? <p>{meta.location}</p> : null}
                {meta.exposureLine ? <p>{meta.exposureLine}</p> : null}
              </div>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

function ViewerFilmFrameControl({
  mode,
  onChange,
}: {
  mode: ViewerFilmFrameMode;
  onChange: (mode: ViewerFilmFrameMode) => void;
}) {
  const labels: Record<ViewerFilmFrameMode, string> = {
    off: "Off",
    on: "On",
  };

  return (
    <div className="mr-0.5 flex items-center gap-1 sm:mr-1 sm:gap-1.5" role="group" aria-label="Film frame">
      <span className="font-mono text-[0.6rem] tracking-[0.08em] text-[#6e6a60] sm:text-[0.65rem]">
        Film frame
      </span>
      <div className="inline-flex border border-[#2e3036] bg-[#121317] p-0.5">
        {VIEWER_FILM_FRAME_MODES.map((value) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              aria-label={`Film frame ${labels[value]}`}
              title={`Film frame ${labels[value]}`}
              onClick={() => onChange(value)}
              className={
                active
                  ? "min-h-8 bg-[#2a2c32] px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-[#ece7dc] transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[#8a9bb0] sm:min-h-0 sm:px-2.5"
                  : "min-h-8 px-2 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-[#7a756a] transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#1a1c20] hover:text-[#c4bfb2] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[#8a9bb0] active:scale-[0.97] sm:min-h-0 sm:px-2.5"
              }
            >
              {labels[value]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ViewerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[0.7rem] tracking-[0.08em] text-[#9a9588]">
        {label}
      </span>
      {children}
    </label>
  );
}

const viewerInputClassName = `${inputClassName} border-[#3a3c42] text-[#ece7dc] placeholder:text-[#6e6a60] focus:border-[#8a9bb0]`;
