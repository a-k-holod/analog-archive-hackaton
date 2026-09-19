import assert from "node:assert/strict";
import test from "node:test";
import {
  insightFromEnvelope,
  mapInsightToRowColumns,
  toInsightEnvelope,
} from "./insightsStore.ts";
import type { RollInsight } from "../types.ts";

function sampleInsight(): RollInsight {
  return {
    version: 1,
    generatedAt: "2026-09-19T12:00:00.000Z",
    provider: "test-provider",
    model: "test-model",
    contentHash: "abc123",
    summary: { text: "A quiet street sequence.", kind: "inferred", frameNumbers: [1, 2] },
    recurringSubjects: [{ text: "Doorways", kind: "photograph", frameNumbers: [1] }],
    recurringThemes: [{ text: "Thresholds", kind: "inferred" }],
    sequences: [
      {
        label: "Opening",
        frameNumbers: [1, 2],
        reading: { text: "Approach and pause.", kind: "inferred", frameNumbers: [1, 2] },
      },
    ],
    frameTags: [{ frameNumber: 1, tags: ["door", "shadow"], kind: "photograph" }],
    technicalObservations: [{ text: "Soft daylight.", kind: "inferred" }],
    nonObviousObservations: [{ text: "The roll avoids faces.", kind: "inferred" }],
    uncertainties: ["Exact neighborhood is unclear."],
  };
}

test("envelope round-trips to RollInsight", () => {
  const insight = sampleInsight();
  const restored = insightFromEnvelope(toInsightEnvelope(insight));
  assert.deepEqual(restored, insight);
});

test("row column mapping uses summary/subjects/tags and full envelope", () => {
  const insight = sampleInsight();
  const columns = mapInsightToRowColumns(insight);
  assert.equal(columns.summary, "A quiet street sequence.");
  assert.deepEqual(columns.subjects, ["Doorways"]);
  assert.deepEqual(columns.tags, ["Thresholds"]);
  assert.equal(columns.sequences.version, 1);
  assert.equal(columns.sequences.contentHash, "abc123");
  assert.deepEqual(columns.sequences.frameTags, insight.frameTags);
  assert.deepEqual(columns.sequences.uncertainties, insight.uncertainties);
});
