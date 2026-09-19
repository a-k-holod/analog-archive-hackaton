import assert from "node:assert/strict";
import test from "node:test";
import {
  createDarkroomTimer,
  getAgitationCueTimes,
  reduceDarkroomTimer,
} from "./timer.ts";

test("timer counts down from elapsed wall-clock time and finishes at zero", () => {
  let state = createDarkroomTimer(10);
  state = reduceDarkroomTimer(state, { type: "start", nowMs: 1_000 });
  state = reduceDarkroomTimer(state, { type: "tick", nowMs: 5_250 });

  assert.equal(state.status, "running");
  assert.equal(state.elapsedMs, 4_250);
  assert.equal(state.remainingMs, 5_750);

  state = reduceDarkroomTimer(state, { type: "tick", nowMs: 20_000 });
  assert.equal(state.status, "finished");
  assert.equal(state.elapsedMs, 10_000);
  assert.equal(state.remainingMs, 0);
  assert.equal(state.lastStartedAtMs, null);
});

test("timer pauses, resumes, and excludes paused time", () => {
  let state = createDarkroomTimer(60);
  state = reduceDarkroomTimer(state, { type: "start", nowMs: 0 });
  state = reduceDarkroomTimer(state, { type: "pause", nowMs: 12_000 });

  assert.equal(state.status, "paused");
  assert.equal(state.elapsedMs, 12_000);
  assert.equal(state.remainingMs, 48_000);

  state = reduceDarkroomTimer(state, { type: "tick", nowMs: 30_000 });
  assert.equal(state.elapsedMs, 12_000);

  state = reduceDarkroomTimer(state, { type: "start", nowMs: 40_000 });
  state = reduceDarkroomTimer(state, { type: "tick", nowMs: 45_000 });
  assert.equal(state.elapsedMs, 17_000);
  assert.equal(state.remainingMs, 43_000);
});

test("reset clears elapsed and remaining state back to the configured duration", () => {
  let state = createDarkroomTimer(90);
  state = reduceDarkroomTimer(state, { type: "start", nowMs: 500 });
  state = reduceDarkroomTimer(state, { type: "tick", nowMs: 10_500 });
  state = reduceDarkroomTimer(state, { type: "reset" });

  assert.deepEqual(state, {
    durationMs: 90_000,
    elapsedMs: 0,
    remainingMs: 90_000,
    status: "idle",
    lastStartedAtMs: null,
  });
});

test("agitation cues use only the explicit every-30-seconds preset", () => {
  assert.deepEqual(getAgitationCueTimes(125, "every-30-seconds"), [30, 60, 90, 120]);
  assert.deepEqual(getAgitationCueTimes(125, "intermittent"), []);
  assert.deepEqual(getAgitationCueTimes(125, null), []);
});
