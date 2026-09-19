import assert from "node:assert/strict";
import test from "node:test";
import {
  darkroomPatternBonus,
  isUsableOcrHypothesis,
  pickBestHypothesis,
  readableCharRatio,
  scoreOcrHypothesis,
  softenDarkroomOcrText,
  type ScoredOcrHypothesis,
} from "./textQuality.ts";

test("readableCharRatio prefers letters and digits over punctuation garbage", () => {
  assert.ok(readableCharRatio("Rodinal 1:15") > 0.8);
  assert.ok(readableCharRatio("||| ::: ;;; ;;;") < 0.2);
});

test("scoreOcrHypothesis ranks readable darkroom text above garbage", () => {
  const good = scoreOcrHypothesis("Developer Rodinal 1:15 15min 20°C", 62);
  const junk = scoreOcrHypothesis("|:|; .. ;; ~~ ``", 80);
  assert.ok(good.qualityScore > junk.qualityScore);
  assert.ok(good.readableRatio > 0.7);
  assert.ok(junk.readableRatio < 0.4);
});

test("darkroomPatternBonus detects ratios, times, and temperatures without rewriting", () => {
  assert.ok(darkroomPatternBonus("1:15 15min 20°C") > 0);
  assert.equal(darkroomPatternBonus("hello world today"), 0);
});

test("softenDarkroomOcrText applies only conservative pattern fixes", () => {
  assert.equal(softenDarkroomOcrText("Rodina1 1;15 15rnin 20oC"), "Rodinal 1:15 15min 20°C");
  assert.equal(softenDarkroomOcrText("HC-110 1+31"), "HC-110 1+31");
  // Does not invent brand names from unrelated text.
  assert.equal(softenDarkroomOcrText("Morning fog walk"), "Morning fog walk");
});

test("isUsableOcrHypothesis rejects empty, tiny, and punctuation-heavy readings", () => {
  assert.equal(isUsableOcrHypothesis({ text: "", confidence: 90 }), false);
  assert.equal(isUsableOcrHypothesis({ text: "ab", confidence: 90 }), false);
  assert.equal(isUsableOcrHypothesis({ text: "||| ;;; ::: ...", confidence: 90 }), false);
  assert.equal(isUsableOcrHypothesis({ text: "Fomapan 100", confidence: 55 }), true);
  assert.equal(isUsableOcrHypothesis({ text: "Sławinek", confidence: 0 }), true);
});

test("pickBestHypothesis prefers readable text over slightly higher confidence junk", () => {
  const hypotheses: ScoredOcrHypothesis[] = [
    {
      text: "|;| :: ~~",
      confidence: 88,
      variantId: "adaptive",
      pageSegMode: 6,
      ...scoreOcrHypothesis("|;| :: ~~", 88),
    },
    {
      text: "Rodinal 1:15 15min",
      confidence: 58,
      variantId: "grid_suppressed",
      pageSegMode: 4,
      ...scoreOcrHypothesis("Rodinal 1:15 15min", 58),
    },
  ];
  const best = pickBestHypothesis(hypotheses);
  assert.ok(best);
  assert.match(best!.text, /Rodinal/);
});
