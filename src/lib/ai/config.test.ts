import assert from "node:assert/strict";
import test from "node:test";
import { getAiAnalysisConfig } from "./config.ts";

test("AI defaults to disabled when unset", () => {
  const config = getAiAnalysisConfig({});
  assert.equal(config.enabled, false);
});

test("ambiguous or falsey flags stay disabled", () => {
  assert.equal(getAiAnalysisConfig({ AI_ANALYSIS_ENABLED: "" }).enabled, false);
  assert.equal(getAiAnalysisConfig({ AI_ANALYSIS_ENABLED: "false" }).enabled, false);
  assert.equal(getAiAnalysisConfig({ AI_ANALYSIS_ENABLED: "yes" }).enabled, false);
  assert.equal(getAiAnalysisConfig({ AI_ANALYSIS_ENABLED: "TRUE" }).enabled, true);
  assert.equal(getAiAnalysisConfig({ AI_ANALYSIS_ENABLED: "1" }).enabled, true);
});

test("numeric limits use defaults or positive ints", () => {
  const defaults = getAiAnalysisConfig({});
  assert.equal(defaults.maxFrames, 36);
  assert.equal(defaults.maxImageBytes, 1_500_000);
  assert.equal(defaults.dailyCallCap, 50);

  const custom = getAiAnalysisConfig({
    AI_MAX_FRAMES: "24",
    AI_MAX_IMAGE_BYTES: "500000",
    AI_DAILY_CALL_CAP: "10",
  });
  assert.equal(custom.maxFrames, 24);
  assert.equal(custom.maxImageBytes, 500000);
  assert.equal(custom.dailyCallCap, 10);

  const invalid = getAiAnalysisConfig({
    AI_MAX_FRAMES: "0",
    AI_MAX_IMAGE_BYTES: "-1",
    AI_DAILY_CALL_CAP: "nope",
  });
  assert.equal(invalid.maxFrames, defaults.maxFrames);
  assert.equal(invalid.maxImageBytes, defaults.maxImageBytes);
  assert.equal(invalid.dailyCallCap, defaults.dailyCallCap);
});
