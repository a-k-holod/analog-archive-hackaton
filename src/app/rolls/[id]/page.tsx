"use client";

import { AnalogFrame } from "@/components/AnalogFrame";
import { useArchive } from "@/components/ArchiveProvider";
import { BatchImport } from "@/components/BatchImport";
import { Button } from "@/components/Button";
import { Field, inputClassName, textareaClassName } from "@/components/Field";
import { HandwrittenNoteCapture } from "@/components/HandwrittenNoteCapture";
import { HandwrittenNoteOcr } from "@/components/HandwrittenNoteOcr";
import { PhotographViewer } from "@/components/PhotographViewer";
import {
  ANALOG_FRAME_MODES,
  detectFilmEdge,
  resolveContactSheetCell,
  type AnalogFrameMode,
  type FilmEdgeDetection,
} from "@/lib/analogFrame";
import type { FrameMetadataPatch } from "@/lib/frames";
import { fileToCompressedJpeg } from "@/lib/image";
import type { AnalyzePayload, FilmRoll, NewFrameInput, NewNoteInput, RollAnalysis } from "@/lib/types";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function RollPage({ params }: PageProps) {
  const { id } = use(params);
  const {
    ready,
    getRoll,
    addFrame,
    addNote,
    saveNoteOcrText,
    updateFrame,
    generateContactSheet,
    saveAnalysis,
  } = useArchive();
  const roll = getRoll(id);

  if (!ready) {
    return <p className="loading-pulse meta">Opening this roll…</p>;
  }

  if (!roll) {
    return (
      <div className="max-w-lg">
        <h1 className="font-serif text-[2.5rem] leading-none tracking-tight">Roll not found</h1>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
          This roll is not in the local archive.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-cobalt underline-offset-4 hover:underline"
        >
          Back to archive
        </Link>
      </div>
    );
  }

  return (
    <RollDetail
      roll={roll}
      onAddFrame={addFrame}
      onAddNote={addNote}
      onSaveNoteOcrText={saveNoteOcrText}
      onUpdateFrame={updateFrame}
      onGenerateContactSheet={generateContactSheet}
      onSaveAnalysis={saveAnalysis}
    />
  );
}

