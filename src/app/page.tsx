"use client";

import { ButtonLink } from "@/components/Button";
import { useArchive } from "@/components/ArchiveProvider";
import type { FilmRoll } from "@/lib/types";
import Link from "next/link";

export default function ArchivePage() {
  const { ready, rolls } = useArchive();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Archive</h1>
          <p className="mt-2 max-w-xl text-muted">
            {ready
              ? rolls.length === 0
                ? "No film rolls yet."
                : `${rolls.length} ${rolls.length === 1 ? "roll" : "rolls"} in the archive.`
              : "Opening the archive."}
          </p>
        </div>
        <ButtonLink href="/rolls/new">New roll</ButtonLink>
      </div>

      {!ready ? (
        <p className="mt-16 text-sm text-muted">Loading saved rolls…</p>
      ) : rolls.length === 0 ? (
        <div className="mt-16 max-w-lg border-t border-line pt-8">
          <p className="font-serif text-2xl">Start with a film roll.</p>
          <p className="mt-3 text-muted">
            Create a roll, add frames and notes, then generate a contact sheet and an analysis of
            the sequence.
          </p>
        </div>
      ) : (
        <ul className="mt-10 border-t border-line">
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
        className="group flex gap-4 py-5 transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[rgba(42,77,115,0.04)] sm:gap-6 sm:py-6"
      >
        <div className="h-16 w-20 shrink-0 overflow-hidden bg-[#d7dbe1] sm:h-[4.5rem] sm:w-24">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[0.65rem] tracking-wide text-muted">
              —
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-serif text-xl tracking-tight text-ink group-hover:text-cobalt sm:text-[1.35rem]">
              {roll.title}
            </h2>
            <p className="text-sm text-muted">
              {roll.frames.length} {roll.frames.length === 1 ? "frame" : "frames"}
            </p>
          </div>

          <dl className="mt-2 grid gap-1 text-sm text-muted sm:mt-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-8 sm:gap-y-1">
            <div className="min-w-0">
              <dt className="sr-only">Film stock</dt>
              <dd className="truncate">{stockLine || "Film stock not recorded"}</dd>
            </div>
            <div className="sm:text-right">
              <dt className="sr-only">Started</dt>
              <dd>{formatDate(roll.startedOn)}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="sr-only">Camera</dt>
              <dd className="truncate">{roll.camera || "Camera not recorded"}</dd>
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
