import { openDB } from "idb";

const HTTP_CACHE_STORE = "http-cache";
const QUERY_CACHE_STORE = "query-cache";
const OUTBOX_STORE = "outbox";

export type CacheRecord<T> = {
  value: T;
  savedAt: number;
};

const dbPromise = openDB("gondly-local", 3, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(HTTP_CACHE_STORE)) {
      db.createObjectStore(HTTP_CACHE_STORE);
    }

    if (!db.objectStoreNames.contains(QUERY_CACHE_STORE)) {
      db.createObjectStore(QUERY_CACHE_STORE);
    }

    if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
      db.createObjectStore(OUTBOX_STORE);
    }
  },
});

export async function cacheGetRecord<T>(key: string): Promise<CacheRecord<T> | null> {
  const db = await dbPromise;
  return (await db.get(HTTP_CACHE_STORE, key)) ?? null;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const record = await cacheGetRecord<T>(key);
  return record ? record.value : null;
}

export async function cacheSet<T>(key: string, value: T) {
  const db = await dbPromise;
  await db.put(HTTP_CACHE_STORE, { value, savedAt: Date.now() }, key);
}

export async function clearHttpCache() {
  const db = await dbPromise;
  await db.clear(HTTP_CACHE_STORE);
}

export async function queryCacheGet<T>(key: string): Promise<T | null> {
  const db = await dbPromise;
  const record = (await db.get(QUERY_CACHE_STORE, key)) as CacheRecord<T> | undefined;
  return record ? record.value : null;
}

export async function queryCacheSet<T>(key: string, value: T) {
  const db = await dbPromise;
  await db.put(QUERY_CACHE_STORE, { value, savedAt: Date.now() }, key);
}

export async function queryCacheDelete(key: string) {
  const db = await dbPromise;
  await db.delete(QUERY_CACHE_STORE, key);
}

export async function outboxGetAll<T>(): Promise<T[]> {
  const db = await dbPromise;
  return db.getAll(OUTBOX_STORE) as Promise<T[]>;
}

export async function outboxPut<T extends { id: string }>(entry: T) {
  const db = await dbPromise;
  await db.put(OUTBOX_STORE, entry, entry.id);
}

export async function outboxDelete(id: string) {
  const db = await dbPromise;
  await db.delete(OUTBOX_STORE, id);
}

export async function clearOutbox() {
  const db = await dbPromise;
  await db.clear(OUTBOX_STORE);
}
