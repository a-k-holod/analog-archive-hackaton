"use client";

import { Button } from "@/components/Button";
import { formatFrameNumber } from "@/lib/analogFrame";
import {
  appendUniqueFiles,
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
  type BatchItemStatus,
  type BatchQueueItemBase,
} from "@/lib/batchImport";
import { createId } from "@/lib/ids";
import { fileToCompressedJpeg } from "@/lib/image";
import type { NewFrameInput } from "@/lib/types";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

type QueueItem = BatchQueueItemBase & {
  imageBlob: Blob;
  previewUrl: string;
};

type BatchImportProps = {
  rollId: string;
  existingFrameNumbers: readonly number[];
  /** When the roll already has photographs, keep the drop area visually quiet. */
  subordinate?: boolean;
  onAddFrame: (rollId: string, input: NewFrameInput) => Promise<void>;
};

export function BatchImport({
  rollId,
  existingFrameNumbers,
  subordinate = false,
  onAddFrame,
}: BatchImportProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const startNumber = nextFrameNumber(existingFrameNumbers);
  /** Keep preview numbers aligned with the live roll while the queue is idle. */
  const visibleItems =
    importing || items.length === 0 ? items : renumberQueueItems(items, startNumber);
  const progress = batchProgress(visibleItems);
  const pendingCount = pendingImportIds(visibleItems).length;
  const progressLabel = formatImportProgressLabel(progress);
  const busy = preparing || importing;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  async function ingestFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setNotice("Drop or choose image files to import.");
      return;
    }

    setPreparing(true);
    setNotice(null);

    const prepared: QueueItem[] = [];
    const readErrors: string[] = [];

    for (const file of files) {
      try {
        const compressed = await fileToCompressedJpeg(file);
        prepared.push({
          id: createId(),
          fileKey: fileIdentityKey(file),
          fileName: file.name,
          frameNumber: 0,
          status: "queued",
          error: null,
          imageBlob: compressed.blob,
          previewUrl: compressed.previewUrl,
        });
      } catch {
        readErrors.push(file.name);
      }
    }

    const start = nextFrameNumber(existingFrameNumbers);
    const { items: next, skippedDuplicates } = appendUniqueFiles(
      itemsRef.current,
      prepared,
      start,
    );
    const keptIds = new Set(next.map((item) => item.id));
    for (const item of prepared) {
      if (!keptIds.has(item.id)) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    setItems(next);

    const messages: string[] = [];
    if (skippedDuplicates > 0) {
      messages.push(
        `${skippedDuplicates} duplicate ${skippedDuplicates === 1 ? "file was" : "files were"} skipped.`,
      );
    }
    if (readErrors.length > 0) {
      messages.push(
        `${readErrors.length} ${readErrors.length === 1 ? "file" : "files"} could not be read.`,
      );
    }
    setNotice(messages.length > 0 ? messages.join(" ") : null);
    setPreparing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (list && list.length > 0) {
      void ingestFiles(list);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!busy) {
      setDragOver(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return;
    }
    setDragOver(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (busy) {
      return;
    }
    void ingestFiles(event.dataTransfer.files);
  }

  function removeItem(id: string) {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return removeQueueItem(current, id, nextFrameNumber(existingFrameNumbers));
    });
  }

  function moveItem(id: string, direction: "up" | "down") {
    setItems((current) =>
      moveQueueItem(current, id, direction, nextFrameNumber(existingFrameNumbers)),
    );
  }

  function sweepCompleted(queue: QueueItem[], renumberFrom: number): QueueItem[] {
    for (const item of queue) {
      if (item.status === "done") {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    return clearCompletedItems(queue, renumberFrom);
  }

  async function runImport() {
    const aligned = renumberQueueItems(itemsRef.current, nextFrameNumber(existingFrameNumbers));
    itemsRef.current = aligned;
    setItems(aligned);

    const toImport = pendingImportIds(aligned);
    if (toImport.length === 0 || importing) {
      return;
    }

    setImporting(true);
    setNotice(null);

    let successCount = 0;
    let failCount = 0;
    /** Stable base for this run — do not read updating props mid-loop. */
    const baseStart = nextFrameNumber(existingFrameNumbers);

    for (const id of toImport) {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current || (current.status !== "queued" && current.status !== "failed")) {
        continue;
      }

      setItems((prev) => markItemImporting(prev, id));

      try {
        await onAddFrame(rollId, {
          caption: "",
          location: "",
          aperture: "",
          shutterSpeed: "",
          imageBlob: current.imageBlob,
        });
        successCount += 1;
        setItems((prev) => markItemDone(prev, id));
      } catch (err) {
        failCount += 1;
        const message = err instanceof Error ? err.message : "Could not import this photograph.";
        setItems((prev) => markItemFailed(prev, id, message));
      }
    }

    setItems((prev) => sweepCompleted(prev, baseStart + successCount));
    setImporting(false);

    if (failCount > 0) {
      setNotice(
        `Imported ${successCount} ${successCount === 1 ? "frame" : "frames"}. ${failCount} failed — retry or remove them below.`,
      );
    } else if (successCount > 0) {
      setNotice(
        `Imported ${successCount} ${successCount === 1 ? "frame" : "frames"}.`,
      );
    }
  }

  async function retryOne(id: string) {
    if (importing) {
      return;
    }
    const current = itemsRef.current.find((item) => item.id === id);
    if (!current || current.status !== "failed") {
      return;
    }

    setImporting(true);
    setNotice(null);
    setItems((prev) => markItemImporting(prev, id));
    const start = nextFrameNumber(existingFrameNumbers);

    try {
      await onAddFrame(rollId, {
        caption: "",
        location: "",
        aperture: "",
        shutterSpeed: "",
        imageBlob: current.imageBlob,
      });
      setItems((prev) => sweepCompleted(markItemDone(prev, id), start + 1));
      setNotice("Frame imported.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not import this photograph.";
      setItems((prev) => markItemFailed(prev, id, message));
      setNotice(message);
    } finally {
      setImporting(false);
    }
  }

  const dropLabel =
    items.length === 0
      ? subordinate
        ? "Drop scans here to add frames"
        : "Drop scans here"
      : "Drop more scans, or choose files";

  return (
    <div className={subordinate ? "mt-12 border-t border-line pt-8" : "mt-8 border-t border-line pt-8"}>
      <h3 className="font-serif text-lg tracking-tight">
        {subordinate ? "Import frames" : "Import photographs"}
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        {subordinate
          ? "Add several scans at once. New frames continue after the last number on this roll."
          : "Select or drop multiple scans. They will be numbered in order on this roll."}
      </p>

      <div
        role="group"
        aria-label="Batch photograph import"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`mt-6 border-y border-line px-0 py-6 transition-[background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] sm:py-7 ${
          dragOver ? "border-cobalt bg-cobalt/[0.04]" : "bg-transparent"
        }`}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileChange}
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose photographs
          </Button>
          <p className="text-sm text-muted">
            {preparing ? (
              <span className="loading-pulse">Reading photographs…</span>
            ) : (
              dropLabel
            )}
          </p>
        </div>
        <p className="meta mt-3">
          JPEG and other image files. Next frame: {formatFrameNumber(startNumber)}
          {items.length > 0 ? ` · ${items.length} in queue` : ""}
        </p>
      </div>

      {visibleItems.length > 0 ? (
        <ul className="mt-6 divide-y divide-line border-t border-line" aria-label="Import queue">
          {visibleItems.map((item, index) => (
            <QueueRow
              key={item.id}
              item={item}
              index={index}
              total={visibleItems.length}
              disabled={busy}
              onRemove={() => removeItem(item.id)}
              onMoveUp={() => moveItem(item.id, "up")}
              onMoveDown={() => moveItem(item.id, "down")}
              onRetry={() => void retryOne(item.id)}
            />
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={busy || pendingCount === 0} onClick={() => void runImport()}>
          {importing
            ? progressLabel || "Importing…"
            : `Import ${pendingCount} ${pendingCount === 1 ? "frame" : "frames"}`}
        </Button>
        {importing && progressLabel ? (
          <p className="meta" aria-live="polite" role="status">
            {progressLabel}
          </p>
        ) : null}
      </div>

      {notice ? (
        <p
          className={`mt-3 text-sm ${progress.failed > 0 ? "text-danger" : "text-muted"}`}
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function QueueRow({
  item,
  index,
  total,
  disabled,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRetry,
}: {
  item: QueueItem;
  index: number;
  total: number;
  disabled: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRetry: () => void;
}) {
  const statusLabel = statusText(item.status);
  const locked = item.status === "importing" || item.status === "done";

  return (
    <li className="flex flex-wrap items-center gap-3 py-3.5 sm:flex-nowrap sm:gap-4">
      <div className="h-14 w-[4.5rem] shrink-0 bg-matte">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="meta">
          Frame {formatFrameNumber(item.frameNumber)}
          {statusLabel ? ` · ${statusLabel}` : ""}
        </p>
        <p className="mt-0.5 truncate text-sm" title={item.fileName}>
          {item.fileName}
        </p>
        {item.error ? <p className="mt-0.5 text-sm text-danger">{item.error}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.status === "failed" ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={disabled}
            className="text-sm text-cobalt underline-offset-2 hover:underline disabled:text-muted disabled:no-underline"
          >
            Retry
          </button>
        ) : null}
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || locked || index === 0}
          className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40 disabled:no-underline"
          aria-label={`Move ${item.fileName} earlier in the queue`}
        >
          Earlier
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || locked || index >= total - 1}
          className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40 disabled:no-underline"
          aria-label={`Move ${item.fileName} later in the queue`}
        >
          Later
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || item.status === "importing"}
          className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40 disabled:no-underline"
          aria-label={`Remove ${item.fileName} from the import queue`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function statusText(status: BatchItemStatus): string {
  switch (status) {
    case "queued":
      return "";
    case "importing":
      return "Importing";
    case "done":
      return "Imported";
    case "failed":
      return "Failed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
