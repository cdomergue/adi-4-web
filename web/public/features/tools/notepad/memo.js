import { parseLibrary, STORAGE_KEY } from './engine.js';
export function showRoomMemo(frame) {
  let library;
  try { library = parseLibrary(localStorage.getItem(STORAGE_KEY)); } catch { return; }
  const doc = library.documents.find(d => d.memo && !d.password);
  if (!doc) return;
  const button = document.createElement('a'); button.href = '#tool/notepad/' + encodeURIComponent(doc.id);
  button.className = 'room-notepad-memo'; button.setAttribute('aria-label', 'Mémo : ' + doc.title);
  button.textContent = doc.pages[0].text.slice(0, 180) || doc.title; frame.append(button);
}
