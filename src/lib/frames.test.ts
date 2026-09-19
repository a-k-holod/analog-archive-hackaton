import assert from "node:assert/strict";
import test from "node:test";
import {
  adjacentFrameId,
  applyFrameMetadata,
  buildFrameUpdateRow,
  canNavigateNext,
  canNavigatePrevious,
  findFrameIndex,
  resolveFrameMetadata,
  type FrameMetadataPatch,
} from "./frames.ts";
import type { Frame } from "./types.ts";

function frame(partial: Partial<Frame> & Pick<Frame, "id" | "number">): Frame {
  return {
    id: partial.id,
    number: partial.number,
    imageUrl: partial.imageUrl ?? null,
    caption: partial.caption ?? "",
    location: partial.location ?? "",
    aperture: partial.aperture ?? "",
    shutterSpeed: partial.shutterSpeed ?? "",
    createdAt: partial.createdAt ?? "2026-09-19T12:00:00.000Z",
  };
}

const rollFrames: Frame[] = [
  frame({ id: "a", number: 1, caption: "First" }),
  frame({ id: "b", number: 2, caption: "Second" }),
  frame({ id: "c", number: 3, caption: "Third" }),
];

test("findFrameIndex uses existing ordered frames without reordering", () => {
  assert.equal(findFrameIndex(rollFrames, "a"), 0);
  assert.equal(findFrameIndex(rollFrames, "b"), 1);
  assert.equal(findFrameIndex(rollFrames, "c"), 2);
  assert.equal(findFrameIndex(rollFrames, "missing"), -1);
  assert.deepEqual(
    rollFrames.map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("adjacentFrameId follows previous/next order within the roll", () => {
  assert.equal(adjacentFrameId(rollFrames, "b", "previous"), "a");
  assert.equal(adjacentFrameId(rollFrames, "b", "next"), "c");
  assert.equal(adjacentFrameId(rollFrames, "a", "next"), "b");
  assert.equal(adjacentFrameId(rollFrames, "c", "previous"), "b");
});

test("first and last frame boundaries disable previous/next", () => {
  assert.equal(canNavigatePrevious(rollFrames, "a"), false);
  assert.equal(canNavigateNext(rollFrames, "a"), true);
  assert.equal(adjacentFrameId(rollFrames, "a", "previous"), null);

  assert.equal(canNavigatePrevious(rollFrames, "c"), true);
  assert.equal(canNavigateNext(rollFrames, "c"), false);
  assert.equal(adjacentFrameId(rollFrames, "c", "next"), null);

  assert.equal(canNavigatePrevious(rollFrames, "missing"), false);
  assert.equal(canNavigateNext(rollFrames, "missing"), false);
  assert.equal(adjacentFrameId(rollFrames, "missing", "next"), null);
});

test("buildFrameUpdateRow maps caption to title and empties to null", () => {
  assert.deepEqual(
    buildFrameUpdateRow({
      caption: "  Market day  ",
      location: "Sławinek",
      aperture: "f/8",
      shutterSpeed: "1/125",
    }),
    {
      title: "Market day",
      location: "Sławinek",
      aperture: "f/8",
      shutter_speed: "1/125",
    },
  );

  assert.deepEqual(
    buildFrameUpdateRow({
      caption: "   ",
      location: "",
      aperture: "  ",
      shutterSpeed: "",
    }),
    {
      title: null,
      location: null,
      aperture: null,
      shutter_speed: null,
    },
  );
});

test("applyFrameMetadata preserves frame identity and archival fields", () => {
  const original = frame({
    id: "frame-keep",
    number: 7,
    imageUrl: "https://example.com/photographs/roll/frame-keep.jpg",
    caption: "Old caption",
    location: "Old place",
    aperture: "f/5.6",
    shutterSpeed: "1/60",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  const patch: FrameMetadataPatch = {
    caption: "  New caption  ",
    aperture: "f/11",
  };

  const updated = applyFrameMetadata(original, patch);

  assert.equal(updated.id, "frame-keep");
  assert.equal(updated.number, 7);
  assert.equal(updated.imageUrl, original.imageUrl);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.caption, "New caption");
  assert.equal(updated.location, "Old place");
  assert.equal(updated.aperture, "f/11");
  assert.equal(updated.shutterSpeed, "1/60");
});

test("resolveFrameMetadata merges patch then builds a full update payload", () => {
  const original = frame({
    id: "f1",
    number: 1,
    caption: "Keep me",
    location: "Lublin",
    aperture: "f/8",
    shutterSpeed: "1/125",
  });

  const fields = resolveFrameMetadata(original, { location: "  Warsaw  " });
  assert.deepEqual(fields, {
    caption: "Keep me",
    location: "Warsaw",
    aperture: "f/8",
    shutterSpeed: "1/125",
  });
  assert.deepEqual(buildFrameUpdateRow(fields), {
    title: "Keep me",
    location: "Warsaw",
    aperture: "f/8",
    shutter_speed: "1/125",
  });
});
