"use client";

import { ButtonLink } from "@/components/Button";
import { useArchive } from "@/components/ArchiveProvider";
import { Field, inputClassName } from "@/components/Field";
import type { FilmRoll } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ArchivePage() {
  const { ready, rolls } = useArchive();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="section-kicker">Collection</p>
          <h1 className="mt-2 font-serif text-[2.5rem] leading-none tracking-tight sm:text-5xl">
            Archive
          </h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
            {ready
              ? rolls.length === 0
                ? "No film rolls yet."
                : `${rolls.length} ${rolls.length === 1 ? "roll" : "rolls"} in the archive.`
              : "Opening the archive."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <ButtonLink href="/rolls/new">New roll</ButtonLink>
        </div>
      </div>

      <form
        onSubmit={onSearch}
        role="search"
        className="mt-10 max-w-xl border-t border-line pt-8 sm:mt-12 sm:pt-10"
      >
        <Field label="Search photographs, rolls, and notes">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A place, film stock, caption, or note…"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className={`${inputClassName} text-lg sm:text-xl`}
          />
        </Field>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-sm text-muted">Explore the archive by what you remember.</p>
          <Link
            href="/search"
            className="meta shrink-0 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-ink"
          >
            Open search
          </Link>
        </div>
      </form>

      {!ready ? (
        <p className="loading-pulse meta mt-16">Loading saved rolls…</p>
      ) : rolls.length === 0 ? (
        <div className="mt-16 max-w-md border-t border-line pt-10">
          <p className="font-serif text-2xl leading-snug tracking-tight">Start with a film roll.</p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
            Create a roll, add frames and notes, then generate a contact sheet and a reading of the
            sequence.
          </p>
          <div className="mt-8">
            <ButtonLink href="/rolls/new">New roll</ButtonLink>
          </div>
        </div>
      ) : (
        <ul className="mt-12 border-t border-line">
          {rolls.map((roll) => (
            <RollRow key={roll.id} roll={roll} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RollRow({ roll }: { roll: FilmRoll }) {
  const thumb = firstFrameImage(roll);
  const stockLine = [roll.filmStock || null, roll.iso ? `ISO ${roll.iso}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="border-b border-line">
      <Link
        href={`/rolls/${roll.id}`}
        className="group flex gap-4 py-5 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink/[0.03] sm:gap-7 sm:py-7"
      >
        <div className="h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden bg-matte sm:h-24 sm:w-32">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center meta">—</div>
          )}
        </div>

        <div className="min-w-0 flex-1 self-center">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-serif text-xl tracking-tight text-ink transition-colors duration-150 group-hover:text-cobalt sm:text-[1.4rem]">
              {roll.title}
            </h2>
            <p className="meta">
              {roll.frames.length} {roll.frames.length === 1 ? "frame" : "frames"}
            </p>
          </div>

          <dl className="mt-2.5 grid gap-1 sm:mt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-10">
            <div className="min-w-0">
              <dt className="sr-only">Film stock</dt>
              <dd className="meta truncate">{stockLine || "Film stock not recorded"}</dd>
            </div>
            <div className="sm:text-right">
              <dt className="sr-only">Started</dt>
              <dd className="meta">{formatDate(roll.startedOn)}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="sr-only">Camera</dt>
              <dd className="truncate text-sm text-muted">{roll.camera || "Camera not recorded"}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </li>
  );
}

function firstFrameImage(roll: FilmRoll): string | null {
  for (const frame of roll.frames) {
    if (frame.imageUrl) {
      return frame.imageUrl;
    }
  }
  return null;
}

function formatDate(value: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
