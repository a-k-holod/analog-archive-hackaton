"use client";

import { useArchive } from "@/components/ArchiveProvider";
import { Button } from "@/components/Button";
import { Field, inputClassName } from "@/components/Field";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewRollPage() {
  const router = useRouter();
  const { createRoll } = useArchive();
  const [title, setTitle] = useState("");
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
      const roll = await createRoll({ title, filmStock, iso, camera, startedOn });
      router.push(`/rolls/${roll.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this roll.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl tracking-tight">New roll</h1>
      <p className="mt-2 text-muted">Record the film, camera, and when you started shooting.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field label="Roll name">
          <input
            className={inputClassName}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Kyoto, March"
            autoFocus
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Film stock">
            <input
              className={inputClassName}
              value={filmStock}
              onChange={(event) => setFilmStock(event.target.value)}
              placeholder="Ilford HP5 Plus"
            />
          </Field>
          <Field label="ISO">
            <input
              className={inputClassName}
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
            className={inputClassName}
            value={startedOn}
            onChange={(event) => setStartedOn(event.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-[#8a2a2a]">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create roll"}
        </Button>
      </form>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
