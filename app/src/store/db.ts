/**
 * A very small IndexedDB wrapper.
 *
 * Four stores, key/value semantics, no dependency. localStorage would have been
 * simpler, but it is synchronous and shared with the rest of the origin — a
 * queue that has to survive the app being killed mid-save while the phone is in
 * a supermarket basement deserves the real thing.
 */

const DB_NAME = 'a-medias'
const DB_VERSION = 3

export type StoreName = 'queue' | 'cache' | 'draft' | 'places'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue')
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache')
      // Added in version 2. Every branch here is guarded rather than keyed to
      // the version it arrived in, so an upgrade from any earlier version lands
      // in the same place and nothing already stored is touched.
      if (!db.objectStoreNames.contains('draft')) db.createObjectStore('draft')
      // Added in version 3. Places never leave the device, which is the point of
      // keeping them here and not in the spreadsheet.
      if (!db.objectStoreNames.contains('places')) db.createObjectStore('places')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function run<T>(store: StoreName, mode: IDBTransactionMode,
                      body: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const request = body(db.transaction(store, mode).objectStore(store))
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  })
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', s => s.get(key)),
  set: (store: StoreName, key: string, value: unknown) =>
    run<void>(store, 'readwrite', s => s.put(value, key)),
  del: (store: StoreName, key: string) => run<void>(store, 'readwrite', s => s.delete(key)),
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', s => s.getAll()),
  keys: (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', s => s.getAllKeys()),
}
