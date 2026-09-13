export default {
  id: '7',
  // Object 4 is a blank decorative layer. Its original 1-based labels do not
  // match the 0-based season values; the selected season is shown by control 1.
  isObservationVisible: (object) => object.id !== '4',
  // OBJS.PERSOOB=-1 for 5/6/7; SL_SIMUL PlayDirectAnim @5a8c–5ae8.
  cinema: {
    objects: ['5', '6', '7'], origin: [121, 112],
    catalog: '/game/station/anthill/catalog.json',
  },
  instructions: 'Choisis une saison, puis un lieu. Le film s’ouvre dans le cadre de gros plan ; ferme-le pour revenir à la fourmilière. Dans les défis, visite les lieux dans l’ordre demandé.',
  controls: {
    1: { mode: 'direct' },
    2: { mode: 'direct', clearState: 1, clearLabel: 'Quitter la salle observée' },
    3: { mode: 'action', label: 'Lancer la séquence de la fourmilière' },
  },
};