function RollDetail({
  roll,
  onAddFrame,
  onAddNote,
  onSaveNoteOcrText,
  onUpdateFrame,
  onGenerateContactSheet,
  onSaveAnalysis,
}: {
  roll: FilmRoll;
  onAddFrame: (rollId: string, input: NewFrameInput) => Promise<void>;
  onAddNote: (rollId: string, input: NewNoteInput) => Promise<void>;
  onSaveNoteOcrText: (rollId: string, noteId: string, ocrText: string) => Promise<void>;
  onUpdateFrame: (rollId: string, frameId: string, patch: FrameMetadataPatch) => Promise<void>;
  onGenerateContactSheet: (rollId: string) => Promise<void>;
  onSaveAnalysis: (rollId: string, analysis: RollAnalysis) => Promise<void>;
}) {
  const [viewerFrameId, setViewerFrameId] = useState<string | null>(null);
  const viewerTriggerRef = useRef<HTMLElement | null>(null);

  const openViewer = useCallback((frameId: string, trigger?: HTMLElement | null) => {
    if (!roll.frames.some((frame) => frame.id === frameId)) {
      return;
    }
    viewerTriggerRef.current = trigger ?? null;
    setViewerFrameId(frameId);
    replaceFrameHash(frameId);
  }, [roll.frames]);

  const navigateViewer = useCallback((frameId: string) => {
    if (!roll.frames.some((frame) => frame.id === frameId)) {
      return;
    }
    setViewerFrameId(frameId);
    replaceFrameHash(frameId);
  }, [roll.frames]);

  const closeViewer = useCallback(() => {
    setViewerFrameId(null);
    clearFrameHash();
    const trigger = viewerTriggerRef.current;
    viewerTriggerRef.current = null;
    // Return focus after the dialog unmounts.
    requestAnimationFrame(() => {
      trigger?.focus();
    });
  }, []);

  // Deep link + browser hash navigation (async bootstrap avoids setState-in-effect lint).
  const frameIdsKey = roll.frames.map((frame) => frame.id).join(",");
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setViewerFrameId(readFrameIdFromHash(roll));
        focusNotesSectionIfNeeded();
      }
    });
    function onHashChange() {
      setViewerFrameId(readFrameIdFromHash(roll));
      focusNotesSectionIfNeeded();
    }
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
    };
    // Re-bind when the frame set changes, not on every metadata edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roll.frames membership via frameIdsKey
  }, [roll.id, frameIdsKey]);

  const metaParts = [
    roll.filmStock,
    roll.iso ? `ISO ${roll.iso}` : null,
    roll.camera,
    roll.startedOn ? `started ${roll.startedOn}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-20 sm:space-y-24">
      <header>
        <Link href="/" className="meta transition-colors hover:text-ink">
          ← Archive
        </Link>
        <h1 className="mt-4 max-w-3xl font-serif text-[2.5rem] leading-[1.05] tracking-tight sm:text-5xl">
          {roll.title}
        </h1>
        {metaParts.length > 0 ? (
          <p className="meta mt-4 max-w-2xl leading-relaxed">{metaParts.join(" · ")}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">No technical notes yet</p>
        )}
      </header>

      <FramesSection roll={roll} onAddFrame={onAddFrame} onOpenFrame={openViewer} />
      <NotesSection roll={roll} onAddNote={onAddNote} onSaveNoteOcrText={onSaveNoteOcrText} />
      <ContactSheetSection
        roll={roll}
        onGenerate={onGenerateContactSheet}
        onOpenFrame={openViewer}
      />
      <AnalysisSection roll={roll} onSaveAnalysis={onSaveAnalysis} />

      {viewerFrameId ? (
        <PhotographViewer
          roll={roll}
          frameId={viewerFrameId}
          onClose={closeViewer}
          onNavigate={navigateViewer}
          onUpdateFrame={onUpdateFrame}
        />
      ) : null}
    </div>
  );
}

function FramesSection({
  roll,
  onAddFrame,
  onOpenFrame,
}: {
  roll: FilmRoll;
  onAddFrame: (rollId: string, input: NewFrameInput) => Promise<void>;
  onOpenFrame: (frameId: string, trigger?: HTMLElement | null) => void;
}) {
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [aperture, setAperture] = useState("");
  const [shutterSpeed, setShutterSpeed] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photographInputRef = useRef<HTMLInputElement>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const compressed = await fileToCompressedJpeg(file);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImageBlob(compressed.blob);
      setImagePreviewUrl(compressed.previewUrl);
    } catch {
      setError("That photograph could not be read.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAddFrame(roll.id, {
        caption,
        location,
        aperture,
        shutterSpeed,
        imageBlob,
      });
      setCaption("");
      setLocation("");
      setAperture("");
      setShutterSpeed("");
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImageBlob(null);
      setImagePreviewUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this frame.");
    } finally {
      setBusy(false);
    }
  }

  const hasFrames = roll.frames.length > 0;

  return (
    <section>
      <div className="border-t border-line pt-10">
        <p className="section-kicker">Photographs</p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight sm:text-[1.75rem]">Frames</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {hasFrames
            ? `${roll.frames.length} ${roll.frames.length === 1 ? "photograph" : "photographs"} on this roll.`
            : "No frames on this roll yet."}
        </p>
      </div>

      {hasFrames ? (
        <ul className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-3">
          {roll.frames.map((frame) => (
            <li key={frame.id} id={`frame-${frame.id}`} className="scroll-mt-24">
              <button
                type="button"
                onClick={(event) => onOpenFrame(frame.id, event.currentTarget)}
                aria-label={`Open frame ${String(frame.number).padStart(2, "0")}${frame.caption ? `: ${frame.caption}` : ""}`}
                className="group w-full cursor-pointer text-left outline-none transition-[opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cobalt"
              >
                <figure>
                  <div className="aspect-[3/2] bg-matte">
                    {frame.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={frame.imageUrl}
                        alt=""
                        className="h-full w-full object-cover transition-[opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-90 group-focus-visible:opacity-90"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center meta">
                        Frame {String(frame.number).padStart(2, "0")}
                      </div>
                    )}
                  </div>
                  <figcaption className="mt-3.5">
                    <p className="meta">Frame {String(frame.number).padStart(2, "0")}</p>
                    <p className="mt-1.5 font-serif text-lg leading-snug tracking-tight">
                      {frame.caption || "Untitled"}
                    </p>
                    <p className="meta mt-2">
                      {[frame.location, frame.aperture, frame.shutterSpeed]
                        .filter(Boolean)
                        .join(" · ") || "No exposure notes"}
                    </p>
                  </figcaption>
                </figure>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <BatchImport
        rollId={roll.id}
        existingFrameNumbers={roll.frames.map((frame) => frame.number)}
        subordinate={hasFrames}
        onAddFrame={onAddFrame}
      />

      <details className="mt-12 border-t border-line pt-8">
        <summary className="cursor-pointer font-serif text-lg tracking-tight text-ink outline-none marker:text-muted">
          Add a single frame with notes
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Use this when one photograph needs a caption or exposure notes at import time.
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="meta mb-2 block">Photograph</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={photographInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="sr-only"
                tabIndex={-1}
                disabled={busy}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => photographInputRef.current?.click()}
              >
                Choose photograph
              </Button>
              <span className="text-sm text-muted">
                {imagePreviewUrl ? "Photograph attached." : "JPEG or other image file."}
              </span>
            </div>
            {imagePreviewUrl ? (
              <div className="mt-5 max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Photograph ready to save"
                  className="aspect-[3/2] w-full object-cover"
                />
              </div>
            ) : null}
          </div>
          <Field label="Caption">
            <input
              className={inputClassName}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </Field>
          <Field label="Location">
            <input
              className={inputClassName}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Sławinek, Lublin, PL"
            />
          </Field>
          <Field label="Aperture">
            <input
              className={`${inputClassName} font-mono tracking-wide`}
              value={aperture}
              onChange={(event) => setAperture(event.target.value)}
              placeholder="f/8"
            />
          </Field>
          <Field label="Shutter">
            <input
              className={`${inputClassName} font-mono tracking-wide`}
              value={shutterSpeed}
              onChange={(event) => setShutterSpeed(event.target.value)}
              placeholder="1/125"
            />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Add frame"}
            </Button>
          </div>
          {error ? <p className="sm:col-span-2 text-sm text-danger">{error}</p> : null}
        </form>
      </details>
    </section>
  );
}

function NotesSection({
  roll,
  onAddNote,
  onSaveNoteOcrText,
}: {
  roll: FilmRoll;
  onAddNote: (rollId: string, input: NewNoteInput) => Promise<void>;
  onSaveNoteOcrText: (rollId: string, noteId: string, ocrText: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Write a text note, or photograph a handwritten page above.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAddNote(roll.id, { body, imageBlob: null });
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this note.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveHandwritten(imageBlob: Blob) {
    await onAddNote(roll.id, { body: "", imageBlob });
  }

  return (
    <section id="notes" tabIndex={-1} className="scroll-mt-24 outline-none">
      <div className="border-t border-line pt-10">
        <p className="section-kicker">Process</p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight sm:text-[1.75rem]">Notes</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Write it on paper under the safelight. Archive the page later. Development notes, exposure
          observations, locations, and printing reminders travel with this roll.
        </p>
      </div>

      <div className="mt-8 max-w-2xl space-y-3">
        <div>
          <p className="meta">Handwritten note</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Photograph the page. The image is the archival original; any extracted text is only for
            search.
          </p>
        </div>
        <HandwrittenNoteCapture disabled={busy} onSave={onSaveHandwritten} />
      </div>

      <form onSubmit={onSubmit} className="mt-10 max-w-2xl space-y-4 border-t border-line pt-8">
        <div>
          <p className="meta">Written text note</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Or type a note when you are already at the screen.
          </p>
        </div>
        <textarea
          className={textareaClassName}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Overcast, slightly underexposed the last four frames."
          aria-label="Written text note"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add text note"}
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>

      {roll.notes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No notes on this roll yet.</p>
      ) : (
        <ul className="mt-10 max-w-2xl space-y-10">
          {roll.notes.map((note) => (
            <li key={note.id} className="border-l border-cobalt pl-5">
              {note.imageUrl ? (
                <figure>
                  <p className="meta">Handwritten note</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={note.imageUrl}
                    alt="Photograph of handwritten note"
                    className="mt-3 max-h-[min(70vh,28rem)] w-full max-w-lg bg-matte object-contain"
                  />
                  <figcaption className="mt-2 text-sm leading-relaxed text-muted">
                    Original handwriting preserved
                  </figcaption>
                </figure>
              ) : null}
              {note.body ? (
                <div className={note.imageUrl ? "mt-5" : undefined}>
                  {!note.imageUrl ? <p className="meta mb-2">Written text note</p> : null}
                  <p className="whitespace-pre-wrap leading-relaxed">{note.body}</p>
                </div>
              ) : null}
              {note.imageUrl ? (
                <HandwrittenNoteOcr
                  note={note}
                  disabled={busy}
                  onSaveOcrText={(noteId, ocrText) => onSaveNoteOcrText(roll.id, noteId, ocrText)}
                />
              ) : null}
              <p className="meta mt-3">{formatDateTime(note.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ContactSheetSection({
  roll,
  onGenerate,
  onOpenFrame,
}: {
  roll: FilmRoll;
  onGenerate: (rollId: string) => Promise<void>;
  onOpenFrame: (frameId: string, trigger?: HTMLElement | null) => void;
}) {
  const canGenerate = roll.frames.length > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Local UI state only — not persisted to Supabase in this iteration. */
  const [frameMode, setFrameMode] = useState<AnalogFrameMode>("on");
  /** Auto-mode detection results keyed by image URL (in-memory only). */
  const [detectionByUrl, setDetectionByUrl] = useState<Record<string, FilmEdgeDetection>>({});

  useEffect(() => {
    if (frameMode !== "auto") return;

    const urls = roll.frames
      .map((frame) => frame.imageUrl)
      .filter((url): url is string => Boolean(url));

    let cancelled = false;

    void (async () => {
      for (const url of urls) {
        if (cancelled) return;
        // detectFilmEdge caches per URL — safe across re-renders / mode toggles.
        const detection = await detectFilmEdge(url);
        if (cancelled) return;
        setDetectionByUrl((prev) => (prev[url] ? prev : { ...prev, [url]: detection }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [frameMode, roll.frames]);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      await onGenerate(roll.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the contact sheet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-10">
        <div>
          <p className="section-kicker">Proof</p>
          <h2 className="mt-2 font-serif text-2xl tracking-tight sm:text-[1.75rem]">
            Contact sheet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {roll.contactSheetGeneratedAt
              ? `Generated ${formatDateTime(roll.contactSheetGeneratedAt)}.`
              : "Compose the current frames into a contact sheet."}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleGenerate}
          disabled={!canGenerate || busy}
        >
          {busy
            ? "Saving…"
            : roll.contactSheetGeneratedAt
              ? "Regenerate contact sheet"
              : "Generate contact sheet"}
        </Button>
      </div>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {!canGenerate ? (
        <p className="mt-8 text-sm text-muted">
          Add at least one frame before generating a contact sheet.
        </p>
      ) : roll.contactSheetGeneratedAt ? (
        <div className="mt-8 -mx-5 bg-film px-5 py-6 text-[#ece7dc] sm:-mx-8 sm:px-8 sm:py-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <span className="block font-serif text-lg tracking-tight">{roll.title}</span>
              <span className="meta block text-[#b7b19f]">
                {roll.filmStock || "Film"} · {roll.frames.length} frames
              </span>
            </div>
            <AnalogFrameModeControl mode={frameMode} onChange={setFrameMode} />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
            {roll.frames.map((frame) => {
              const detection =
                frame.imageUrl && frameMode === "auto"
                  ? (detectionByUrl[frame.imageUrl] ?? null)
                  : null;
              const cell = resolveContactSheetCell({
                mode: frameMode,
                imageUrl: frame.imageUrl,
                frameNumber: frame.number,
                detection,
                filmStock: roll.filmStock,
                iso: roll.iso,
              });
              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={(event) => onOpenFrame(frame.id, event.currentTarget)}
                  aria-label={`Open frame ${String(frame.number).padStart(2, "0")} from contact sheet`}
                  className="cursor-pointer text-left outline-none transition-[opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a9bb0]"
                >
                  <AnalogFrame
                    imageUrl={cell.imageUrl}
                    frameNumber={frame.number}
                    showFrame={cell.showFrame}
                    layout={frameMode === "on" ? undefined : cell.layout}
                    filmStock={roll.filmStock}
                    iso={roll.iso}
                    alt=""
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">The contact sheet is not generated yet.</p>
      )}
    </section>
  );
}

function AnalogFrameModeControl({
  mode,
  onChange,
}: {
  mode: AnalogFrameMode;
  onChange: (mode: AnalogFrameMode) => void;
}) {
  const labels: Record<AnalogFrameMode, string> = {
    off: "Off",
    auto: "Auto",
    on: "On",
  };
  const hints: Record<AnalogFrameMode, string> = {
    off: "No film frame",
    auto: "Frame only when film borders are detected",
    on: "Always show film frame",
  };

  return (
    <div
      className="inline-flex border border-[#3a3c42] bg-[#0f1012] p-0.5"
      role="group"
      aria-label="Analog frame presentation"
      title="Film frame: Off, Auto (detect borders), or On"
    >
      {ANALOG_FRAME_MODES.map((value) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={hints[value]}
            onClick={() => onChange(value)}
            className={
              active
                ? "bg-[#2a2c32] px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-[#ece7dc] transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                : "px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.08em] text-[#8a857a] transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#c4bfb2] active:scale-[0.97]"
            }
          >
            {labels[value]}
          </button>
        );
      })}
    </div>
  );
}

function AnalysisSection({
  roll,
  onSaveAnalysis,
}: {
  roll: FilmRoll;
  onSaveAnalysis: (rollId: string, analysis: RollAnalysis) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);

    const payload: AnalyzePayload = {
      title: roll.title,
      filmStock: roll.filmStock,
      iso: roll.iso,
      camera: roll.camera,
      frames: roll.frames.map((frame) => ({
        number: frame.number,
        caption: frame.caption,
        location: frame.location,
        aperture: frame.aperture,
        shutterSpeed: frame.shutterSpeed,
        hasImage: Boolean(frame.imageUrl),
      })),
      notes: roll.notes.map((note) => note.body),
    };

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Analysis failed.");
      }

      const analysis = (await response.json()) as RollAnalysis;
      await onSaveAnalysis(roll.id, analysis);
    } catch {
      setError("The roll could not be analyzed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-10">
        <div className="max-w-xl">
          <p className="section-kicker">Reading</p>
          <h2 className="mt-2 font-serif text-2xl tracking-tight sm:text-[1.75rem]">
            AI analysis
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Read the whole roll: sequence, technical notes, and recurring themes.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={analyze} disabled={busy}>
          {busy ? "Analyzing…" : roll.analysis ? "Regenerate analysis" : "Analyze roll"}
        </Button>
      </div>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {busy && !roll.analysis ? (
        <p className="loading-pulse meta mt-8">Reading the roll…</p>
      ) : null}
      {roll.analysis ? (
        <div className="mt-8 max-w-2xl space-y-6 border-t border-line pt-8">
          <p className="font-serif text-xl leading-relaxed tracking-tight">{roll.analysis.summary}</p>
          <p className="text-[0.95rem] leading-relaxed text-muted">{roll.analysis.technicalRead}</p>
          {roll.analysis.themes.length > 0 ? (
            <p className="meta leading-relaxed">{roll.analysis.themes.join(" · ")}</p>
          ) : null}
          <p className="meta">Generated {formatDateTime(roll.analysis.generatedAt)}</p>
        </div>
      ) : !busy ? (
        <p className="mt-8 text-sm text-muted">No analysis yet.</p>
      ) : null}
    </section>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function readFrameIdFromHash(roll: FilmRoll): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.hash.match(/^#frame-(.+)$/);
  const frameId = match?.[1] ?? null;
  if (!frameId) {
    return null;
  }
  return roll.frames.some((frame) => frame.id === frameId) ? frameId : null;
}

function focusNotesSectionIfNeeded(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.hash !== "#notes") {
    return;
  }
  const notes = document.getElementById("notes");
  if (notes instanceof HTMLElement) {
    notes.focus({ preventScroll: true });
  }
}

function replaceFrameHash(frameId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = `${window.location.pathname}${window.location.search}#frame-${frameId}`;
  window.history.replaceState(null, "", next);
}

function clearFrameHash(): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", next);
}
