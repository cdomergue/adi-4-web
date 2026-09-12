const humanEffect = {
  mode: 'direct', labels: { 1: 'Augmenter', 2: 'Ne pas modifier', 3: 'Diminuer' },
};

export default {
  id: '12',
  instructions: 'Clique sur les trois positions des jauges de gaz, les tailles de planète et les distances au Soleil. Dans les défis, les jauges règlent l’action humaine.',
  controls: {
    1: { mode: 'direct' }, 2: { mode: 'direct' },
    3: { mode: 'direct' }, 4: { mode: 'direct' },
    5: { mode: 'direct' }, 6: { mode: 'direct' },
    15: humanEffect, 16: humanEffect, 17: humanEffect, 18: humanEffect,
  },
  // ETATINI.CACHE swaps these four pairs on the SAME ETATZONE rectangles.
  // Rendering both groups would silently intercept every natural-gas control.
  isVisible(object, currentCase) {
    return !currentCase.hidden.includes(object.id);
  },
};
