const DATABASE_NAME = "bitcase-search-cache";
const STORE_NAME = "compose-results";
const DATABASE_VERSION = 1;
export const SEARCH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedResult<T> = {
  key: string;
  savedAt: number;
  value: T;
};

function normalizeProject(project: string) {
  return project.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function searchCacheKey(project: string, libraryFingerprint: string) {
  return `${normalizeProject(project)}::${libraryFingerprint}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function writeSearchCache<T>(key: string, value: T) {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        key,
        savedAt: Date.now(),
        value,
      } satisfies CachedResult<T>);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("indexeddb_write_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("indexeddb_write_aborted"));
    });
  } finally {
    database.close();
  }
}

export async function readSearchCache<T>(key: string) {
  const database = await openDatabase();
  try {
    const cached = await new Promise<CachedResult<T> | undefined>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as CachedResult<T> | undefined);
      request.onerror = () => reject(request.error || new Error("indexeddb_read_failed"));
    });
    if (!cached || Date.now() - cached.savedAt > SEARCH_CACHE_MAX_AGE_MS) return null;
    return cached;
  } finally {
    database.close();
  }
}
