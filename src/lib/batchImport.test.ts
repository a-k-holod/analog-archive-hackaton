import assert from "node:assert/strict";
import test from "node:test";
import {
  appendUniqueFiles,
  assignBatchFrameNumbers,
  batchProgress,
  clearCompletedItems,
  fileIdentityKey,
  formatImportProgressLabel,
  markItemDone,
  markItemFailed,
  markItemImporting,
  moveQueueItem,
  nextFrameNumber,
  pendingImportIds,
  removeQueueItem,
  renumberQueueItems,
  syncQueueFrameNumbers,
  type BatchQueueItemBase,
} from "./batchImport.ts";

function item(
  partial: Partial<BatchQueueItemBase> & Pick<BatchQueueItemBase, "id" | "fileKey" | "fileName">,
): BatchQueueItemBase {
  return {
    frameNumber: 1,
    status: "queued",
    error: null,
    ...partial,
  };
}

test("nextFrameNumber uses max + 1, not length", () => {
  assert.equal(nextFrameNumber([]), 1);
  assert.equal(nextFrameNumber([1, 2, 3]), 4);
  assert.equal(nextFrameNumber([1, 2, 5]), 6);
  assert.equal(nextFrameNumber([3]), 4);
});

test("assignBatchFrameNumbers yields consecutive numbers", () => {
  assert.deepEqual(assignBatchFrameNumbers(4, 5), [4, 5, 6, 7, 8]);
  assert.deepEqual(assignBatchFrameNumbers(1, 0), []);
  assert.deepEqual(assignBatchFrameNumbers(1, 1), [1]);
});

test("fileIdentityKey is deterministic for name, size, lastModified", () => {
  assert.equal(
    fileIdentityKey({ name: "a.jpg", size: 100, lastModified: 9 }),
    "a.jpg:100:9",
  );
  assert.notEqual(
    fileIdentityKey({ name: "a.jpg", size: 100, lastModified: 9 }),
    fileIdentityKey({ name: "a.jpg", size: 101, lastModified: 9 }),
  );
});

test("appendUniqueFiles skips duplicate file keys and renumbers", () => {
  const existing = [
    item({ id: "1", fileKey: "a.jpg:1:1", fileName: "a.jpg", frameNumber: 4 }),
  ];
  const result = appendUniqueFiles(
    existing,
    [
      item({ id: "2", fileKey: "a.jpg:1:1", fileName: "a.jpg" }),
      item({ id: "3", fileKey: "b.jpg:2:2", fileName: "b.jpg" }),
      item({ id: "4", fileKey: "c.jpg:3:3", fileName: "c.jpg" }),
    ],
    4,
  );

  assert.equal(result.skippedDuplicates, 1);
  assert.equal(result.items.length, 3);
  assert.deepEqual(
    result.items.map((i) => [i.fileName, i.frameNumber]),
    [
      ["a.jpg", 4],
      ["b.jpg", 5],
      ["c.jpg", 6],
    ],
  );
});

test("removeQueueItem renumbers remaining from start", () => {
  const items = [
    item({ id: "1", fileKey: "a", fileName: "a.jpg", frameNumber: 4 }),
    item({ id: "2", fileKey: "b", fileName: "b.jpg", frameNumber: 5 }),
    item({ id: "3", fileKey: "c", fileName: "c.jpg", frameNumber: 6 }),
  ];
  const next = removeQueueItem(items, "2", 4);
  assert.deepEqual(
    next.map((i) => [i.id, i.frameNumber]),
    [
      ["1", 4],
      ["3", 5],
    ],
  );
});

test("moveQueueItem swaps neighbors and renumbers", () => {
  const items = [
    item({ id: "1", fileKey: "a", fileName: "a.jpg", frameNumber: 4 }),
    item({ id: "2", fileKey: "b", fileName: "b.jpg", frameNumber: 5 }),
    item({ id: "3", fileKey: "c", fileName: "c.jpg", frameNumber: 6 }),
  ];
  const next = moveQueueItem(items, "2", "up", 4);
  assert.deepEqual(
    next.map((i) => i.id),
    ["2", "1", "3"],
  );
  assert.deepEqual(
    next.map((i) => i.frameNumber),
    [4, 5, 6],
  );
});

