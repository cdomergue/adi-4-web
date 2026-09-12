// Hotspot coordinates use each scene's image dimensions (640 × 480 by default).
// Experiment rectangles are aligned visually with the original backgrounds;
// they are web navigation areas, not extracted native hit masks.
export const scenes = {
  station: {
    title: 'La station Sciences',
    back: 'room',
    spots: [
      { label: 'L’encyclopédie', to: 'encyclopedia', box: [370, 1, 126, 145] },
      { label: 'Centre de biologie', to: 'biology', box: [252, 212, 208, 170] },
      { label: 'Les cours', to: 'science', box: [480, 269, 159, 210] },
    ],
  },
  biology: {
    title: 'Le centre de biologie',
    back: 'station',
    spots: [
      { label: 'La géologie', to: 'geology', box: [0, 0, 160, 201] },
      { label: 'La chimie', to: 'chemistry', box: [220, 0, 145, 191] },
      { label: 'La physique', to: 'physics', box: [390, 0, 149, 126] },
      { label: 'Aire d’élevage et de culture', to: 'farm', box: [310, 217, 163, 123] },
      { label: 'Le Dôme de la vie', to: 'life', box: [427, 349, 211, 114] },
      { label: 'Le centre de santé', to: 'health', box: [0, 267, 251, 179] },
    ],
  },
  farm: {
    title: 'Aire d’élevage et de culture',
    back: 'biology',
    spots: [
      { label: 'La serre', to: 'greenhouse', box: [1, 70, 252, 238] },
      { label: 'Observation d’une fourmilière', to: 'simulation/7', box: [256, 65, 99, 182] },
      { label: 'Fabrication des laitages', to: 'simulation/1', box: [360, 112, 145, 127] },
      { label: 'Élevage de truites', to: 'simulation/8', box: [365, 279, 271, 161] },
    ],
  },
  life: {
    title: 'Le Dôme de la vie',
    back: 'biology',
    spots: [
      { label: 'Transmettre la vie', to: 'simulation/14', box: [261, 128, 119, 202] },
      { label: 'Génétique d’une fleur', to: 'simulation/4', box: [440, 121, 112, 212] },
    ],
  },
  health: {
    title: 'Le centre de santé',
    back: 'biology',
    spots: [
      { label: 'Bilans de santé', to: 'simulation/9', box: [350, 17, 185, 183] },
      { label: 'Immunologie', to: 'simulation/15', box: [364, 221, 172, 163] },
    ],
  },
  geology: {
    title: 'La géologie',
    back: 'biology',
    spots: [
      { label: 'Dinosaures', to: 'simulation/11', box: [94, 86, 260, 220] },
      { label: 'Érosion des paysages', to: 'simulation/6', box: [0, 306, 130, 115] },
    ],
  },
  chemistry: {
    title: 'La chimie',
    back: 'biology',
    spots: [
      { label: 'Atmosphère d’une planète', to: 'simulation/12', box: [8, 55, 143, 177] },
      { label: 'Choix de matériaux d’emballage', to: 'simulation/5', box: [361, 222, 277, 137] },
    ],
  },
  physics: {
    title: 'La physique',
    back: 'biology',
    spots: [
      { label: 'Éclipse de Soleil du 11 août 1999', to: 'simulation/13', box: [5, 169, 226, 195] },
      {
        label: 'Conditions d’apparition de la foudre',
        to: 'simulation/3',
        box: [535, 0, 105, 197],
      },
    ],
  },
};

export function renderScene(main, id) {
  const scene = scenes[id];
  const width = scene.width || 640,
    height = scene.height || 480;
  document.title = `${scene.title} · ADI 4`;
  const href = (to) =>
    to.startsWith('simulation/') || ['room', 'science', 'encyclopedia', 'simulations'].includes(to)
      ? `#${to}`
      : `#scene/${to}`;
  main.innerHTML = `<section class="original-scene"><div class="scene-heading"><a href="${href(scene.back)}" class="back-link">← Retour</a><h1>${scene.title}</h1><a href="#science" class="back-link">Les cours →</a></div>
    <div class="scene-frame" style="aspect-ratio:${width}/${height}"><img src="${scene.image || `/game/scenes/${id}.webp`}" alt="${scene.title}, décor ${scene.remastered ? 'remasterisé par IA' : 'original d’Adi 4'}" width="${width}" height="${height}">${scene.spots.map((s) => `<a href="${href(s.to)}" class="scene-hotspot" aria-label="${s.label}" title="${s.label}" style="left:${(s.box[0] / width) * 100}%;top:${(s.box[1] / height) * 100}%;width:${(s.box[2] / width) * 100}%;height:${(s.box[3] / height) * 100}%"><span>${s.label}</span></a>`).join('')}</div>
    <nav class="scene-links" aria-label="Destinations">${scene.spots.map((s) => `<a class="button secondary" href="${href(s.to)}">${s.label} →</a>`).join('')}<a class="button secondary" href="#simulations">Toutes les expériences →</a></nav>
    <p class="development-note">Survole les bâtiments et les objets pour découvrir leur nom, puis clique pour entrer.</p>
    </section>`;
}
