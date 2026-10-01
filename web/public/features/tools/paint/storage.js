// Original PALETT profile: 36 slots. Blobs avoid localStorage's small text quota.
let database;
export function openPaintStore() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('adi4-tools-paint-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pictures', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { database = null; throw error; });
}
export async function paintStore(action, value) {
  const db = await openPaintStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pictures', action === 'put' || action === 'delete' ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('pictures'), request = store[action](value);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Sauvegarde interrompue'));
  });
}
