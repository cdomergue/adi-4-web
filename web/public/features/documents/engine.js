export function scenePoint(clientX, clientY, bounds, width = 640, height = 480) {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const x = Math.floor(((clientX - bounds.left) * width) / bounds.width);
  const y = Math.floor(((clientY - bounds.top) * height) / bounds.height);
  return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
}

export function maskColor(pixels, width, height, point) {
  if (!point || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return 0;
  return pixels[(Math.floor(point.y) * width + Math.floor(point.x)) * 4] || 0;
}

export function menuOffset(offset, amount, count, visible = 7) {
  return Math.max(0, Math.min(Math.max(0, count - visible), offset + amount));
}

export function spacePoint(point, scroll) {
  return {
    x: Math.trunc(72 + point.x - 470 + (Math.max(0, Math.min(100, scroll)) * -33) / 100),
    y: Math.trunc(44 + point.y - 184 + (Math.max(0, Math.min(100, scroll)) * 83) / 100),
  };
}

// ASTRO.TOT routine 14c9 selects a separate ambience for the autumn and winter skies.
export function ambienceKey(topicId, season, fallback) {
  if (topicId === 'astro') return season === 1 || season === 2 ? 'AMB_AST1' : 'AMB_AST2';
  return fallback;
}

// ESPACE.TOT plays the VAISO transition before the regular presentation sequence.
export function introSequence(topicId, clips) {
  return topicId === 'espace' ? ['VAISO', ...clips] : clips;
}

// ESPACE.TOT invokes VAISO again after the document loop, immediately before returning.
export function exitTransition(topicId) {
  return topicId === 'espace' ? 'VAISO' : null;
}

const ambientSequences = {
  animal: [
    'BALEIN',
    'CHAMO',
    'GORILLE',
    'KOMODO',
    'NEIGE',
    'NUAGE',
    'OIZOS',
    'OIZOS3',
    'OURS',
    'POISSON',
    'RHINO',
    'SABLE',
  ],
  astro: [
    'FILANTE1',
    'FILANTE2',
    'FILANTE3',
    'METEOR',
    'MARS',
    'STAR11',
    'STAR22',
    'STAR33',
    'STAR44',
    'FUMEE',
    'FENETR',
    'OIZO1',
    'AS1_EF01',
    'AS1_EF02',
    'AS1_EF03',
    'AS1_EF04',
    'AS1_EF05',
    'AS1_EF06',
    'AS1_EF07',
    'AS2_EF01',
    'AS2_EF02',
    'AS2_EF03',
    'AS2_EF04',
    'AS2_EF05',
  ],
  espace: [
    'SP4G',
    'SP4H',
    'SP4I',
    'SP4J',
    'SP4K',
    'SP4R',
    'SP4S',
    'SP4T',
    'SP4U',
    'SP4V',
    'SP4W',
    'SP4X',
    'ESP_EF01',
    'ESP_EF02',
    'ESP_EF03',
    'ESP_EF04',
    'ESP_EF05',
    'ESP_EF06',
  ],
};

// The source starts a random scene after five seconds and excludes its prior two choices.
export function ambientCandidates(topicId, season = 1, direction = 1) {
  const candidates = ambientSequences[topicId] || [];
  if (topicId !== 'astro') return candidates;
  return candidates.filter((key) => {
    if ((key === 'FUMEE' || key === 'FENETR') && direction !== 1) return false;
    if (key.startsWith('AS1_')) return season === 1 || season === 2;
    if (key.startsWith('AS2_')) return season === 3 || season === 4;
    return true;
  });
}

export function pickAmbient(candidates, previous = [], random = Math.random) {
  const choices =
    candidates.length > 3
      ? candidates.filter((candidate) => !previous.includes(candidate))
      : candidates;
  return choices.length
    ? choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
    : null;
}

// ASTRO.TOT randomises the four small star scenes inside their source rectangles.
export function ambientPosition(key, random = Math.random) {
  const bounds = {
    STAR11: [0, 80, 600, 230],
    STAR22: [0, 80, 595, 230],
    STAR33: [0, 80, 400, 230],
    STAR44: [0, 80, 540, 130],
  }[key];
  if (!bounds) return null;
  const [x, y, width, height] = bounds;
  return { x: x + Math.floor(random() * width), y: y + Math.floor(random() * height) };
}
