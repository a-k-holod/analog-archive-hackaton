"use client";

import { AnalogFrame } from "@/components/AnalogFrame";
import { useArchive } from "@/components/ArchiveProvider";
import { Button } from "@/components/Button";
import { Field, inputClassName } from "@/components/Field";
import {
  ANALOG_FRAME_MODES,
  shouldShowAnalogFrame,
  type AnalogFrameMode,
} from "@/lib/analogFrame";
import { fileToCompressedJpeg } from "@/lib/image";
import type { AnalyzePayload, FilmRoll, NewFrameInput, RollAnalysis } from "@/lib/types";
import Link from "next/link";
import { use, useRef, useState, type ChangeEvent, type FormEvent } from "react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function RollPage({ params }: PageProps) {
  const { id } = use(params);
  const { ready, getRoll, addFrame, addNote, generateContactSheet, saveAnalysis } = useArchive();
  const roll = getRoll(id);

  if (!ready) {
    return <p className="text-sm text-muted">Opening this roll…</p>;
  }

  if (!roll) {
    return (
      <div>
        <h1 className="font-serif text-4xl tracking-tight">Roll not found</h1>
        <p className="mt-3 text-muted">This roll is not in the local archive.</p>
        <Link href="/" className="mt-6 inline-block text-cobalt hover:underline">
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
      onGenerateContactSheet={generateContactSheet}
      onSaveAnalysis={saveAnalysis}
    />
  );
}

