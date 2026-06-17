import { openDB } from "idb";

const dbPromise = openDB("gondly-local", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("http-cache")) {
      db.createObjectStore("http-cache");
    }
  },
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await dbPromise;
  const record = await db.get("http-cache", key);
  return record?.value ?? null;
}

export async function cacheSet<T>(key: string, value: T) {
  const db = await dbPromise;
  await db.put("http-cache", { value, savedAt: Date.now() }, key);
}
