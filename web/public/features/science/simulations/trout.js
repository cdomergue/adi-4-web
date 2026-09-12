export default {
  id: '8',
  instructions: 'Choisis le bassin en haut à gauche, l’oxygène sur le cadran, puis les flacons de nourriture, les soins et les catastrophes autour de l’aquarium.',
  controls: {
    1: { mode: 'direct' },
    2: { mode: 'direct' },
    3: { mode: 'direct' },
    4: { mode: 'direct', labels: { 1: 'Pas de soins', 2: 'Antibiotiques', 3: 'Produits anti-algues' } },
    5: { mode: 'direct', labels: {
      1: 'Aucune catastrophe', 2: 'Forte canicule',
      3: 'Maladie parasitaire', 4: 'Pollution accidentelle de l’eau',
    } },
  },
};
