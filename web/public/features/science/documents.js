import { scienceMedia, createMediaScope } from './media.js';
import { escapeHtml as esc } from '../../shared/text.js';
import { position } from './interaction-model.js';
let cached;
export function scienceDocuments() {
  return cached ||= fetch('/game/science-media/documents.json').then((r) => {
    if (!r.ok) throw new Error('Documents indisponibles');
    return r.json();
  }).catch((error) => { cached = null; throw error; });
}
export async function renderScienceDocument(main, id, { level = '6', openPage } = {}) {
  main.innerHTML = '<section><p role="status">Ouverture du document vidéo…</p></section>';
  const root = main.firstElementChild;
  let documents, media;
  try { [documents, media] = await Promise.all([scienceDocuments(), scienceMedia()]); }
  catch { if (root.isConnected) root.innerHTML = '<p>Ce document est indisponible.</p><a href="#scene/station">La station</a>'; return; }
  if (!root.isConnected) return;
  const doc = documents[id];
  if (!doc) { root.innerHTML = '<p>Document introuvable.</p><a href="#scene/station">La station</a>'; return; }
  const clip = media.movies[doc.movie];
  document.title = `${doc.title} · ADI 4`;
  const course = doc.courses[level] || doc.courses['0'];
  root.innerHTML = `<div class="scene-heading"><a class="back-link" href="#scene/${doc.sector}">← Le laboratoire</a><h1>${esc(doc.title)}</h1><a class="back-link" href="#encyclopedia">L’encyclopédie →</a></div>
    <div class="scene-frame science-document"><img src="${media.MENU03.url}" alt="" width="640" height="480"><video controls playsinline preload="metadata" aria-label="${esc(doc.title)}" style="${position([72, 45, clip.width, clip.height])}"></video>${course && openPage ? `<button class="scene-hotspot" data-course-scene aria-label="Consulter le cours associé" title="Consulter le cours associé" style="${position([504, 377, 95, 72])}"><span>Le cours</span></button>` : ''}</div>
    <div class="simulation-toolbar"><button class="button secondary" data-replay>Revoir le film</button><label><input type="checkbox" data-sound checked> Son</label>${course && openPage ? '<button class="button secondary" data-course>Consulter le cours associé</button>' : ''}</div><p role="status"></p>`;
  const status = root.querySelector('[role="status"]');
  const sound = root.querySelector('[data-sound]');
  const scope = createMediaScope(root, () => sound.checked, (text) => { status.textContent = text; });
  const video = root.querySelector('video'); scope.track(video); video.src = clip.url;
  sound.onchange = scope.updateSound;
  root.querySelector('[data-replay]').onclick = () => { video.currentTime = 0; scope.start(video); };
  const courseButton = root.querySelector('[data-course]');
  if (courseButton) courseButton.onclick = () => {
    scope.dispose();
    const disc = ['6', '5'].includes(String(level)) ? 'Adi410Sci65' : 'Adi410Sci43';
    openPage(`${disc}/${course.page}`, course.anchor);
  };
  const courseScene = root.querySelector('[data-course-scene]');
  if (courseScene) courseScene.onclick = courseButton.onclick;
  main.addEventListener('sceneleave', scope.dispose, { once: true });
  scope.start(video);
}
