/**
 * Pure helpers for roll batch photograph import.
 * UI owns blobs/previews; this module owns numbering, queue edits, and progress.
 */

export type BatchItemStatus = "queued" | "importing" | "done" | "failed";

export type BatchQueueItemBase = {
  id: string;
  /** Deterministic client key: name + size + lastModified */
  fileKey: string;
  fileName: string;
  frameNumber: number;
  status: BatchItemStatus;
  error: string | null;
};

export type FileIdentity = {
  name: string;
  size: number;
  lastModified: number;
};

/** Next frame number from existing roll frames (max + 1; empty → 1). */
export function nextFrameNumber(existingNumbers: readonly number[]): number {
  if (existingNumbers.length === 0) {
    return 1;
  }
  return existingNumbers.reduce((max, n) => Math.max(max, n), 0) + 1;
}

/** Consecutive frame numbers for a batch starting at `startNumber`. */
export function assignBatchFrameNumbers(startNumber: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => startNumber + index);
}

export function fileIdentityKey(file: FileIdentity): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Reassign frame numbers in queue order from `startNumber` (queued/failed/importing only get slots; done keep their number). */
export function renumberQueueItems<T extends BatchQueueItemBase>(
  items: readonly T[],
  startNumber: number,
): T[] {
  let next = startNumber;
  return items.map((item) => {
    if (item.status === "done") {
      return item;
    }
    const frameNumber = next;
    next += 1;
    return item.frameNumber === frameNumber ? item : { ...item, frameNumber };
  });
}

/**
 * Keep preview frame numbers aligned with the live roll while the queue is idle.
 * Skip while an import run is in flight so mid-loop display stays stable.
 */
export function syncQueueFrameNumbers<T extends BatchQueueItemBase>(
  items: readonly T[],
  existingFrameNumbers: readonly number[],
  importing: boolean,
): T[] {
  if (importing || items.length === 0) {
    return items as T[];
  }
  return renumberQueueItems(items, nextFrameNumber(existingFrameNumbers));
}

export function removeQueueItem<T extends BatchQueueItemBase>(
  items: readonly T[],
  id: string,
  startNumber: number,
): T[] {
  return renumberQueueItems(
    items.filter((item) => item.id !== id),
    startNumber,
  );
}

export function moveQueueItem<T extends BatchQueueItemBase>(
  items: readonly T[],
  id: string,
  direction: "up" | "down",
  startNumber: number,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    return [...items];
  }

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) {
    return [...items];
  }

  // Do not reorder past completed imports at the front/back of a mixed queue.
  if (items[index]?.status === "done" || items[target]?.status === "done") {
    return [...items];
  }

  const next = [...items];
  const current = next[index];
  const swap = next[target];
  if (!current || !swap) {
    return [...items];
  }
  next[index] = swap;
  next[target] = current;
  return renumberQueueItems(next, startNumber);
}

/**
 * Append new files in selection order, skipping keys already in the queue.
 * Returns the new list and how many were skipped as duplicates.
 */
export function appendUniqueFiles<T extends BatchQueueItemBase>(
  existing: readonly T[],
  additions: readonly T[],
  startNumber: number,
): { items: T[]; skippedDuplicates: number } {
  const seen = new Set(existing.map((item) => item.fileKey));
  const unique: T[] = [];
  let skippedDuplicates = 0;

  for (const item of additions) {
    if (seen.has(item.fileKey)) {
      skippedDuplicates += 1;
      continue;
    }
    seen.add(item.fileKey);
    unique.push(item);
  }

  return {
    items: renumberQueueItems([...existing, ...unique], startNumber),
    skippedDuplicates,
  };
}

export type BatchProgress = {
  total: number;
  pending: number;
  importing: number;
  done: number;
  failed: number;
  /** Completed attempts this run (done + failed), for “Importing N / M”. */
  processed: number;
};

export function batchProgress(items: readonly BatchQueueItemBase[]): BatchProgress {
  let pending = 0;
  let importing = 0;
  let done = 0;
  let failed = 0;

  for (const item of items) {
    switch (item.status) {
      case "queued":
        pending += 1;
        break;
      case "importing":
        importing += 1;
        break;
      case "done":
        done += 1;
        break;
      case "failed":
        failed += 1;
        break;
      default: {
        const _exhaustive: never = item.status;
        void _exhaustive;
      }
    }
  }

  const total = items.length;
  return {
    total,
    pending,
    importing,
    done,
    failed,
    processed: done + failed,
  };
}

/** Items that still need an import attempt (queued or failed). */
export function pendingImportIds(items: readonly BatchQueueItemBase[]): string[] {
  return items.filter((item) => item.status === "queued" || item.status === "failed").map((item) => item.id);
}

export function markItemImporting<T extends BatchQueueItemBase>(items: readonly T[], id: string): T[] {
  return items.map((item) =>
    item.id === id ? { ...item, status: "importing" as const, error: null } : item,
  );
}

export function markItemDone<T extends BatchQueueItemBase>(items: readonly T[], id: string): T[] {
  return items.map((item) =>
    item.id === id ? { ...item, status: "done" as const, error: null } : item,
  );
}

export function markItemFailed<T extends BatchQueueItemBase>(
  items: readonly T[],
  id: string,
  error: string,
): T[] {
  return items.map((item) =>
    item.id === id ? { ...item, status: "failed" as const, error } : item,
  );
}

export function clearCompletedItems<T extends BatchQueueItemBase>(
  items: readonly T[],
  startNumber: number,
): T[] {
  return renumberQueueItems(
    items.filter((item) => item.status !== "done"),
    startNumber,
  );
}

export function formatImportProgressLabel(progress: BatchProgress): string {
  if (progress.importing > 0 || (progress.processed > 0 && progress.pending > 0)) {
    const current = Math.min(progress.total, progress.processed + (progress.importing > 0 ? 1 : 0));
    return `Importing ${current} / ${progress.total}`;
  }
  if (progress.failed > 0 && progress.pending === 0 && progress.importing === 0) {
    const ok = progress.done;
    const bad = progress.failed;
    return `Imported ${ok} of ${progress.total}. ${bad} failed.`;
  }
  if (progress.done === progress.total && progress.total > 0) {
    return `Imported ${progress.done} ${progress.done === 1 ? "frame" : "frames"}.`;
  }
  return "";
}
