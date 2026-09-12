import { greenhouseGrowth } from '../greenhouse-rules.js';

export default {
  id: '2',
  instructions: 'Clique sur les graduations de l’arrosage, du thermomètre et du gaz, les voyants de lumière ou les flacons de sels minéraux.',
  controls: {
    1: { mode: 'direct' },
    2: { mode: 'direct' },
    3: { mode: 'direct' },
    4: { mode: 'direct' },
    5: { mode: 'direct' },
  },
  calculate(data, selected) {
    const growth = greenhouseGrowth(selected);
    const states = { ...selected, 6: selected['3'] };
    for (const id of ['7', '8', '9']) states[id] = growth[id] + 1;
    return { states, values: growth, resolved: data.objects.map((object) => object.id) };
  },
};
