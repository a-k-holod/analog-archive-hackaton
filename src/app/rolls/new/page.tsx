"use client";

import { useArchive } from "@/components/ArchiveProvider";
import { Button } from "@/components/Button";
import { FilmStockPicker } from "@/components/FilmStockPicker";
import { Field, inputClassName } from "@/components/Field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewRollPage() {
  const router = useRouter();
  const { createRoll } = useArchive();
  const [title, setTitle] = useState("");
  const [filmStockId, setFilmStockId] = useState<string | null>(null);
  const [filmStock, setFilmStock] = useState("");
  const [iso, setIso] = useState("");
  const [camera, setCamera] = useState("");
  const [startedOn, setStartedOn] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length === 0) {
      setError("Give the roll a name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const roll = await createRoll({
        title,
        filmStock,
        filmStockId,
        iso,
        camera,
        startedOn,
      });
      router.push(`/rolls/${roll.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this roll.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <Link href="/" className="meta transition-colors hover:text-ink">
        ← Archive
      </Link>
      <h1 className="mt-4 font-serif text-[2.5rem] leading-none tracking-tight sm:text-5xl">
        New roll
      </h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
        Record the film, camera, and when you started shooting.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-7">
        <Field label="Roll name">
          <input
            className={inputClassName}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Kyoto, March"
            autoFocus
          />
        </Field>
        <FilmStockPicker
          filmStock={filmStock}
          filmStockId={filmStockId}
          iso={iso}
          onChange={(selection) => {
            setFilmStock(selection.filmStock);
            setFilmStockId(selection.filmStockId);
            setIso(selection.iso);
          }}
        />
        <div className="max-w-32">
          <Field label="Exposure index">
            <input
              className={`${inputClassName} font-mono tracking-wide`}
              value={iso}
              onChange={(event) => setIso(event.target.value)}
              placeholder="400"
            />
          </Field>
        </div>
        <Field label="Camera">
          <input
            className={inputClassName}
            value={camera}
            onChange={(event) => setCamera(event.target.value)}
            placeholder="Leica M6"
          />
        </Field>
        <Field label="Started on">
          <input
            type="date"
            className={`${inputClassName} font-mono tracking-wide`}
            value={startedOn}
            onChange={(event) => setStartedOn(event.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="pt-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create roll"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
