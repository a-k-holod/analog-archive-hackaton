import assert from "node:assert/strict";
import test from "node:test";
import { DEVELOPMENT_RECIPES } from "../filmCatalog.ts";
import { formatDevelopmentTime, personalRecordFromRecipe } from "../developments.ts";
import {
  createDarkroomSessionConfig,
  createSessionTimer,
  isAgitationCueActive,
  parseDevelopmentTimeToSeconds,
  presentDarkroomTimer,
  reduceSessionTimer,
  resolveAgitationPresetFromText,
} from "./session.ts";

test("parseDevelopmentTimeToSeconds accepts personal m:ss clock values", () => {
  assert.equal(parseDevelopmentTimeToSeconds("13:00"), 780);
  assert.equal(parseDevelopmentTimeToSeconds("11:00"), 660);
  assert.equal(parseDevelopmentTimeToSeconds("0:45"), 45);
  assert.equal(parseDevelopmentTimeToSeconds(" 6:05 "), 365);
  assert.equal(parseDevelopmentTimeToSeconds(""), null);
  assert.equal(parseDevelopmentTimeToSeconds("intermittent"), null);
  assert.equal(parseDevelopmentTimeToSeconds("13"), null);
  assert.equal(parseDevelopmentTimeToSeconds("0:00"), null);
  assert.equal(parseDevelopmentTimeToSeconds("13:60"), null);
  assert.equal(parseDevelopmentTimeToSeconds("1:2:3"), null);
  assert.equal(parseDevelopmentTimeToSeconds("13.00"), null);
  assert.equal(parseDevelopmentTimeToSeconds("-1:00"), null);
});

test("resolveAgitationPresetFromText maps canonical labels to timer presets", () => {
  assert.equal(resolveAgitationPresetFromText("Every 30 seconds"), "every-30-seconds");
  assert.equal(resolveAgitationPresetFromText("every-30-seconds"), "every-30-seconds");
  assert.equal(resolveAgitationPresetFromText("every 30 seconds"), "every-30-seconds");
  assert.equal(resolveAgitationPresetFromText("Intermittent"), "intermittent");
  assert.equal(resolveAgitationPresetFromText("intermittent"), "intermittent");

  assert.equal(resolveAgitationPresetFromText("occasional"), null);
  assert.equal(resolveAgitationPresetFromText("every 30 secs"), null);
  assert.equal(resolveAgitationPresetFromText(""), null);
});

test("timer session uses personal development time rather than manufacturer recipe time", () => {
  const recipe = DEVELOPMENT_RECIPES.find(
    (item) => item.id === "ilford-hp5-plus-id-11-1-plus-1-ei-400",
  );
  assert.ok(recipe);
  assert.equal(recipe.timeSeconds, 780);

  const personal = personalRecordFromRecipe(recipe);
  personal.developmentTime = "11:00";
  personal.agitation = "Intermittent";

  const config = createDarkroomSessionConfig(personal);
  assert.ok(config);
  assert.equal(config.durationSeconds, 660);
  assert.equal(config.developmentTimeLabel, "11:00");
  assert.notEqual(config.durationSeconds, recipe.timeSeconds);
  assert.equal(config.cueTimesSeconds.length, 0);

  // Catalog recipe remains the manufacturer time.
  assert.equal(recipe.timeSeconds, 780);
  assert.equal(formatDevelopmentTime(recipe.timeSeconds), "13:00");
});

