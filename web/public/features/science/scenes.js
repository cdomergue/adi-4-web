import { startSceneMedia } from './scene-media.js';

// Native NIV3–NIV6.INI rectangles, combined to expose both Science discs.
export const scenes = {
  station: {
    title: 'La station Sciences',
    back: 'room',
    spots: [
      { label: 'L’encyclopédie', to: 'encyclopedia', box: [362, 0, 120, 118] },
      { label: 'Centre de biologie', to: 'biology', box: [239, 156, 238, 304] },
      { label: 'Les cours', to: 'science', box: [484, 242, 156, 238] },
    ],
  },
  biology: {
    title: 'Le centre de biologie',
    back: 'station',
    spots: [
      { label: 'La géologie', to: 'geology', box: [0, 0, 182, 223] },
      { label: 'La chimie', to: 'chemistry', box: [230, 0, 142, 220] },
      { label: 'La physique', to: 'physics', box: [393, 0, 139, 109] },
      { label: 'Le centre de santé', to: 'health', box: [88, 333, 130, 122] },
      { label: 'Aire d’élevage et de culture', to: 'farm', box: [342, 237, 134, 75] },
      { label: 'Le Dôme de la vie', to: 'life', box: [412, 339, 228, 117] },
    ],
  },
  geology: {
    title: 'La géologie',
    back: 'biology',
    spots: [
      { label: 'Dinosaures', to: 'simulation/11', box: [140, 89, 208, 193] },
      { label: 'Érosion des paysages', to: 'simulation/6', box: [0, 307, 181, 124] },
      { label: 'La formation des volcans', to: 'science-document/1011', box: [421, 0, 177, 108] },
      { label: 'La fossilisation', to: 'science-document/1019', box: [4, 54, 134, 227] },
    ],
  },
  chemistry: {
    title: 'La chimie',
    back: 'biology',
    spots: [
      { label: 'Atmosphère d’une planète', to: 'simulation/12', box: [0, 50, 188, 184] },
      { label: 'Choix de matériaux d’emballage', to: 'simulation/5', box: [416, 0, 224, 238] },
      { label: 'Les variations de température', to: 'science-document/1014', box: [0, 240, 299, 239] },
    ],
  },
  physics: {
    title: 'La physique',
    back: 'biology',
    spots: [
      { label: 'Conditions d’apparition de la foudre', to: 'simulation/3', box: [544, 85, 96, 105] },
      { label: 'Éclipse de Soleil du 11 août 1999', to: 'simulation/13', box: [2, 172, 127, 75] },
      { label: 'Les frottements', to: 'science-document/1017', box: [357, 210, 125, 65] },
      { label: 'La sécurité électrique', to: 'science-document/1015', box: [496, 286, 116, 160] },
    ],
  },
  health: {
    title: 'Le centre de santé',
    back: 'biology',
    spots: [
      { label: 'Bilans de santé', to: 'simulation/9', box: [0, 0, 262, 182] },
      { label: 'Les causes de l’infarctus', to: 'science-document/1020', box: [389, 20, 139, 143] },
      { label: 'Le petit déjeuner', to: 'science-document/1018', box: [71, 287, 132, 104] },
      { label: 'Immunologie', to: 'simulation/15', box: [376, 219, 166, 153] },
    ],
  },
  farm: {
    title: 'Aire d’élevage et de culture',
    back: 'biology',
    spots: [
      { label: 'Fabrication des laitages', to: 'simulation/1', box: [384, 136, 95, 131] },
      { label: 'La serre', to: 'greenhouse', box: [125, 146, 132, 120] },
      { label: 'Les insectes', to: 'science-document/1022', box: [272, 146, 80, 123] },
      { label: 'Observation d’une fourmilière', to: 'simulation/7', box: [484, 196, 120, 75] },
      { label: 'Élevage de truites', to: 'simulation/8', box: [336, 286, 294, 176] },
    ],
  },
  life: {
    title: 'Le Dôme de la vie',
    back: 'biology',
    spots: [
      { label: 'La diversité de la reproduction sexuée', to: 'science-document/1024', box: [73, 129, 134, 206] },
      { label: 'Transmettre la vie', to: 'simulation/14', box: [251, 131, 117, 204] },
      { label: 'Génétique d’une fleur', to: 'simulation/4', box: [424, 122, 134, 215] },
    ],
  },
};

export function renderScene(main, id, options = {}) {
  const scene = scenes[id];
  const width = scene.width || 640,
    height = scene.height || 480;
  document.title = `${scene.title} · ADI 4`;
  const href = (to) =>
    (to.startsWith('simulation/') || to.startsWith('science-document/')) || ['room', 'science', 'encyclopedia', 'simulations'].includes(to)
      ? `#${to}`
      : `#scene/${to}`;
  main.innerHTML = `<section class="original-scene"><div class="scene-heading"><a href="${href(scene.back)}" class="back-link">← Retour</a><h1>${scene.title}</h1><a href="#science" class="back-link">Les cours →</a></div>
    <div class="scene-frame" style="aspect-ratio:${width}/${height}"><img src="${scene.image || `/game/scenes/${id}.webp`}" alt="${scene.title}, décor ${scene.remastered ? 'remasterisé par IA' : 'original d’Adi 4'}" width="${width}" height="${height}">${scene.spots.map((s) => `<a href="${href(s.to)}" class="scene-hotspot" aria-label="${s.label}" title="${s.label}" style="left:${(s.box[0] / width) * 100}%;top:${(s.box[1] / height) * 100}%;width:${(s.box[2] / width) * 100}%;height:${(s.box[3] / height) * 100}%"><span>${s.label}</span></a>`).join('')}</div>
    <div class="simulation-toolbar"><label><input type="checkbox" data-science-sound checked> Son</label><button class="button secondary" data-adi-replay>Écouter Adi</button>${id === 'station' ? '<button class="button secondary" data-intro-replay>Revoir l’arrivée à la station</button>' : ''}</div><p data-media-status role="status"></p>
    <nav class="scene-links" aria-label="Destinations">${scene.spots.map((s) => `<a class="button secondary" href="${href(s.to)}">${s.label} →</a>`).join('')}<a class="button secondary" href="#simulations">Toutes les expériences →</a></nav>
    <p class="development-note">Survole les bâtiments et les objets pour découvrir leur nom, puis clique pour entrer.</p>
    </section>`;
  startSceneMedia(main, main.firstElementChild, id, options);
}
