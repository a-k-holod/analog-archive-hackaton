import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNoteInsertRow,
  buildNoteOcrUpdate,
  isPersistableNote,
  indexableNoteText,
  mapNoteRow,
  normalizeNoteFields,
  notePhotographPath,
} from "./notes.ts";
import { noteSearchFields, searchMetadata } from "./search/textSearch.ts";
import type { FilmRoll, Note } from "./types.ts";

test("notePhotographPath is deterministic under the photographs bucket convention", () => {
  assert.equal(
    notePhotographPath("roll-abc", "note-123"),
    "roll-abc/notes/note-123.jpg",
  );
});

test("mapNoteRow maps text, image_url, and ocr_text", () => {
  assert.deepEqual(
    mapNoteRow({
      id: "n1",
      text: "Field note",
      image_url: "https://example.com/photographs/roll/notes/n1.jpg",
      ocr_text: "Photo walk in BW",
      created_at: "2026-09-19T12:00:00.000Z",
    }),
    {
      id: "n1",
      body: "Field note",
      imageUrl: "https://example.com/photographs/roll/notes/n1.jpg",
      ocrText: "Photo walk in BW",
      createdAt: "2026-09-19T12:00:00.000Z",
    },
  );
});

test("mapNoteRow treats null text and ocr_text as empty strings", () => {
  assert.deepEqual(
    mapNoteRow({
      id: "n2",
      text: null,
      image_url: null,
      ocr_text: null,
      created_at: "2026-09-19T12:00:00.000Z",
    }),
    {
      id: "n2",
      body: "",
      imageUrl: null,
      ocrText: "",
      createdAt: "2026-09-19T12:00:00.000Z",
    },
  );
});

test("note without OCR inserts with null ocr_text (image-only)", () => {
  assert.deepEqual(
    buildNoteInsertRow({
      noteId: "n-hand",
      rollId: "roll-1",
      body: "",
      imageUrl: "https://cdn.example.com/notes/n-hand.jpg",
      createdAt: "2026-09-19T12:00:00.000Z",
    }),
    {
      id: "n-hand",
      roll_id: "roll-1",
      frame_id: null,
      text: null,
      image_url: "https://cdn.example.com/notes/n-hand.jpg",
      ocr_text: null,
      created_at: "2026-09-19T12:00:00.000Z",
    },
  );
});

test("text note without OCR inserts with null ocr_text", () => {
  assert.deepEqual(
    buildNoteInsertRow({
      noteId: "n-text",
      rollId: "roll-1",
      body: "  Field note  ",
      imageUrl: null,
      createdAt: "2026-09-19T12:00:00.000Z",
    }),
    {
      id: "n-text",
      roll_id: "roll-1",
      frame_id: null,
      text: "Field note",
      image_url: null,
      ocr_text: null,
      created_at: "2026-09-19T12:00:00.000Z",
    },
  );
});

test("note with OCR persists via update after insert", () => {
  const insert = buildNoteInsertRow({
    noteId: "n-ocr",
    rollId: "roll-1",
    body: "",
    imageUrl: "https://cdn.example.com/notes/n-ocr.jpg",
    createdAt: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(insert.ocr_text, null);

  assert.deepEqual(buildNoteOcrUpdate("  Sławinek morning  "), {
    ocr_text: "Sławinek morning",
  });
  assert.deepEqual(buildNoteOcrUpdate("   "), { ocr_text: null });
});

test("loading persisted OCR text round-trips through mapNoteRow", () => {
  const loaded = mapNoteRow({
    id: "n-ocr",
    text: null,
    image_url: "https://cdn.example.com/notes/n-ocr.jpg",
    ocr_text: "Sławinek morning fog",
    created_at: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(loaded.ocrText, "Sławinek morning fog");
  assert.equal(loaded.body, "");
  assert.ok(loaded.imageUrl);
});

test("normalizeNoteFields keeps notes without OCR valid", () => {
  assert.deepEqual(
    normalizeNoteFields({
      id: "legacy",
      body: "typed",
      createdAt: "2026-09-19T12:00:00.000Z",
    }),
    {
      id: "legacy",
      body: "typed",
      imageUrl: null,
      ocrText: "",
      createdAt: "2026-09-19T12:00:00.000Z",
    },
  );
});

test("isPersistableNote requires text or an image URL", () => {
  assert.equal(isPersistableNote("", null), false);
  assert.equal(isPersistableNote("   ", null), false);
  assert.equal(isPersistableNote("hello", null), true);
  assert.equal(isPersistableNote("", "https://example.com/n.jpg"), true);
  assert.equal(isPersistableNote("  ", "https://example.com/n.jpg"), true);
});

test("indexableNoteText prefers body, then OCR, then image surrogate", () => {
  assert.equal(
    indexableNoteText({ body: "  Field note  ", imageUrl: null, ocrText: "" }),
    "Field note",
  );
  assert.equal(
    indexableNoteText({
      body: "",
      imageUrl: "https://example.com/n.jpg",
      ocrText: "Sławinek walk",
    }),
    "Sławinek walk",
  );
  assert.equal(
    indexableNoteText({
      body: "Manual caption",
      imageUrl: "https://example.com/n.jpg",
      ocrText: "Derived OCR",
    }),
    "Manual caption\nDerived OCR",
  );
  assert.equal(
    indexableNoteText({ body: "", imageUrl: "https://example.com/n.jpg", ocrText: "" }),
    "handwritten note",
  );
  assert.equal(indexableNoteText({ body: "   ", imageUrl: null, ocrText: "" }), "");
});

test("search finds OCR text on handwritten notes", () => {
  const note: Note = {
    id: "n-ocr",
    body: "",
    imageUrl: "https://cdn.example.com/note.jpg",
    ocrText: "Sławinek morning fog",
    createdAt: "2026-09-19T12:00:00.000Z",
  };
  assert.deepEqual(noteSearchFields(note), [{ field: "ocr", value: "Sławinek morning fog" }]);

  const rolls: FilmRoll[] = [
    {
      id: "roll-1",
      title: "Lublin walk",
      filmStock: "HP5",
      filmStockId: null,
      iso: "400",
      camera: "M6",
      startedOn: "2026-09-01",
      createdAt: "2026-09-01T00:00:00.000Z",
      frames: [],
      notes: [note],
      development: null,
      contactSheetGeneratedAt: null,
      analysis: null,
    },
  ];
  const hits = searchMetadata(rolls, { text: "Sławinek" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.objectKind, "note");
  assert.ok(hits[0]!.matchedFields.includes("ocr"));
});
