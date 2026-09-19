import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFrameIndexIdentity,
  frameContentKey,
  hashContentString,
} from "./indexIdentity.ts";
import {
  decideIndexingAction,
  planIncrementalIndexing,
} from "./incremental.ts";
import { normalizeSearchText, tokenizeQuery } from "./normalize.ts";
import { mergeSearchHits, normalizeScores } from "./ranking.ts";
import { cosineSimilarity, rankByCosineSimilarity } from "./semanticRanking.ts";
import {
  formatSearchHitSummary,
  groupSearchHitsByKind,
  photographHitKey,
  searchMetadata,
  summarizeSearchHits,
} from "./textSearch.ts";
import type { FilmRoll, Frame, Note } from "../types.ts";
import type { SearchHit } from "./types.ts";

function frame(overrides: Partial<Frame> & Pick<Frame, "id" | "number">): Frame {
  return {
    imageUrl: null,
    caption: "",
    location: "",
    aperture: "",
    shutterSpeed: "",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function note(
  body: string,
  id = "n1",
  imageUrl: string | null = null,
  ocrText = "",
): Note {
  return {
    id,
    body,
    imageUrl,
    ocrText,
    createdAt: "2026-03-01T00:00:00.000Z",
  };
}

function roll(overrides: Partial<FilmRoll> = {}): FilmRoll {
  return {
    id: "roll-1",
    title: "Austin winter walk",
    filmStock: "Ilford HP5",
    iso: "400",
    camera: "Leica M6",
    startedOn: "2026-01-12",
    createdAt: "2026-01-12T00:00:00.000Z",
    frames: [
      frame({
        id: "f1",
        number: 1,
        caption: "Black and white street",
        location: "Austin, TX",
        imageUrl: "https://cdn.example.com/rolls/r1/f1.jpg",
      }),
      frame({
        id: "f2",
        number: 2,
        caption: "Parked car on Congress",
        location: "Austin, TX",
        imageUrl: "https://cdn.example.com/rolls/r1/f2.jpg",
      }),
      frame({
        id: "f3",
        number: 3,
        caption: "Cafe window",
        location: "Lublin, Poland",
        imageUrl: null,
      }),
    ],
    notes: [note("Cold morning; shot mostly street scenes.")],
    contactSheetGeneratedAt: null,
    analysis: null,
    ...overrides,
  };
}

test("normalizeSearchText lowercases and collapses whitespace", () => {
  assert.equal(normalizeSearchText("  Black   AND White! "), "black and white");
});

test("tokenizeQuery splits on whitespace", () => {
  assert.deepEqual(tokenizeQuery("black and white"), ["black", "and", "white"]);
  assert.deepEqual(tokenizeQuery("   "), []);
});

test("text search finds caption and location phrases", () => {
  const hits = searchMetadata([roll()], { text: "winter" });
  assert.ok(hits.some((hit) => hit.objectKind === "roll"));
  assert.equal(hits.find((hit) => hit.objectKind === "roll")!.rollTitle, "Austin winter walk");

  const bw = searchMetadata([roll()], { text: "black and white" });
  assert.ok(bw.some((hit) => hit.frameId === "f1" && hit.objectKind === "photograph"));
  assert.ok(bw.find((hit) => hit.frameId === "f1")!.matchedFields.includes("caption"));

  const car = searchMetadata([roll()], { text: "car" });
  assert.ok(car.some((hit) => hit.frameId === "f2" && hit.objectKind === "photograph"));

  const street = searchMetadata([roll()], { text: "street" });
  assert.ok(street.some((hit) => hit.objectKind === "photograph" || hit.objectKind === "note"));

  const austin = searchMetadata([roll()], { text: "Austin" });
  assert.ok(austin.some((hit) => hit.matchedFields.includes("location")));
});

test("text search matches film stock and camera as roll hits", () => {
  const film = searchMetadata([roll()], { text: "HP5" });
  assert.ok(film.some((hit) => hit.objectKind === "roll"));
  assert.ok(film.find((hit) => hit.objectKind === "roll")!.matchedFields.includes("filmStock"));

  const camera = searchMetadata([roll()], { text: "Leica" });
  assert.ok(camera.some((hit) => hit.objectKind === "roll"));
  assert.ok(camera.find((hit) => hit.objectKind === "roll")!.matchedFields.includes("camera"));
});

test("text search returns distinct note hits", () => {
  const notes = searchMetadata([roll()], { text: "Cold morning" });
  assert.equal(notes.filter((hit) => hit.objectKind === "note").length, 1);
  assert.ok(notes.some((hit) => hit.objectKind === "note" && hit.matchedFields.includes("note")));
});

test("handwritten notes with OCR text are searchable as OCR matches", () => {
  const withOcr = roll({
    notes: [
      note("", "n-ocr", "https://cdn.example.com/note.jpg", "Sławinek morning fog"),
    ],
  });
  const hits = searchMetadata([withOcr], { text: "Sławinek" });
  const noteHit = hits.find((hit) => hit.objectKind === "note");
  assert.ok(noteHit);
  assert.equal(noteHit!.noteId, "n-ocr");
  assert.ok(noteHit!.matchedFields.includes("ocr"));
  assert.ok(!noteHit!.matchedFields.includes("note"));
});

test("empty OCR text does not match search queries", () => {
  const emptyOcr = roll({
    notes: [note("", "n-empty", "https://cdn.example.com/note.jpg", "   ")],
  });
  const hits = searchMetadata([emptyOcr], { text: "Sławinek" });
  assert.equal(
    hits.filter((hit) => hit.objectKind === "note" && hit.noteId === "n-empty").length,
    0,
  );
});

test("manual note body stays distinct from OCR field matches", () => {
  const mixed = roll({
    notes: [
      note("Developed in Rodinal", "n-typed", null, ""),
      note("", "n-hand", "https://cdn.example.com/n.jpg", "Sławinek park"),
    ],
  });
  const bodyHits = searchMetadata([mixed], { text: "Rodinal" });
  assert.ok(
    bodyHits.some(
      (hit) => hit.objectKind === "note" && hit.matchedFields.includes("note") && !hit.matchedFields.includes("ocr"),
    ),
  );
  const ocrHits = searchMetadata([mixed], { text: "Sławinek" });
  assert.ok(
    ocrHits.some(
      (hit) => hit.objectKind === "note" && hit.matchedFields.includes("ocr") && !hit.matchedFields.includes("note"),
    ),
  );
});

test("image-only handwritten notes are searchable via surrogate text", () => {
  const withPhotoOnly = roll({
    notes: [note("", "hn1", "https://cdn.example.com/notes/hn1.jpg")],
  });
  const hits = searchMetadata([withPhotoOnly], { text: "handwritten" });
  assert.ok(hits.some((hit) => hit.objectKind === "note" && hit.noteId === "hn1"));
});

test("notes on frame-less rolls remain searchable", () => {
  const notesOnly = roll({
    frames: [],
    notes: [note("development: pull one stop", "n-only")],
  });
  const hits = searchMetadata([notesOnly], { text: "pull one stop" });
  assert.ok(hits.some((hit) => hit.objectKind === "note" && hit.noteId === "n-only"));
});

test("text search returns empty for blank query", () => {
  assert.deepEqual(searchMetadata([roll()], { text: "   " }), []);
});

test("text search ranks photograph caption matches above note-only hits", () => {
  const hits = searchMetadata([roll()], { text: "street" });
  const captionHit = hits.find((hit) => hit.frameId === "f1" && hit.objectKind === "photograph");
  const noteOnlyRoll = roll({
    title: "Other",
    frames: [frame({ id: "f9", number: 1, caption: "Quiet room" })],
    notes: [note("street notes only")],
  });
  const noteHits = searchMetadata([noteOnlyRoll], { text: "street" });
  assert.ok(captionHit);
  assert.ok(noteHits[0]);
  assert.ok(captionHit!.score > noteHits[0]!.score);
});

test("newly added frames and notes are searchable without a rebuild", () => {
  const base = roll({ frames: [], notes: [] });
  assert.deepEqual(searchMetadata([base], { text: "harbor" }), []);

  const afterImport: FilmRoll = {
    ...base,
    frames: [
      frame({
        id: "f-new",
        number: 1,
        caption: "Harbor light",
        location: "Gdańsk",
      }),
    ],
    notes: [note("Developed in Rodinal", "n-new")],
  };

  const captionHits = searchMetadata([afterImport], { text: "harbor" });
  assert.ok(captionHits.some((hit) => hit.frameId === "f-new"));

  const noteHits = searchMetadata([afterImport], { text: "Rodinal" });
  assert.ok(noteHits.some((hit) => hit.objectKind === "note" && hit.noteId === "n-new"));
});

test("summarizeSearchHits counts object kinds", () => {
  const hits = searchMetadata([roll()], { text: "Austin" });
  const summary = summarizeSearchHits(hits);
  assert.equal(summary.total, hits.length);
  assert.ok(summary.photographs >= 1);
});

test("frame caption match creates a photograph hit", () => {
  const archive = [
    roll({
      title: "Unrelated roll title",
      frames: [
        frame({
          id: "f-cap",
          number: 1,
          caption: "Winter freeze along the river",
          location: "Sławinek, Lublin",
        }),
      ],
      notes: [],
    }),
  ];
  const hits = searchMetadata(archive, { text: "Winter freeze" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.objectKind, "photograph");
  assert.equal(hits[0]!.frameId, "f-cap");
  assert.ok(hits[0]!.matchedFields.includes("caption"));
});

test("roll title match creates a roll hit", () => {
  const archive = [
    roll({
      title: "Walk in Winter 2021",
      frames: [
        frame({
          id: "f1",
          number: 1,
          caption: "Quiet street",
          location: "Kraków",
        }),
      ],
      notes: [],
    }),
  ];
  const hits = searchMetadata(archive, { text: "Walk in Winter" });
  assert.ok(hits.some((hit) => hit.objectKind === "roll"));
  const rollHit = hits.find((hit) => hit.objectKind === "roll")!;
  assert.equal(rollHit.rollTitle, "Walk in Winter 2021");
  assert.ok(rollHit.matchedFields.includes("rollTitle"));
  assert.equal(rollHit.frameCount, 1);
  assert.equal(
    hits.filter((hit) => hit.objectKind === "photograph").length,
    0,
  );
});

test("frame caption match does not create a parent roll hit", () => {
  const archive = [
    roll({
      title: "Unrelated roll title",
      filmStock: "Ilford HP5",
      camera: "Leica M6",
      startedOn: "2021-01-01",
      frames: [
        frame({
          id: "f-winter",
          number: 1,
          caption: "Walk in winter light",
          location: "Austin, TX",
        }),
      ],
      notes: [],
    }),
  ];
  const hits = searchMetadata(archive, { text: "winter" });
  assert.ok(hits.some((hit) => hit.objectKind === "photograph" && hit.frameId === "f-winter"));
  assert.equal(
    hits.filter((hit) => hit.objectKind === "roll").length,
    0,
    "parent roll must not appear merely because a child frame matched",
  );
});

test("note body and OCR matches create note hits", () => {
  const archive = [
    roll({
      title: "Process notes",
      frames: [],
      notes: [
        note("Developed in Rodinal", "n-body"),
        note("", "n-ocr", "https://cdn.example.com/note.jpg", "Sławinek morning fog"),
      ],
    }),
  ];

  const bodyHits = searchMetadata(archive, { text: "Rodinal" });
  assert.equal(bodyHits.length, 1);
  assert.equal(bodyHits[0]!.objectKind, "note");
  assert.equal(bodyHits[0]!.noteId, "n-body");
  assert.ok(bodyHits[0]!.matchedFields.includes("note"));

  const ocrHits = searchMetadata(archive, { text: "Sławinek" });
  assert.equal(ocrHits.length, 1);
  assert.equal(ocrHits[0]!.objectKind, "note");
  assert.equal(ocrHits[0]!.noteId, "n-ocr");
  assert.ok(ocrHits[0]!.matchedFields.includes("ocr"));
  assert.ok(ocrHits[0]!.noteOcrText.includes("Sławinek"));
});

test("mixed results are grouped by archive object kind", () => {
  const archive = [
    roll({
      id: "roll-winter",
      title: "Walk in Winter 2021",
      filmStock: "Fomapan 400",
      camera: "Canon A-1",
      frames: [
        frame({
          id: "f-winter",
          number: 1,
          caption: "Winter freeze",
          location: "Sławinek, Lublin",
        }),
        frame({
          id: "f-other",
          number: 2,
          caption: "Cafe window",
          location: "Lublin",
        }),
      ],
      notes: [note("Cold winter lab notes", "n-winter")],
    }),
  ];

  const hits = searchMetadata(archive, { text: "winter" });
  const grouped = groupSearchHitsByKind(hits);
  const summary = summarizeSearchHits(hits);

  assert.ok(grouped.photographs.length >= 1);
  assert.ok(grouped.rolls.length === 1);
  assert.ok(grouped.notes.length === 1);
  assert.ok(grouped.photographs.every((hit) => hit.objectKind === "photograph"));
  assert.ok(grouped.rolls.every((hit) => hit.objectKind === "roll"));
  assert.ok(grouped.notes.every((hit) => hit.objectKind === "note"));

  assert.equal(
    formatSearchHitSummary(summary),
    `${summary.photographs} ${summary.photographs === 1 ? "photograph" : "photographs"} · ${summary.rolls} ${summary.rolls === 1 ? "roll" : "rolls"} · ${summary.notes} ${summary.notes === 1 ? "note" : "notes"}`,
  );
  assert.ok(!formatSearchHitSummary(summary).includes("result"));
});

test("hashContentString is stable and sensitive to change", () => {
  assert.equal(hashContentString("abc"), hashContentString("abc"));
  assert.notEqual(hashContentString("abc"), hashContentString("abd"));
});

test("frameContentKey is null without image and changes when URL changes", () => {
  assert.equal(frameContentKey(null), null);
  assert.equal(frameContentKey(""), null);
  const a = frameContentKey("https://cdn.example.com/a.jpg");
  const b = frameContentKey("https://cdn.example.com/b.jpg");
  assert.ok(a);
  assert.ok(b);
  assert.notEqual(a, b);
});

test("buildFrameIndexIdentity ties frame, roll, content, and model", () => {
  const identity = buildFrameIndexIdentity(
    "roll-1",
    { id: "f1", imageUrl: "https://cdn.example.com/a.jpg" },
    "model-a",
  );
  assert.ok(identity);
  assert.equal(identity!.frameId, "f1");
  assert.equal(identity!.rollId, "roll-1");
  assert.equal(identity!.modelId, "model-a");
  assert.equal(identity!.contentKey, frameContentKey("https://cdn.example.com/a.jpg"));
});

test("incremental indexing skips current frames and reindexes on content change", () => {
  const identity = buildFrameIndexIdentity(
    "roll-1",
    { id: "f1", imageUrl: "https://cdn.example.com/a.jpg" },
    "clip-v1",
  )!;

  assert.deepEqual(
    decideIndexingAction(identity, {
      frameId: "f1",
      contentKey: identity.contentKey,
      modelId: "clip-v1",
    }),
    { action: "skip", reason: "already-current" },
  );

  assert.deepEqual(
    decideIndexingAction(identity, {
      frameId: "f1",
      contentKey: "img:v1:old",
      modelId: "clip-v1",
    }),
    { action: "index", reason: "content-changed" },
  );

  assert.deepEqual(
    decideIndexingAction(identity, {
      frameId: "f1",
      contentKey: identity.contentKey,
      modelId: "clip-v2",
    }),
    { action: "index", reason: "model-changed" },
  );

  assert.deepEqual(decideIndexingAction(identity, null), {
    action: "index",
    reason: "new",
  });

  assert.deepEqual(
    decideIndexingAction(null, {
      frameId: "f1",
      contentKey: identity.contentKey,
      modelId: "clip-v1",
    }),
    { action: "remove", reason: "no-longer-indexable" },
  );
});

test("planIncrementalIndexing only queues new or changed frames", () => {
  const a = buildFrameIndexIdentity(
    "roll-1",
    { id: "f1", imageUrl: "https://cdn.example.com/a.jpg" },
    "clip-v1",
  )!;
  const b = buildFrameIndexIdentity(
    "roll-1",
    { id: "f2", imageUrl: "https://cdn.example.com/b.jpg" },
    "clip-v1",
  )!;
  const bChanged = buildFrameIndexIdentity(
    "roll-1",
    { id: "f2", imageUrl: "https://cdn.example.com/b-new.jpg" },
    "clip-v1",
  )!;

  const plan = planIncrementalIndexing([a, bChanged], [
    { frameId: "f1", contentKey: a.contentKey, modelId: "clip-v1" },
    { frameId: "f2", contentKey: b.contentKey, modelId: "clip-v1" },
    { frameId: "f-orphan", contentKey: "x", modelId: "clip-v1" },
  ]);

  assert.deepEqual(
    plan.toIndex.map((row) => row.frameId),
    ["f2"],
  );
  assert.deepEqual(plan.toRemove, ["f-orphan"]);
});

test("normalizeScores maps to unit range", () => {
  assert.deepEqual(normalizeScores([10, 20, 30]), [0, 0.5, 1]);
  assert.deepEqual(normalizeScores([5, 5, 5]), [1, 1, 1]);
  assert.deepEqual(normalizeScores([]), []);
});

test("mergeSearchHits unions kinds and keeps max score", () => {
  const meta: SearchHit = {
    hitKey: photographHitKey("f1"),
    objectKind: "photograph",
    rollId: "roll-1",
    rollTitle: "Austin winter walk",
    frameId: "f1",
    frameNumber: 1,
    frameCount: 1,
    imageUrl: null,
    caption: "x",
    location: "",
    aperture: "",
    shutterSpeed: "",
    filmStock: "",
    camera: "",
    startedOn: "",
    noteId: null,
    noteBody: "",
    noteOcrText: "",
    noteImageUrl: null,
    score: 0.4,
    kinds: ["metadata"],
    matchedFields: ["caption"],
  };
  const semantic: SearchHit = {
    ...meta,
    score: 0.9,
    kinds: ["semantic"],
    matchedFields: [],
  };

  const merged = mergeSearchHits([[meta], [semantic]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.score, 0.9);
  assert.deepEqual(merged[0]!.kinds, ["metadata", "semantic"]);
  assert.deepEqual(merged[0]!.matchedFields, ["caption"]);
});

test("cosineSimilarity and semantic ranking helpers", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [1, 0]) - 1) < 1e-9);
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);

  const ranked = rankByCosineSimilarity(
    [1, 0],
    [
      { frameId: "near", embedding: [0.9, 0.1] },
      { frameId: "far", embedding: [0, 1] },
      { frameId: "mid", embedding: [0.5, 0.5] },
    ],
    { limit: 2, minScore: 0.1 },
  );

  assert.equal(ranked[0]!.frameId, "near");
  assert.equal(ranked.length, 2);
  assert.ok(ranked[0]!.score >= ranked[1]!.score);
});
