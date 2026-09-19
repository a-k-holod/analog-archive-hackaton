import type { FrameEmbeddingRecord, SearchIndexMeta } from "./types.ts";

const DB_NAME = "analog-archive-search-v1";
const DB_VERSION = 1;
const STORE_EMBEDDINGS = "frame_embeddings";
const STORE_META = "meta";

/**
 * Device-local visual search index (IndexedDB).
 * Distinct from archive data in Supabase / localStorage — embeddings live
 * only on this browser and are not synced.
 */

function assertBrowser(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  return indexedDB;
}

function openDb(): Promise<IDBDatabase> {
  const idb = assertBrowser();

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open search index DB."));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_EMBEDDINGS)) {
        const store = db.createObjectStore(STORE_EMBEDDINGS, { keyPath: "frameId" });
        store.createIndex("rollId", "rollId", { unique: false });
        store.createIndex("contentKey", "contentKey", { unique: false });
        store.createIndex("modelId", "modelId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

type StoredEmbeddingRow = {
  frameId: string;
  rollId: string;
  contentKey: string;
  modelId: string;
  dims: number;
  /** Stored as number[] for structured clone compatibility. */
  embedding: number[];
  indexedAt: string;
};

function toRecord(row: StoredEmbeddingRow): FrameEmbeddingRecord {
  return {
    frameId: row.frameId,
    rollId: row.rollId,
    contentKey: row.contentKey,
    modelId: row.modelId,
    dims: row.dims,
    embedding: Float32Array.from(row.embedding),
    indexedAt: row.indexedAt,
  };
}

function fromRecord(record: FrameEmbeddingRecord): StoredEmbeddingRow {
  return {
    frameId: record.frameId,
    rollId: record.rollId,
    contentKey: record.contentKey,
    modelId: record.modelId,
    dims: record.dims,
    embedding: Array.from(record.embedding),
    indexedAt: record.indexedAt,
  };
}

export async function putFrameEmbedding(record: FrameEmbeddingRecord): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_EMBEDDINGS, "readwrite");
    await requestToPromise(tx.objectStore(STORE_EMBEDDINGS).put(fromRecord(record)));
    await requestToPromise(
      db.transaction(STORE_META, "readwrite").objectStore(STORE_META).put({
        key: "updatedAt",
        value: record.indexedAt,
      }),
    );
  } finally {
    db.close();
  }
}

export async function getFrameEmbedding(frameId: string): Promise<FrameEmbeddingRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_EMBEDDINGS, "readonly");
    const row = await requestToPromise(
      tx.objectStore(STORE_EMBEDDINGS).get(frameId) as IDBRequest<StoredEmbeddingRow | undefined>,
    );
    return row ? toRecord(row) : null;
  } finally {
    db.close();
  }
}

export async function listFrameEmbeddings(): Promise<FrameEmbeddingRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_EMBEDDINGS, "readonly");
    const rows = await requestToPromise(
      tx.objectStore(STORE_EMBEDDINGS).getAll() as IDBRequest<StoredEmbeddingRow[]>,
    );
    return rows.map(toRecord);
  } finally {
    db.close();
  }
}

export async function deleteFrameEmbeddings(frameIds: string[]): Promise<void> {
  if (frameIds.length === 0) {
    return;
  }

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_EMBEDDINGS, "readwrite");
    const store = tx.objectStore(STORE_EMBEDDINGS);
    await Promise.all(frameIds.map((id) => requestToPromise(store.delete(id))));
  } finally {
    db.close();
  }
}

export async function getSearchIndexMeta(modelId: string | null): Promise<SearchIndexMeta> {
  if (typeof indexedDB === "undefined") {
    return {
      scope: "device-local",
      modelId,
      indexedFrameCount: 0,
      updatedAt: null,
    };
  }

  const db = await openDb();
  try {
    const countTx = db.transaction(STORE_EMBEDDINGS, "readonly");
    const count = await requestToPromise(countTx.objectStore(STORE_EMBEDDINGS).count());

    const metaTx = db.transaction(STORE_META, "readonly");
    const updated = await requestToPromise(
      metaTx.objectStore(STORE_META).get("updatedAt") as IDBRequest<{ key: string; value: string } | undefined>,
    );

    return {
      scope: "device-local",
      modelId,
      indexedFrameCount: count,
      updatedAt: updated?.value ?? null,
    };
  } finally {
    db.close();
  }
}

/** Cursors for incremental indexing decisions (no vector payloads). */
export async function listStoredIndexCursors(): Promise<
  Array<{ frameId: string; contentKey: string; modelId: string }>
> {
  const records = await listFrameEmbeddings();
  return records.map((record) => ({
    frameId: record.frameId,
    contentKey: record.contentKey,
    modelId: record.modelId,
  }));
}