test("start, countdown, pause, resume, reset, and finish drive presentation", () => {
  const config = createDarkroomSessionConfig({
    developmentTime: "1:00",
    agitation: "Intermittent",
  });
  assert.ok(config);

  let state = createSessionTimer(config);
  let view = presentDarkroomTimer(state, config);
  assert.equal(view.status, "idle");
  assert.equal(view.statusLabel, "Ready");
  assert.equal(view.totalLabel, "1:00");
  assert.equal(view.remainingLabel, "1:00");
  assert.equal(view.primaryAction, "start");
  assert.equal(view.primaryActionLabel, "Start timer");
  assert.equal(view.showReset, false);
  assert.equal(view.agitationCueActive, false);

  state = reduceSessionTimer(state, { type: "start", nowMs: 0 });
  view = presentDarkroomTimer(state, config);
  assert.equal(view.status, "running");
  assert.equal(view.primaryAction, "pause");
  assert.equal(view.showReset, true);

  state = reduceSessionTimer(state, { type: "tick", nowMs: 15_000 });
  view = presentDarkroomTimer(state, config);
  assert.equal(view.remainingLabel, "0:45");
  assert.equal(view.statusLabel, "Running");

  state = reduceSessionTimer(state, { type: "pause", nowMs: 20_000 });
  view = presentDarkroomTimer(state, config);
  assert.equal(view.status, "paused");
  assert.equal(view.primaryAction, "resume");
  assert.equal(view.remainingLabel, "0:40");

  state = reduceSessionTimer(state, { type: "start", nowMs: 100_000 });
  state = reduceSessionTimer(state, { type: "tick", nowMs: 110_000 });
  view = presentDarkroomTimer(state, config);
  assert.equal(view.status, "running");
  assert.equal(view.remainingLabel, "0:30");

  state = reduceSessionTimer(state, { type: "tick", nowMs: 150_000 });
  view = presentDarkroomTimer(state, config);
  assert.equal(view.status, "finished");
  assert.equal(view.remainingLabel, "0:00");
  assert.equal(view.primaryAction, null);
  assert.equal(view.statusLabel, "Finished");
  assert.equal(view.showReset, true);

  state = reduceSessionTimer(state, { type: "reset" });
  view = presentDarkroomTimer(state, config);
  assert.equal(view.status, "idle");
  assert.equal(view.remainingLabel, "1:00");
  assert.equal(view.primaryAction, "start");
  assert.equal(view.showReset, false);
});

test("agitation cue fires every 30 seconds for explicit every-30-seconds agitation", () => {
  const config = createDarkroomSessionConfig({
    developmentTime: "2:05",
    agitation: "Every 30 seconds",
  });
  assert.ok(config);
  assert.deepEqual(config.cueTimesSeconds, [30, 60, 90, 120]);

  let state = createSessionTimer(config);
  state = reduceSessionTimer(state, { type: "start", nowMs: 0 });

  state = reduceSessionTimer(state, { type: "tick", nowMs: 29_000 });
  assert.equal(presentDarkroomTimer(state, config).agitationCueActive, false);
  assert.equal(presentDarkroomTimer(state, config).agitationCueLabel, null);

  state = reduceSessionTimer(state, { type: "tick", nowMs: 30_500 });
  assert.equal(presentDarkroomTimer(state, config).agitationCueActive, true);
  assert.equal(presentDarkroomTimer(state, config).agitationCueLabel, "Agitate");

  state = reduceSessionTimer(state, { type: "tick", nowMs: 33_000 });
  assert.equal(presentDarkroomTimer(state, config).agitationCueActive, false);

  state = reduceSessionTimer(state, { type: "tick", nowMs: 60_200 });
  assert.equal(presentDarkroomTimer(state, config).agitationCueActive, true);

  assert.equal(isAgitationCueActive(90_000, config.cueTimesSeconds), true);
  assert.equal(isAgitationCueActive(120_000, config.cueTimesSeconds), true);
  assert.equal(isAgitationCueActive(125_000, config.cueTimesSeconds), false);
});

test("ambiguous intermittent agitation produces no automatic cue", () => {
  const config = createDarkroomSessionConfig({
    developmentTime: "2:00",
    agitation: "Intermittent",
  });
  assert.ok(config);
  assert.equal(config.agitationPreset, "intermittent");
  assert.deepEqual(config.cueTimesSeconds, []);

  let state = createSessionTimer(config);
  state = reduceSessionTimer(state, { type: "start", nowMs: 0 });
  state = reduceSessionTimer(state, { type: "tick", nowMs: 30_000 });

  const view = presentDarkroomTimer(state, config);
  assert.equal(view.agitationCueActive, false);
  assert.equal(view.agitationCueLabel, null);
  assert.equal(isAgitationCueActive(30_000, config.cueTimesSeconds), false);
  assert.equal(isAgitationCueActive(60_000, config.cueTimesSeconds), false);
});

test("missing or unreadable personal time yields no session timer", () => {
  assert.equal(
    createDarkroomSessionConfig({ developmentTime: "", agitation: "Every 30 seconds" }),
    null,
  );
  assert.equal(
    createDarkroomSessionConfig({ developmentTime: "about 10 minutes", agitation: "" }),
    null,
  );
});
