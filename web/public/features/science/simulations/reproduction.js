export default {
  id: '14',
  instructions: 'Clique sur le jour dans la frise, la durée du cycle, les éprouvettes et les contraceptifs. Appuie sur GO pour observer le résultat ; la pilule impose un cycle de 28 jours.',
  controls: {
    1: { mode: 'direct' },
    2: { mode: 'direct' },
    3: { mode: 'direct', labels: { 1: 'Trompes perméables', 2: 'Trompes bouchées' } },
    4: { mode: 'direct', labels: { 1: 'Appareil génital en bon état', 2: 'Pas assez de spermatozoïdes' } },
    5: { mode: 'direct' },
    6: { mode: 'direct' },
    7: { mode: 'action', label: 'GO : observer la fécondation' },
  },
};
