const switchSetting = { mode: 'direct', labels: { 1: 'Activé', 2: 'Désactivé' } };

export default {
  id: '5',
  instructions: 'Choisis un produit dans la colonne de gauche, puis clique sur On ou Off sous chaque test. Le bouton rouge lance la fabrication.',
  controls: {
    1: { mode: 'direct' },
    2: switchSetting,
    3: switchSetting,
    4: switchSetting,
    5: switchSetting,
    6: switchSetting,
    7: switchSetting,
    18: { mode: 'action', label: 'Lancer la fabrication de l’emballage' },
  },
};
