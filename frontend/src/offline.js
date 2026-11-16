const DATABASE = 'relay-offline-v1'
const STORE = 'drafts'
let databasePromise

function database() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return databasePromise
}

export async function readDraft(key) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(String(key))
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function writeDraft(key, value) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, String(key))
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteDraft(key) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(String(key))
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function readDashboard(userId = 'unknown') {
  return readDraft(`dashboard:${userId}`)
}

export async function writeDashboard(userId = 'unknown', value) {
  return writeDraft(`dashboard:${userId}`, value)
}
