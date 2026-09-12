import { parseOriginalLink } from './links.js';
import { escapeHtml as esc, normalizeText as normalize } from '../../shared/text.js';
let cached;
async function entries() {
  if (!cached)
    cached = fetch('/game/encyclopedia/index.json')
      .then((r) => {
        if (!r.ok) throw new Error('Missing encyclopedia');
        return r.json();
      })
      .catch((e) => {
        cached = null;
        throw e;
      });
  return cached;
}
export async function showOriginalMedia(id, disc, info, openPage) {
  const index = await entries();
  const { id: code } = parseOriginalLink(id);
  const entry = index[`${disc}/${code}`];
  if (!entry) {
    info('Complément multimédia', '<p>Ce média original n’a pas encore été identifié.</p>');
    return;
  }
  if (entry.page) {
    document.querySelector('#info-dialog')?.close();
    openPage(entry.page, entry.anchor);
    return;
  }
  if (entry.route) {
    document.querySelector('#info-dialog')?.close();
    location.hash = entry.route;
    return;
  }
  if (entry.children) {
    const children = entry.children.map((child) => index[`${disc}/${child}`]).filter(Boolean);
    info(
      entry.title,
      children.length
        ? `<div class="scene-links">${children.map((child) => `<button class="button secondary" data-related-media="${esc(child.id)}">${esc(child.title)}</button>`).join('')}</div>`
        : '<p>Aucun complément disponible pour ce thème.</p>',
    );
    document
      .querySelectorAll('[data-related-media]')
      .forEach(
        (button) =>
          (button.onclick = () =>
            showOriginalMedia(button.dataset.relatedMedia, disc, info, openPage).catch(() =>
              info('Encyclopédie', '<p>Le complément est indisponible.</p>'),
            )),
      );
    return;
  }
  let html = '';
  if (entry.image)
    html = `<img class="encyclopedia-image" src="${entry.image}" alt="${esc(entry.title)}">`;
  else if (entry.video)
    html = `<video class="encyclopedia-video" controls playsinline preload="metadata" src="${entry.video}"></video>`;
  else html = '<p>Le média associé à cette entrée reste à porter.</p>';
  if (entry.caption) html += `<p>${esc(entry.caption)}</p>`;
  info(entry.title, html);
}
export async function renderEncyclopedia(main, disc, info, openPage) {
  document.title = 'L’encyclopédie · ADI 4';
  main.innerHTML =
    '<section id="encyclopedia"><h1>L’encyclopédie</h1><p role="status">Ouverture de l’index…</p></section>';
  const root = main.firstElementChild;
  let data;
  try {
    data = Object.values(await entries()).filter((e) => e.disc === disc);
  } catch {
    if (root.isConnected)
      root.innerHTML =
        '<p>L’encyclopédie est indisponible.</p><a href="#scene/station">Retour à la station</a>';
    return;
  }
  if (!root.isConnected) return;
  root.innerHTML =
    '<a href="#scene/station" class="back-link">← La station</a><h1>L’encyclopédie</h1><label class="search"><input type="search" id="encyclopedia-search" placeholder="Un mot, une découverte…" aria-label="Rechercher dans l’encyclopédie"></label><div class="scene-links"><label>Afficher <select id="encyclopedia-type"><option value="all">Tout</option><option value="image">Photos et schémas</option><option value="video">Films</option><option value="page">Textes</option><option value="route">Expériences</option></select></label></div><p id="encyclopedia-count" role="status"></p><div class="simulation-grid" id="encyclopedia-results"></div><button class="button secondary" id="encyclopedia-more">Afficher la suite</button>';
  let limit = 48;
  function update() {
    const q = normalize(root.querySelector('input').value),
      type = root.querySelector('select').value;
    const results = data
      .filter(
        (e) =>
          (type === 'all' || Boolean(e[type])) && normalize(e.title + ' ' + e.caption).includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    root.querySelector('#encyclopedia-count').textContent = `${results.length} entrées`;
    root.querySelector('#encyclopedia-results').innerHTML =
      results
        .slice(0, limit)
        .map(
          (e) =>
            `<button class="simulation-card encyclopedia-card" data-media="${esc(e.id)}">${e.image ? `<img src="${e.image}" alt="" loading="lazy" width="640" height="480">` : ''}<h3>${esc(e.title)}</h3><span>${e.image ? 'Photo / schéma' : e.video ? 'Film' : e.page ? 'Texte' : e.route ? 'Expérience' : 'Thème'}</span></button>`,
        )
        .join('') || '<p>Aucune entrée trouvée.</p>';
    root.querySelector('#encyclopedia-more').hidden = results.length <= limit;
    root
      .querySelectorAll('[data-media]')
      .forEach(
        (button) =>
          (button.onclick = () =>
            showOriginalMedia(button.dataset.media, disc, info, openPage).catch(() =>
              info('Encyclopédie', '<p>Le média est indisponible.</p>'),
            )),
      );
  }
  root.querySelector('input').oninput = () => {
    limit = 48;
    update();
  };
  root.querySelector('select').onchange = () => {
    limit = 48;
    update();
  };
  root.querySelector('#encyclopedia-more').onclick = () => {
    limit += 48;
    update();
  };
  update();
}
