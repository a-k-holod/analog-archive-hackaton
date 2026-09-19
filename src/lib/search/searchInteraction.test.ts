import assert from "node:assert/strict";
import test from "node:test";
import {
  draftQueryForUrlChange,
  noteResultHref,
  resolvePhotographOpenTarget,
  resultActivationRequiresStableForm,
  rollResultHref,
  searchQueryNeedsUrlCommit,
} from "./searchInteraction.ts";

test("searchQueryNeedsUrlCommit compares trimmed draft to URL query", () => {
  assert.equal(searchQueryNeedsUrlCommit("winter", "winter"), false);
  assert.equal(searchQueryNeedsUrlCommit(" winter ", "winter"), false);
  assert.equal(searchQueryNeedsUrlCommit("winter", ""), true);
  assert.equal(searchQueryNeedsUrlCommit("winter park", "winter"), true);
});

test("draftQueryForUrlChange syncs only when the URL query actually changes", () => {
  assert.equal(draftQueryForUrlChange("winter", "winter"), null);
  assert.equal(draftQueryForUrlChange("lublin", "winter"), "lublin");
  assert.equal(draftQueryForUrlChange("", "winter"), "");
});

test("resolvePhotographOpenTarget requires a frame id", () => {
  assert.deepEqual(resolvePhotographOpenTarget({ rollId: "r1", frameId: "f1" }), {
    rollId: "r1",
    frameId: "f1",
  });
  assert.equal(resolvePhotographOpenTarget({ rollId: "r1", frameId: null }), null);
  assert.equal(resolvePhotographOpenTarget({ rollId: "r1", frameId: undefined }), null);
});

test("result activation while draft is ahead of URL requires a stable form (no remount)", () => {
  // User typed live results; URL not yet committed. Blur+remount would cancel the click.
  assert.equal(
    resultActivationRequiresStableForm({ draftQuery: "winter", urlQuery: "" }),
    true,
  );
  assert.equal(
    resultActivationRequiresStableForm({ draftQuery: "winter", urlQuery: "winter" }),
    false,
  );
});

test("single-click result destinations stay one primary href each", () => {
  assert.equal(rollResultHref("roll-1"), "/rolls/roll-1");
  assert.equal(noteResultHref("roll-1"), "/rolls/roll-1#notes");
});

test("photograph open + URL commit in one gesture must not remount away the trigger", () => {
  const draftQuery = "Sławinek";
  const urlQuery = "";
  const hit = { rollId: "roll-1", frameId: "frame-12" };

  assert.equal(resultActivationRequiresStableForm({ draftQuery, urlQuery }), true);
  assert.deepEqual(resolvePhotographOpenTarget(hit), {
    rollId: "roll-1",
    frameId: "frame-12",
  });

  // After a non-remounting URL commit, draft and URL match; form stays mounted.
  const committedUrl = draftQuery.trim();
  assert.equal(searchQueryNeedsUrlCommit(draftQuery, committedUrl), false);
  assert.equal(draftQueryForUrlChange(committedUrl, urlQuery), committedUrl);
});
