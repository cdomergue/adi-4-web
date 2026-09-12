import { renderExperiment } from './simulation-view.js';
import { experiments } from './simulations/index.js';
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const sectors = {
  farm: ['1', '2', '7', '8'],
  life: ['4', '14'],
  health: ['9', '15'],
  geology: ['6', '11'],
  chemistry: ['5', '12'],
  physics: ['3', '13'],
};
const sectorNames = {
  farm: 'Élevage et culture',
  life: 'Le Dôme de la vie',
  health: 'La santé',
  geology: 'La géologie',
  chemistry: 'La chimie',
  physics: 'La physique',
};
async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Ressources indisponibles');
  return r.json();
}
export async function renderSimulations(main) {
  document.title = 'Les simulations · ADI 4';
  main.innerHTML =
    '<section id="sim-library"><h1>Les simulations Sciences</h1><p role="status">Chargement…</p></section>';
  const root = main.firstElementChild;
  try {
    const [catalog, assets] = await Promise.all([
      get('/game/station/catalog.json'),
      get('/game/station/assets.json'),
    ]);
    if (!root.isConnected) return;
    root.innerHTML = `<a class="back-link" href="#scene/station">← La station</a><h1>Les simulations Sciences</h1><p>Explore les laboratoires de la station et retrouve leurs expériences.</p>${Object.entries(
      sectors,
    )
      .map(
        ([sector, ids]) =>
          `<section><h2><a href="#scene/${sector}">${sectorNames[sector]}</a></h2><div class="simulation-grid">${catalog
            .filter((sim) => ids.includes(sim.id))
            .map(
              (sim) =>
                `<a class="simulation-card" href="${sim.id === '2' ? '#scene/greenhouse' : `#simulation/${sim.id}`}">${assets[sim.background] ? `<img src="${assets[sim.background].url}" alt="" loading="lazy" width="640" height="480">` : ''}<h3>${esc(sim.title)}</h3></a>`,
            )
            .join('')}</div></section>`,
      )
      .join(
        '',
      )}<p class="development-note">Les 14 expériences utilisent les calculs du jeu original. Leurs séquences et animations restent en cours de vérification.</p>`;
  } catch (e) {
    if (root.isConnected)
      root.innerHTML =
        '<p>Les simulations ne sont pas disponibles.</p><a href="#scene/station">Retour à la station</a>';
  }
}
export async function renderSimulation(main, id) {
  const definition = experiments[id];
  if (!definition) {
    main.innerHTML = '<p>Cette expérience est introuvable.</p><a href="#simulations">Toutes les expériences</a>';
    return;
  }
  const sector = Object.keys(sectors).find((key) => sectors[key].includes(id));
  return renderExperiment(main, definition, { sector, sectorName: sectorNames[sector] });
}
