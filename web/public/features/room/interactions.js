// EDIINTRO:51f2 (French room), DOC:01e5/0321, IMAGE:0080 and
// MENUEVCO.PFR byte 4. Smaller overlapping targets have priority.
export const roomObjects = [
  { id: 'planets', label: 'Le mobile — Les planètes', rect: [145, 85, 135, 75], route: 'room/planete' },
  { id: 'globe', label: 'Le globe — L’Atlas', rect: [215, 125, 33, 33], route: 'room/atlas' },
  { id: 'bear', label: 'L’ours — Les animaux en danger', rect: [112, 304, 41, 57], route: 'room/animal' },
  { id: 'telescope', label: 'Le télescope — L’astronomie', rect: [528, 194, 48, 77], route: 'room/astro' },
  { id: 'rocket', label: 'La fusée — La conquête de l’espace', rect: [173, 44, 65, 41], route: 'room/espace' },
  { id: 'window', label: 'La fenêtre — Le cycle de l’eau', rect: [490, 15, 80, 95], route: 'room/cycle' },
  { id: 'tools', label: 'Le bureau — Les outils', rect: [0, 268, 128, 33], unavailable: 'Les outils' },
  { id: 'toys', label: 'La caisse de jeux', rect: [414, 302, 81, 64], route: 'games' },
  { id: 'chair', label: 'Le fauteuil — Les matières', rect: [148, 167, 145, 88], route: 'scene/station' },
  { id: 'neon', label: 'Le néon — Mes résultats', rect: [385, 135, 63, 75], route: 'room/results' },
  { id: 'radio', label: 'La radio', rect: [89, 215, 40, 48], route: 'radio' },
  // LIBAPPEL:132f/135e: malle and bons points.
  { id: 'chest', label: 'La malle — Les simulations', rect: [5, 350, 80, 100], route: 'room/experiments' },
  { id: 'drawers', label: 'La commode — Les bons points', rect: [540, 300, 100, 120], route: 'room/rewards' },
];

const variants = (prefix, suffix, letters = 'ABCDE') => [...letters].map(c => prefix + c + suffix);
export const roomCloseups = {
  animal: { title: 'Les animaux en danger', image: 24, pose: 'D', offset: [255, -12],
    voices: variants('STDAN', 'D'), transition: 'CTRALIVR' },
  atlas: { title: 'L’Atlas', image: 13, voices: variants('STATL', '0') },
  planete: { title: 'Les planètes', image: 13, voices: variants('STSOL', '0') },
  astro: { title: 'L’astronomie', image: 20, pose: 'D', offset: [285, 33],
    voices: variants('STAST', 'D', 'ABC'), transition: 'CTRASTRO' },
  espace: { title: 'La conquête de l’espace', image: 18, voices: variants('STCON', '0') },
  cycle: { title: 'Le cycle de l’eau', image: 15, pose: 'A', offset: [-180, 0],
    voices: variants('STCYC', 'A'), transition: 'CCYCLE' },
  experiments: { title: 'Les simulations', image: 7, pose: 'D', offset: [225, -7],
    voices: variants('AIMAL', 'D', 'ABC'), menu: true },
  rewards: { title: 'Les bons points', image: 35, pose: 'A', offset: [230, 0],
    voices: ['BONSINA'], transition: 'CBONPOIN', rewards: true },
};

export function chooseRoomVoice(voices, previous, random = Math.random) {
  const choices = voices.filter(name => name !== previous);
  return choices[Math.floor(random() * choices.length)] || voices[0];
}

export function roomObjectAt(x, y) {
  return [...roomObjects].reverse().find(({ rect: [left, top, width, height] }) =>
    x >= left && y >= top && x < left + width && y < top + height);
}
