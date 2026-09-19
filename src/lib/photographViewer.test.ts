import assert from "node:assert/strict";
import test from "node:test";
import { applyFrameMetadata, type FrameMetadataPatch } from "./frames.ts";
import {
  adjacentViewerImageUrls,
  buildViewerMetaPresentation,
  DEFAULT_VIEWER_FILM_FRAME_MODE,
  formatViewerCounter,
  resolveViewerFilmFramePresentation,
  resolveViewerFramePosition,
  resolveViewerKeyboardAction,
  resolveViewerNavigation,
  resolveViewerSwipe,
  shouldShowViewerFilmFrame,
  viewerNavAriaLabel,
  viewerPhotographInspectClassName,
  viewerPhotographInspectLabel,
} from "./photographViewer.ts";
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

/** A roll opened from search still navigates only within that roll's frames. */
const searchOpenedRoll: Frame[] = [
  frame({
    id: "f07",
    number: 7,
    imageUrl: "https://cdn.example/rolls/winter/07.jpg",
    caption: "Before",
  }),
  frame({
    id: "f08",
    number: 8,
    imageUrl: "https://cdn.example/rolls/winter/08.jpg",
    caption: "Walk in Winter 2021",
    location: "Sławinek, Lublin",
    aperture: "f/5.6",
    shutterSpeed: "1/60",
  }),
  frame({
    id: "f09",
    number: 9,
    imageUrl: "https://cdn.example/rolls/winter/09.jpg",
    caption: "After",
  }),
];

test("formatViewerCounter matches archive FRAME nn / nn presentation", () => {
  assert.equal(formatViewerCounter(8, 18), "FRAME 08 / 18");
  assert.equal(formatViewerCounter(1, 3), "FRAME 01 / 03");
});

test("resolveViewerFramePosition reports sequence within the roll", () => {
  const position = resolveViewerFramePosition(searchOpenedRoll, "f08");
  assert.ok(position);
  assert.equal(position.counterLabel, "FRAME 08 / 03");
  assert.equal(position.hasPrevious, true);
  assert.equal(position.hasNext, true);
  assert.equal(position.previousFrameNumber, 7);
  assert.equal(position.nextFrameNumber, 9);
});

test("search-opened frame navigates only to adjacent roll frames", () => {
  assert.equal(resolveViewerNavigation(searchOpenedRoll, "f08", "previous"), "f07");
  assert.equal(resolveViewerNavigation(searchOpenedRoll, "f08", "next"), "f09");
  // Never jumps outside the provided roll list.
  assert.equal(resolveViewerNavigation(searchOpenedRoll, "f07", "previous"), null);
  assert.equal(resolveViewerNavigation(searchOpenedRoll, "f09", "next"), null);
});

test("first and last boundaries hide previous/next availability", () => {
  const first = resolveViewerFramePosition(searchOpenedRoll, "f07");
  const last = resolveViewerFramePosition(searchOpenedRoll, "f09");
  assert.ok(first);
  assert.ok(last);
  assert.equal(first.hasPrevious, false);
  assert.equal(first.hasNext, true);
  assert.equal(first.previousFrameNumber, null);
  assert.equal(last.hasPrevious, true);
  assert.equal(last.hasNext, false);
  assert.equal(last.nextFrameNumber, null);
});

test("viewerNavAriaLabel names the destination frame number", () => {
  assert.equal(viewerNavAriaLabel("previous", 7), "Previous frame, frame 7");
  assert.equal(viewerNavAriaLabel("next", 9), "Next frame, frame 9");
  assert.equal(viewerNavAriaLabel("previous", null), "Previous frame");
});

test("keyboard mapping: arrows navigate, Escape closes, edit cancels first", () => {
  assert.equal(resolveViewerKeyboardAction("ArrowLeft", { editing: false }), "previous");
  assert.equal(resolveViewerKeyboardAction("ArrowRight", { editing: false }), "next");
  assert.equal(resolveViewerKeyboardAction("Escape", { editing: false }), "close");
  assert.equal(resolveViewerKeyboardAction("Escape", { editing: true }), "cancel-edit");
  assert.equal(resolveViewerKeyboardAction("ArrowLeft", { editing: true }), null);
  assert.equal(resolveViewerKeyboardAction("ArrowRight", { editing: true }), null);
  assert.equal(resolveViewerKeyboardAction("a", { editing: false }), null);
});

test("touch swipe maps horizontal gestures without blocking vertical scroll", () => {
  assert.equal(resolveViewerSwipe(-80, 10), "next");
  assert.equal(resolveViewerSwipe(80, -8), "previous");
  assert.equal(resolveViewerSwipe(-20, 0), null);
  assert.equal(resolveViewerSwipe(-100, 100), null);
});

test("adjacentViewerImageUrls preloads only current and neighbours", () => {
  assert.deepEqual(adjacentViewerImageUrls(searchOpenedRoll, "f08"), [
    "https://cdn.example/rolls/winter/07.jpg",
    "https://cdn.example/rolls/winter/08.jpg",
    "https://cdn.example/rolls/winter/09.jpg",
  ]);
  assert.deepEqual(adjacentViewerImageUrls(searchOpenedRoll, "f07"), [
    "https://cdn.example/rolls/winter/07.jpg",
    "https://cdn.example/rolls/winter/08.jpg",
  ]);
  assert.deepEqual(adjacentViewerImageUrls(searchOpenedRoll, "missing"), []);
});

