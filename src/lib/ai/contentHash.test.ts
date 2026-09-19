import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintFromRoll, hashRoll, hashRollContent } from "./contentHash.ts";
import type { FilmRoll, RollContentFingerprint } from "../types.ts";

function baseFingerprint(overrides: Partial<RollContentFingerprint> = {}): RollContentFingerprint {
  return {
    rollId: "11111111-1111-4111-8111-111111111111",
    title: "Morning walk",
    filmStock: "Kodak Portra 400",
    iso: "400",
    camera: "Olympus XA",
    startedOn: "2026-03-01",
    frames: [
      {
        number: 1,
        caption: "Doorway",
        location: "Lublin, Poland",
        aperture: "f/2.8",
        shutterSpeed: "1/125",
        imageUrl: "https://example.com/a.jpg",
      },
      {
        number: 2,
        caption: "Street",
        location: "Lublin, Poland",
        aperture: "f/4",
        shutterSpeed: "1/250",
        imageUrl: "https://example.com/b.jpg",
      },
    ],
    notes: ["Overcast"],
    ...overrides,
  };
}

function baseRoll(overrides: Partial<FilmRoll> = {}): FilmRoll {
  const fingerprint = baseFingerprint();
  return {
    id: fingerprint.rollId,
    title: fingerprint.title,
    filmStock: fingerprint.filmStock,
    iso: fingerprint.iso,
    camera: fingerprint.camera,
    startedOn: fingerprint.startedOn,
    createdAt: "2026-03-01T10:00:00.000Z",
    frames: fingerprint.frames.map((frame, index) => ({
      id: `frame-${index}`,
      createdAt: "2026-03-01T10:00:00.000Z",
      ...frame,
    })),
    notes: fingerprint.notes.map((body, index) => ({
      id: `note-${index}`,
      body,
      imageUrl: null,
      ocrText: "",
      createdAt: "2026-03-01T10:00:00.000Z",
    })),
    contactSheetGeneratedAt: null,
    analysis: null,
    ...overrides,
  };
}

test("same archive state produces the same hash", () => {
  const a = hashRollContent(baseFingerprint());
  const b = hashRollContent(baseFingerprint());
  assert.equal(a, b);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("hashRoll matches hashRollContent(fingerprintFromRoll)", () => {
  const roll = baseRoll();
  assert.equal(hashRoll(roll), hashRollContent(fingerprintFromRoll(roll)));
});

test("sequence of frame content matters", () => {
  const ordered = hashRollContent(baseFingerprint());
  const swappedContent = hashRollContent(
    baseFingerprint({
      frames: [
        {
          number: 1,
          caption: "Street",
          location: "Lublin, Poland",
          aperture: "f/4",
          shutterSpeed: "1/250",
          imageUrl: "https://example.com/b.jpg",
        },
        {
          number: 2,
          caption: "Doorway",
          location: "Lublin, Poland",
          aperture: "f/2.8",
          shutterSpeed: "1/125",
          imageUrl: "https://example.com/a.jpg",
        },
      ],
    }),
  );
  assert.notEqual(ordered, swappedContent);
});

test("fingerprintFromRoll sorts frames by number before hashing", () => {
  const roll = baseRoll({
    frames: [
      {
        id: "f2",
        number: 2,
        caption: "Street",
        location: "Lublin, Poland",
        aperture: "f/4",
        shutterSpeed: "1/250",
        imageUrl: "https://example.com/b.jpg",
        createdAt: "2026-03-01T10:00:00.000Z",
      },
      {
        id: "f1",
        number: 1,
        caption: "Doorway",
        location: "Lublin, Poland",
        aperture: "f/2.8",
        shutterSpeed: "1/125",
        imageUrl: "https://example.com/a.jpg",
        createdAt: "2026-03-01T10:00:00.000Z",
      },
    ],
  });
  assert.equal(hashRoll(roll), hashRollContent(baseFingerprint()));
});

test("changed photograph URL changes hash", () => {
  const base = hashRollContent(baseFingerprint());
  const changed = hashRollContent(
    baseFingerprint({
      frames: [
        { ...baseFingerprint().frames[0], imageUrl: "https://example.com/changed.jpg" },
        baseFingerprint().frames[1],
      ],
    }),
  );
  assert.notEqual(base, changed);
});

test("changed caption changes hash", () => {
  const base = hashRollContent(baseFingerprint());
  const changed = hashRollContent(
    baseFingerprint({
      frames: [
        { ...baseFingerprint().frames[0], caption: "Other doorway" },
        baseFingerprint().frames[1],
      ],
    }),
  );
  assert.notEqual(base, changed);
});

test("changed location changes hash", () => {
  const base = hashRollContent(baseFingerprint());
  const changed = hashRollContent(
    baseFingerprint({
      frames: [
        { ...baseFingerprint().frames[0], location: "Warsaw, Poland" },
        baseFingerprint().frames[1],
      ],
    }),
  );
  assert.notEqual(base, changed);
});

test("changed exposure metadata changes hash", () => {
  const base = hashRollContent(baseFingerprint());
  const aperture = hashRollContent(
    baseFingerprint({
      frames: [
        { ...baseFingerprint().frames[0], aperture: "f/8" },
        baseFingerprint().frames[1],
      ],
    }),
  );
  const shutter = hashRollContent(
    baseFingerprint({
      frames: [
        { ...baseFingerprint().frames[0], shutterSpeed: "1/60" },
        baseFingerprint().frames[1],
      ],
    }),
  );
  assert.notEqual(base, aperture);
  assert.notEqual(base, shutter);
});

test("changed note changes hash", () => {
  const base = hashRollContent(baseFingerprint());
  const changed = hashRollContent(baseFingerprint({ notes: ["Sunny"] }));
  assert.notEqual(base, changed);
});

test("changed roll metadata changes hash", () => {
  const base = hashRollContent(baseFingerprint());
  assert.notEqual(base, hashRollContent(baseFingerprint({ title: "Evening walk" })));
  assert.notEqual(base, hashRollContent(baseFingerprint({ filmStock: "HP5" })));
  assert.notEqual(base, hashRollContent(baseFingerprint({ iso: "200" })));
  assert.notEqual(base, hashRollContent(baseFingerprint({ camera: "Leica M6" })));
  assert.notEqual(base, hashRollContent(baseFingerprint({ startedOn: "2026-04-01" })));
  assert.notEqual(base, hashRollContent(baseFingerprint({ rollId: "22222222-2222-4222-8222-222222222222" })));
});
