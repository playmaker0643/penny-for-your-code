/**
 * Tiny IndexedDB wrapper for offline notification history cache.
 * Keeps last 200 entries to stay battery / storage friendly.
 */
const DB_NAME = "cb_notifications";
const STORE = "history";
const VERSION = 1;
const MAX_ENTRIES = 200;

export interface CachedNotification {
  id: string;
  user_id: string;
  category: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  actions: any[];
  data: any;
  read: boolean;
  created_at: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putMany(items: CachedNotification[]) {
  try {
    const store = await tx("readwrite");
    items.forEach((i) => store.put(i));
    await trim();
  } catch {}
}

export async function getAll(): Promise<CachedNotification[]> {
  try {
    const store = await tx("readonly");
    return await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res((req.result as CachedNotification[])
        .sort((a, b) => b.created_at.localeCompare(a.created_at)));
      req.onerror = () => rej(req.error);
    });
  } catch { return []; }
}

export async function markRead(id: string) {
  try {
    const store = await tx("readwrite");
    const req = store.get(id);
    req.onsuccess = () => {
      const v = req.result as CachedNotification | undefined;
      if (v) { v.read = true; store.put(v); }
    };
  } catch {}
}

export async function remove(id: string) {
  try { (await tx("readwrite")).delete(id); } catch {}
}

export async function clearAll() {
  try { (await tx("readwrite")).clear(); } catch {}
}

async function trim() {
  try {
    const store = await tx("readwrite");
    const idx = store.index("created_at");
    const countReq = store.count();
    countReq.onsuccess = () => {
      const excess = countReq.result - MAX_ENTRIES;
      if (excess <= 0) return;
      const cursorReq = idx.openCursor();
      let deleted = 0;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && deleted < excess) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };
    };
  } catch {}
}