function RollDetail({
  roll,
  onAddFrame,
  onAddNote,
  onGenerateContactSheet,
  onSaveAnalysis,
}: {
  roll: FilmRoll;
  onAddFrame: (rollId: string, input: NewFrameInput) => Promise<void>;
  onAddNote: (rollId: string, body: string) => Promise<void>;
  onGenerateContactSheet: (rollId: string) => Promise<void>;
  onSaveAnalysis: (rollId: string, analysis: RollAnalysis) => Promise<void>;
}) {
  return (
    <div className="space-y-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-ink">
            Archive
          </Link>
          <h1 className="mt-3 font-serif text-4xl tracking-tight">{roll.title}</h1>
          <p className="mt-2 text-muted">
            {[
              roll.filmStock,
              roll.iso ? `ISO ${roll.iso}` : null,
              roll.camera,
              roll.startedOn ? `started ${roll.startedOn}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No technical notes yet"}
          </p>
        </div>
      </header>

      <FramesSection roll={roll} onAddFrame={onAddFrame} />
      <NotesSection roll={roll} onAddNote={onAddNote} />
      <ContactSheetSection roll={roll} onGenerate={onGenerateContactSheet} />
      <AnalysisSection roll={roll} onSaveAnalysis={onSaveAnalysis} />
    </div>
  );
}

function FramesSection({
  roll,
  onAddFrame,
}: {
  roll: FilmRoll;
  onAddFrame: (rollId: string, input: NewFrameInput) => Promise<void>;
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

  return (
    <section>
      <h2 className="font-serif text-2xl">Frames</h2>
      <p className="mt-1 text-sm text-muted">Add a photograph and the exposure notes that belong with it.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 border border-line bg-surface p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm text-muted">Photograph</span>
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
              disabled={busy}
              onClick={() => photographInputRef.current?.click()}
            >
              Add photograph
            </Button>
            <span className="text-sm text-muted">
              {imagePreviewUrl ? "Photograph attached." : "JPEG or other image file."}
            </span>
          </div>
        </div>
        <Field label="Caption">
          <input className={inputClassName} value={caption} onChange={(event) => setCaption(event.target.value)} />
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
            className={inputClassName}
            value={aperture}
            onChange={(event) => setAperture(event.target.value)}
            placeholder="f/8"
          />
        </Field>
        <Field label="Shutter">
          <input
            className={inputClassName}
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
        {error ? <p className="sm:col-span-2 text-sm text-[#8a2a2a]">{error}</p> : null}
      </form>

      {roll.frames.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No frames on this roll yet.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roll.frames.map((frame) => (
            <li key={frame.id} className="border border-line bg-surface">
              <div className="aspect-[3/2] bg-[#d7dbe1]">
                {frame.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={frame.imageUrl} alt={frame.caption || `Frame ${frame.number}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted">
                    Frame {String(frame.number).padStart(2, "0")}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm text-muted">Frame {String(frame.number).padStart(2, "0")}</p>
                <p className="mt-1 font-medium">{frame.caption || "Untitled"}</p>
                <p className="mt-1 text-sm text-muted">
                  {[frame.location, frame.aperture, frame.shutterSpeed].filter(Boolean).join(" · ") || "No metadata"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotesSection({
  roll,
  onAddNote,
}: {
  roll: FilmRoll;
  onAddNote: (rollId: string, body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAddNote(roll.id, body);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="font-serif text-2xl">Notes</h2>
      <p className="mt-1 text-sm text-muted">
        Field notes, development reminders, or anything that should travel with the roll.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <textarea
          className={`${inputClassName} min-h-28`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Overcast, slightly underexposed the last four frames."
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add note"}
        </Button>
        {error ? <p className="text-sm text-[#8a2a2a]">{error}</p> : null}
      </form>
      {roll.notes.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {roll.notes.map((note) => (
            <li key={note.id} className="border-l-2 border-cobalt pl-4">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-sm text-muted">{formatDateTime(note.createdAt)}</p>
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
}: {
  roll: FilmRoll;
  onGenerate: (rollId: string) => Promise<void>;
}) {
  const canGenerate = roll.frames.length > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Local UI state only — not persisted to Supabase in this iteration. */
  const [frameMode, setFrameMode] = useState<AnalogFrameMode>("auto");
  // Auto stays conservative until a real detectFilmEdge() result is wired in.
  const showFrame = shouldShowAnalogFrame(frameMode);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl">Contact sheet</h2>
          <p className="mt-1 text-sm text-muted">
            {roll.contactSheetGeneratedAt
              ? `Generated ${formatDateTime(roll.contactSheetGeneratedAt)}.`
              : "Compose the current frames into a contact sheet."}
          </p>
        </div>
        <Button type="button" onClick={handleGenerate} disabled={!canGenerate || busy}>
          {busy ? "Saving…" : "Generate contact sheet"}
        </Button>
      </div>
      {error ? <p className="mt-4 text-sm text-[#8a2a2a]">{error}</p> : null}

      {!canGenerate ? (
        <p className="mt-6 text-sm text-muted">Add at least one frame before generating a contact sheet.</p>
      ) : roll.contactSheetGeneratedAt ? (
        <div className="mt-6 bg-film p-4 text-[#ece7dc] sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 text-xs tracking-wide">
            <div className="flex flex-wrap justify-between gap-2 sm:block sm:space-y-1">
              <span className="block">{roll.title}</span>
              <span className="block text-[#b7b19f]">
                {roll.filmStock || "Film"} · {roll.frames.length} frames
              </span>
            </div>
            <AnalogFrameModeControl mode={frameMode} onChange={setFrameMode} />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
            {roll.frames.map((frame) => (
              <AnalogFrame
                key={frame.id}
                imageUrl={frame.imageUrl}
                frameNumber={frame.number}
                showFrame={showFrame}
                alt={frame.caption || `Frame ${frame.number}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">The contact sheet is not generated yet.</p>
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

  return (
    <div
      className="inline-flex border border-[#3a3c42] bg-[#0f1012] p-0.5"
      role="group"
      aria-label="Analog frame presentation"
    >
      {ANALOG_FRAME_MODES.map((value) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={
              active
                ? "bg-[#2a2c32] px-2.5 py-1 text-[0.7rem] tracking-wide text-[#ece7dc] transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]"
                : "px-2.5 py-1 text-[0.7rem] tracking-wide text-[#8a857a] transition-[background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-[#c4bfb2] active:scale-[0.97]"
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl">AI analysis</h2>
          <p className="mt-1 text-sm text-muted">
            Read the whole roll: sequence, technical notes, and recurring themes.
          </p>
        </div>
        <Button type="button" onClick={analyze} disabled={busy}>
          {busy ? "Analyzing…" : "Analyze roll"}
        </Button>
      </div>
      {error ? <p className="mt-4 text-sm text-[#8a2a2a]">{error}</p> : null}
      {roll.analysis ? (
        <div className="mt-6 space-y-5 border border-line bg-surface p-6">
          <p>{roll.analysis.summary}</p>
          <p className="text-muted">{roll.analysis.technicalRead}</p>
          <ul className="flex flex-wrap gap-2">
            {roll.analysis.themes.map((theme) => (
              <li key={theme} className="border border-line px-2 py-1 text-sm">
                {theme}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Generated {formatDateTime(roll.analysis.generatedAt)}</p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">No analysis yet.</p>
      )}
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
