import { createId } from "@/lib/ids";
import { loadArchive, saveArchive } from "@/lib/storage";
import {
  fetchArchive,
  insertFrame,
  insertNote,
  insertRoll,
  updateContactSheetGeneratedAt,
  uploadPhotograph,
} from "@/lib/supabase/archive";
import { hasConfiguredSupabaseEnv } from "@/lib/supabase/env";
import type { FilmRoll, NewFrameInput, NewRollInput, RollAnalysis } from "@/lib/types";

export type ArchiveSnapshot = {
  ready: boolean;
  rolls: FilmRoll[];
};

const listeners = new Set<() => void>();
const serverSnapshot: ArchiveSnapshot = { ready: false, rolls: [] };

let snapshot: ArchiveSnapshot = serverSnapshot;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export function subscribeArchive(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  if (!hydrated && typeof window !== "undefined") {
    void ensureHydrated();
  }

  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getArchiveSnapshot(): ArchiveSnapshot {
  return snapshot;
}

export function getServerArchiveSnapshot(): ArchiveSnapshot {
  return serverSnapshot;
}

export async function createRoll(input: NewRollInput): Promise<FilmRoll> {
  await ensureHydrated();

  const roll: FilmRoll = {
    id: createId(),
    title: input.title.trim(),
    filmStock: input.filmStock.trim(),
    iso: input.iso.trim(),
    camera: input.camera.trim(),
    startedOn: input.startedOn,
    createdAt: new Date().toISOString(),
    frames: [],
    notes: [],
    contactSheetGeneratedAt: null,
    analysis: null,
  };

  if (canUseSupabase()) {
    await insertRoll({
      id: roll.id,
      title: roll.title,
      filmStock: roll.filmStock,
      iso: roll.iso,
      camera: roll.camera,
      startedOn: roll.startedOn,
      createdAt: roll.createdAt,
    });
  }

  commit([roll, ...snapshot.rolls]);
  return roll;
}

export async function addFrame(rollId: string, input: NewFrameInput): Promise<void> {
  await ensureHydrated();

  const roll = snapshot.rolls.find((item) => item.id === rollId);
  if (!roll) {
    throw new Error("Roll not found.");
  }

  const frameId = createId();
  const createdAt = new Date().toISOString();
  const nextNumber = roll.frames.reduce((max, frame) => Math.max(max, frame.number), 0) + 1;
  let imageUrl: string | null = null;

  if (canUseSupabase()) {
    if (input.imageBlob) {
      imageUrl = await uploadPhotograph({
        rollId,
        frameId,
        blob: input.imageBlob,
      });
    }

    await insertFrame({
      rollId,
      frameId,
      number: nextNumber,
      input,
      imageUrl,
      createdAt,
      nextFrameCount: roll.frames.length + 1,
    });
  } else if (input.imageBlob) {
    imageUrl = await blobToDataUrl(input.imageBlob);
  }

  commit(
    snapshot.rolls.map((item) => {
      if (item.id !== rollId) {
        return item;
      }

      return {
        ...item,
        frames: [
          ...item.frames,
          {
            id: frameId,
            number: nextNumber,
            imageUrl,
            caption: input.caption.trim(),
            location: input.location.trim(),
            aperture: input.aperture.trim(),
            shutterSpeed: input.shutterSpeed.trim(),
            createdAt,
          },
        ],
        contactSheetGeneratedAt: null,
        analysis: null,
      };
    }),
  );
}

export async function addNote(rollId: string, body: string): Promise<void> {
  await ensureHydrated();

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return;
  }

  const noteId = createId();
  const createdAt = new Date().toISOString();

  if (canUseSupabase()) {
    await insertNote({
      noteId,
      rollId,
      body: trimmed,
      createdAt,
    });
  }

  commit(
    snapshot.rolls.map((roll) =>
      roll.id === rollId
        ? {
            ...roll,
            notes: [
              ...roll.notes,
              {
                id: noteId,
                body: trimmed,
                createdAt,
              },
            ],
            analysis: null,
          }
        : roll,
    ),
  );
}

export async function generateContactSheet(rollId: string): Promise<void> {
  await ensureHydrated();
  const generatedAt = new Date().toISOString();

  if (canUseSupabase()) {
    await updateContactSheetGeneratedAt(rollId, generatedAt);
  }

  commit(
    snapshot.rolls.map((roll) =>
      roll.id === rollId ? { ...roll, contactSheetGeneratedAt: generatedAt } : roll,
    ),
  );
}

export async function saveAnalysis(rollId: string, analysis: RollAnalysis): Promise<void> {
  await ensureHydrated();
  // Analysis stays local/cache-only for this pass (no roll_insights writes yet).
  commit(snapshot.rolls.map((roll) => (roll.id === rollId ? { ...roll, analysis } : roll)));
}

async function ensureHydrated(): Promise<void> {
  if (hydrated || typeof window === "undefined") {
    return;
  }

  if (!hydratePromise) {
    hydratePromise = hydrate();
  }

  await hydratePromise;
}

async function hydrate(): Promise<void> {
  if (hydrated || typeof window === "undefined") {
    return;
  }

  try {
    if (canUseSupabase()) {
      const rolls = await fetchArchive();
      snapshot = { ready: true, rolls };
      saveArchive({ rolls });
      hydrated = true;
      emit();
      return;
    }
  } catch (error) {
    console.warn("Supabase archive hydrate failed; using localStorage cache.", error);
  }

  snapshot = { ready: true, rolls: loadArchive().rolls };
  hydrated = true;
  emit();
}

function commit(next: FilmRoll[]): void {
  snapshot = { ready: true, rolls: next };
  saveArchive({ rolls: next });
  emit();
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function canUseSupabase(): boolean {
  return typeof window !== "undefined" && hasConfiguredSupabaseEnv();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read photograph for local cache."));
    };
    reader.onerror = () => reject(new Error("Could not read photograph for local cache."));
    reader.readAsDataURL(blob);
  });
}
