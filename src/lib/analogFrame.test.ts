import assert from "node:assert/strict";
import test from "node:test";
import {
  detectFilmEdge,
  formatFrameNumber,
  resolveContactSheetCell,
  shouldShowAnalogFrame,
  type AnalogFrameMode,
} from "./analogFrame.ts";

test("Off never shows the decorative frame", () => {
  assert.equal(shouldShowAnalogFrame("off"), false);
  assert.equal(shouldShowAnalogFrame("off", { detection: { hasFilmBorder: true } }), false);
  assert.equal(shouldShowAnalogFrame("off", { detection: { hasFilmBorder: false } }), false);
});

test("On always shows the decorative frame", () => {
  assert.equal(shouldShowAnalogFrame("on"), true);
  assert.equal(shouldShowAnalogFrame("on", { detection: { hasFilmBorder: false } }), true);
  assert.equal(shouldShowAnalogFrame("on", { detection: null }), true);
});

test("Auto is conservative without detection (no frame)", () => {
  assert.equal(shouldShowAnalogFrame("auto"), false);
  assert.equal(shouldShowAnalogFrame("auto", {}), false);
  assert.equal(shouldShowAnalogFrame("auto", { detection: null }), false);
  assert.equal(shouldShowAnalogFrame("auto", { detection: { hasFilmBorder: false } }), false);
});

test("Auto shows frame only when detection positively finds a film border", () => {
  assert.equal(shouldShowAnalogFrame("auto", { detection: { hasFilmBorder: true } }), true);
});

test("detectFilmEdge stub is conservative (no border)", async () => {
  const result = await detectFilmEdge("https://example.com/photo.jpg");
  assert.equal(result.hasFilmBorder, false);
  // Auto + stub detection ⇒ no frame
  assert.equal(shouldShowAnalogFrame("auto", { detection: result }), false);
});

test("formatFrameNumber pads to two digits", () => {
  assert.equal(formatFrameNumber(1), "01");
  assert.equal(formatFrameNumber(12), "12");
  assert.equal(formatFrameNumber(0), "00");
});

test("mode union accepts only off | auto | on", () => {
  const modes: AnalogFrameMode[] = ["off", "auto", "on"];
  for (const mode of modes) {
    assert.equal(typeof shouldShowAnalogFrame(mode), "boolean");
  }
});

test("resolveContactSheetCell keeps image URL unchanged and frame number correct", () => {
  const url = "https://xyz.supabase.co/storage/v1/object/public/photographs/roll/frame.jpg";

  const off = resolveContactSheetCell({ mode: "off", imageUrl: url, frameNumber: 7 });
  assert.equal(off.showFrame, false);
  assert.equal(off.imageUrl, url);
  assert.equal(off.frameNumberLabel, "07");

  const on = resolveContactSheetCell({ mode: "on", imageUrl: url, frameNumber: 7 });
  assert.equal(on.showFrame, true);
  assert.equal(on.imageUrl, url);
  assert.equal(on.frameNumberLabel, "07");

  const auto = resolveContactSheetCell({ mode: "auto", imageUrl: url, frameNumber: 7 });
  assert.equal(auto.showFrame, false);
  assert.equal(auto.imageUrl, url);
  assert.equal(auto.frameNumberLabel, "07");
});