test("buildViewerMetaPresentation keeps restrained archive lines", () => {
  assert.deepEqual(
    buildViewerMetaPresentation({
      caption: "Walk in Winter 2021",
      location: "Sławinek, Lublin",
      aperture: "f/5.6",
      shutterSpeed: "1/60",
      filmStock: "Fomapan 400",
      camera: "Canon A-1",
    }),
    {
      caption: "Walk in Winter 2021",
      stockLine: "Fomapan 400 · Canon A-1",
      location: "Sławinek, Lublin",
      exposureLine: "f/5.6 · 1/60",
    },
  );
});

test("metadata edits preserve photograph identity and image URL", () => {
  const original = searchOpenedRoll[1]!;
  const patch: FrameMetadataPatch = {
    caption: "  Walk in Winter 2021 — revised  ",
    location: "Sławinek",
  };
  const updated = applyFrameMetadata(original, patch);
  assert.equal(updated.id, original.id);
  assert.equal(updated.number, original.number);
  assert.equal(updated.imageUrl, original.imageUrl);
  assert.equal(updated.caption, "Walk in Winter 2021 — revised");
  assert.equal(updated.location, "Sławinek");
  assert.equal(updated.aperture, original.aperture);
});

test("viewer close keyboard action is distinct from cancel-edit", () => {
  // Parent returns focus after unmount; the viewer itself only signals close.
  assert.equal(resolveViewerKeyboardAction("Escape", { editing: false }), "close");
  assert.notEqual(resolveViewerKeyboardAction("Escape", { editing: true }), "close");
});

test("film-frame toggle defaults to Off (least intrusive gallery)", () => {
  assert.equal(DEFAULT_VIEWER_FILM_FRAME_MODE, "off");
  assert.equal(shouldShowViewerFilmFrame("off"), false);
  assert.equal(shouldShowViewerFilmFrame("on"), true);
});

test("film-frame Off vs On presentation preserves frame and image identity", () => {
  const original = searchOpenedRoll[1]!;
  const off = resolveViewerFilmFramePresentation({
    mode: "off",
    imageUrl: original.imageUrl,
    frameId: original.id,
    frameNumber: original.number,
    filmStock: "Fomapan 400",
    iso: "400",
    imageOrientation: "landscape",
  });
  assert.equal(off.showFrame, false);
  assert.equal(off.layout, undefined);
  assert.equal(off.imageUrl, original.imageUrl);
  assert.equal(off.frameId, original.id);
  assert.equal(off.frameNumber, original.number);
  assert.equal(off.filmStockLabel, "FOMAPAN 400");

  const on = resolveViewerFilmFramePresentation({
    mode: "on",
    imageUrl: original.imageUrl,
    frameId: original.id,
    frameNumber: original.number,
    filmStock: "Fomapan 400",
    iso: "400",
    imageOrientation: "landscape",
  });
  assert.equal(on.showFrame, true);
  assert.equal(on.layout, "horizontal");
  assert.equal(on.imageUrl, original.imageUrl);
  assert.equal(on.frameId, original.id);
  assert.equal(on.frameNumber, original.number);
});

test("film-frame On resolves orientation-aware layouts without rotating identity", () => {
  const url = "https://cdn.example/rolls/winter/08.jpg";
  const landscape = resolveViewerFilmFramePresentation({
    mode: "on",
    imageUrl: url,
    frameId: "f08",
    frameNumber: 8,
    imageOrientation: "landscape",
  });
  const portrait = resolveViewerFilmFramePresentation({
    mode: "on",
    imageUrl: url,
    frameId: "f08",
    frameNumber: 8,
    imageOrientation: "portrait",
  });
  const square = resolveViewerFilmFramePresentation({
    mode: "on",
    imageUrl: url,
    frameId: "f08",
    frameNumber: 8,
    imageOrientation: "square",
  });
  assert.equal(landscape.layout, "horizontal");
  assert.equal(portrait.layout, "vertical");
  assert.equal(square.layout, "restrained");
  assert.equal(landscape.imageUrl, url);
  assert.equal(portrait.imageUrl, url);
  assert.equal(square.imageUrl, url);
});

test("film-frame On without orientation defers layout to AnalogFrame measurement", () => {
  const presentation = resolveViewerFilmFramePresentation({
    mode: "on",
    imageUrl: "https://cdn.example/frame.jpg",
    frameId: "f01",
    frameNumber: 1,
  });
  assert.equal(presentation.showFrame, true);
  assert.equal(presentation.layout, undefined);
});

test("film-frame Off omits stock rebate when stock metadata is missing", () => {
  const presentation = resolveViewerFilmFramePresentation({
    mode: "on",
    imageUrl: "https://cdn.example/frame.jpg",
    frameId: "f01",
    frameNumber: 1,
    filmStock: "",
    iso: "400",
  });
  assert.equal(presentation.filmStockLabel, null);
});

test("inspect affordance class and label stay restrained", () => {
  const className = viewerPhotographInspectClassName();
  assert.match(className, /cursor-zoom-in/);
  assert.doesNotMatch(className, /tooltip|animate-bounce|scale-110/);
  assert.equal(viewerPhotographInspectLabel(8), "Inspect frame 08");
});

test("keyboard navigation remains available while film-frame mode is irrelevant to mapping", () => {
  // Toggle state must not alter Escape / arrow semantics.
  assert.equal(resolveViewerKeyboardAction("ArrowLeft", { editing: false }), "previous");
  assert.equal(resolveViewerKeyboardAction("ArrowRight", { editing: false }), "next");
  assert.equal(resolveViewerKeyboardAction("Escape", { editing: false }), "close");
});