test("renumberQueueItems leaves done items alone and continues after them", () => {
  const items = [
    item({ id: "1", fileKey: "a", fileName: "a.jpg", frameNumber: 4, status: "done" }),
    item({ id: "2", fileKey: "b", fileName: "b.jpg", frameNumber: 99, status: "queued" }),
    item({ id: "3", fileKey: "c", fileName: "c.jpg", frameNumber: 100, status: "failed" }),
  ];
  const next = renumberQueueItems(items, 5);
  assert.equal(next[0]?.frameNumber, 4);
  assert.equal(next[1]?.frameNumber, 5);
  assert.equal(next[2]?.frameNumber, 6);
});

test("syncQueueFrameNumbers realigns idle queue when roll frame numbers advance", () => {
  const queued = [
    item({ id: "1", fileKey: "a", fileName: "a.jpg", frameNumber: 4 }),
    item({ id: "2", fileKey: "b", fileName: "b.jpg", frameNumber: 5 }),
  ];
  const synced = syncQueueFrameNumbers(queued, [1, 2, 3, 4], false);
  assert.deepEqual(
    synced.map((row) => row.frameNumber),
    [5, 6],
  );
  assert.equal(syncQueueFrameNumbers(queued, [1, 2, 3, 4], true), queued);
  assert.deepEqual(syncQueueFrameNumbers([], [1, 2], false), []);
});

test("batchProgress and pendingImportIds track partial failure", () => {
  const items = [
    item({ id: "1", fileKey: "a", fileName: "a.jpg", status: "done" }),
    item({ id: "2", fileKey: "b", fileName: "b.jpg", status: "failed", error: "nope" }),
    item({ id: "3", fileKey: "c", fileName: "c.jpg", status: "queued" }),
    item({ id: "4", fileKey: "d", fileName: "d.jpg", status: "importing" }),
  ];
  const progress = batchProgress(items);
  assert.deepEqual(progress, {
    total: 4,
    pending: 1,
    importing: 1,
    done: 1,
    failed: 1,
    processed: 2,
  });
  assert.deepEqual(pendingImportIds(items), ["2", "3"]);
});

test("mark helpers and clearCompletedItems support retry flow", () => {
  let items = [
    item({ id: "1", fileKey: "a", fileName: "a.jpg", frameNumber: 1 }),
    item({ id: "2", fileKey: "b", fileName: "b.jpg", frameNumber: 2 }),
  ];
  items = markItemImporting(items, "1");
  assert.equal(items[0]?.status, "importing");
  items = markItemDone(items, "1");
  items = markItemFailed(items, "2", "upload failed");
  assert.equal(items[1]?.status, "failed");
  assert.equal(items[1]?.error, "upload failed");

  const remaining = clearCompletedItems(items, 2);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.id, "2");
  assert.equal(remaining[0]?.frameNumber, 2);
});

test("formatImportProgressLabel reflects real counts", () => {
  assert.equal(
    formatImportProgressLabel({
      total: 18,
      pending: 11,
      importing: 1,
      done: 6,
      failed: 0,
      processed: 6,
    }),
    "Importing 7 / 18",
  );
  assert.equal(
    formatImportProgressLabel({
      total: 5,
      pending: 0,
      importing: 0,
      done: 3,
      failed: 2,
      processed: 5,
    }),
    "Imported 3 of 5. 2 failed.",
  );
  assert.equal(
    formatImportProgressLabel({
      total: 2,
      pending: 0,
      importing: 0,
      done: 2,
      failed: 0,
      processed: 2,
    }),
    "Imported 2 frames.",
  );
});
