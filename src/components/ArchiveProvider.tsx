"use client";

import {
  addFrame,
  addNote,
  createRoll,
  generateContactSheet,
  getArchiveSnapshot,
  getServerArchiveSnapshot,
  saveAnalysis,
  saveDevelopment,
  saveNoteOcrText,
  subscribeArchive,
  updateFrame,
  updateRollFilmStock,
} from "@/lib/archiveStore";
import type { FilmRoll } from "@/lib/types";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

type ArchiveContextValue = {
  ready: boolean;
  rolls: FilmRoll[];
  getRoll: (id: string) => FilmRoll | undefined;
  createRoll: typeof createRoll;
  addFrame: typeof addFrame;
  addNote: typeof addNote;
  saveNoteOcrText: typeof saveNoteOcrText;
  saveDevelopment: typeof saveDevelopment;
  updateFrame: typeof updateFrame;
  updateRollFilmStock: typeof updateRollFilmStock;
  generateContactSheet: typeof generateContactSheet;
  saveAnalysis: typeof saveAnalysis;
};

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const archive = useSyncExternalStore(
    subscribeArchive,
    getArchiveSnapshot,
    getServerArchiveSnapshot,
  );

  const value = useMemo<ArchiveContextValue>(
    () => ({
      ready: archive.ready,
      rolls: archive.rolls,
      getRoll: (id: string) => archive.rolls.find((roll) => roll.id === id),
      createRoll,
      addFrame,
      addNote,
      saveNoteOcrText,
      saveDevelopment,
      updateFrame,
      updateRollFilmStock,
      generateContactSheet,
      saveAnalysis,
    }),
    [archive],
  );

  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>;
}

export function useArchive(): ArchiveContextValue {
  const context = useContext(ArchiveContext);
  if (!context) {
    throw new Error("useArchive must be used inside ArchiveProvider.");
  }
  return context;
}
