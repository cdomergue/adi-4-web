export default {
  id: '15',
  instructions: 'Choisis un corps étranger à gauche, puis une porte d’entrée sur le corps. Sélectionne un traitement à droite et clique sur GO pour observer la réaction.',
  controls: {
    1: { mode: 'direct', clearState: 1, clearLabel: 'Retirer le corps étranger', labels: { 1: 'Aucun corps étranger' } },
    2: { mode: 'direct', clearState: 1, clearLabel: 'Effacer la porte d’entrée', labels: { 1: 'Aucune porte d’entrée' } },
    3: { mode: 'direct', labels: {
      1: 'Pas de traitement', 2: 'Vaccin antiviral', 3: 'Vaccin antibactérien',
      4: 'Désensibilisation', 5: 'Immunosuppresseurs', 6: 'Sérum antiviral',
      7: 'Antibiotiques ou sérum antibactérien', 8: 'Antihistaminiques',
    } },
    4: { mode: 'action', label: 'GO : observer la réaction immunitaire' },
  },
};
