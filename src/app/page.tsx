"use client";

import { ButtonLink } from "@/components/Button";
import { useArchive } from "@/components/ArchiveProvider";
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
        <div className="mt-16 max-w-lg border border-line bg-surface px-6 py-8">
          <p className="font-serif text-2xl">Start with a film roll.</p>
          <p className="mt-3 text-muted">
            Create a roll, add frames and notes, then generate a contact sheet and an analysis of
            the sequence.
          </p>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto border-t border-line">
          <table className="w-full min-w-[40rem] text-left">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="py-3 pr-4 font-normal">Roll</th>
                <th className="py-3 pr-4 font-normal">Stock</th>
                <th className="py-3 pr-4 font-normal">Camera</th>
                <th className="py-3 pr-4 font-normal">Started</th>
                <th className="py-3 font-normal">Frames</th>
              </tr>
            </thead>
            <tbody>
              {rolls.map((roll) => (
                <tr key={roll.id} className="border-b border-line">
                  <td className="py-4 pr-4">
                    <Link href={`/rolls/${roll.id}`} className="font-medium hover:text-cobalt">
                      {roll.title}
                    </Link>
                  </td>
                  <td className="py-4 pr-4 text-muted">
                    {roll.filmStock || "—"}
                    {roll.iso ? ` / ${roll.iso}` : ""}
                  </td>
                  <td className="py-4 pr-4 text-muted">{roll.camera || "—"}</td>
                  <td className="py-4 pr-4 text-muted">{formatDate(roll.startedOn)}</td>
                  <td className="py-4 text-muted">{roll.frames.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
