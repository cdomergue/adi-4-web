// AE_ADI::AdiGestion: access counts select the original welcome variants.
const seen = new Map();
export const actors = {
  station: { pose: 'A', origin: [10, 150] },
  biology: { pose: 'A', origin: [180, 230] },
  health: { pose: 'A', origin: [370, 190] },
  chemistry: { pose: 'D', origin: [200, 130] },
  geology: { pose: 'D', origin: [130, 200] },
  physics: { pose: 'A', origin: [30, 280] },
  farm: { pose: 'X', origin: [20, 130] },
  life: { pose: 'X', origin: [80, 200] },
};
export function visitScene(id) {
  if (seen.has(id)) return { count: seen.get(id), first: false };
  let visits = {};
  try { visits = JSON.parse(localStorage.getItem('adi4-science-visits-v1') || '{}'); } catch { /* Memory fallback. */ }
  const count = Math.min(5, (Number(visits[id]) || 0) + 1);
  seen.set(id, count);
  try { localStorage.setItem('adi4-science-visits-v1', JSON.stringify({ ...visits, [id]: count })); } catch { /* Memory fallback. */ }
  return { count, first: true };
}
export function narration(id, level, count, random = Math.random) {
  const junior = ['6', '5'].includes(String(level));
  const ret = (intro = false) => {
    const choices = intro ? [1, 3, 6, 8, 9] : [2, 4, 5, 7, 10];
    return [`RET${choices[Math.floor(random() * choices.length)]}${actors[id].pose}`];
  };
  if (id === 'station') return count === 1 ? ['VUEXT1', 'VUEXT2', 'VUEXT3']
    : count === 2 ? ['VUEXT4'] : count === 3 ? ['VUEXT5']
      : count === 4 ? [junior ? 'VUEXT6' : 'VUEXT7'] : ret(true);
  if (id === 'biology') return count === 1 ? ['VUINT1', 'VUINT2', 'VUINT3', 'VUINT4']
    : count === 2 ? ['VUINT5'] : [];
  const sequences = {
    health: [[junior ? 'SANTE2' : 'SANTE1'], ['SANTE3'], ['SANTE4']],
    chemistry: [[junior ? 'CHIMIE4' : 'CHIMIE1'], ['CHIMIE2'], ['CHIMIE3']],
    geology: [[junior ? 'GEO4' : 'GEO1'], ['GEO2'], ['GEO3']],
    physics: [[junior ? 'PHYSIQ4' : 'PHYSIQ1'], junior ? ret() : ['PHYSIQ3'], junior ? ret() : ['PHYSIQ2']],
    farm: [junior ? ['ELEVAG1', 'ELEVAG2'] : ['ELEVAG5'], junior ? ['ELEVAG3'] : ret(), junior ? ['ELEVAG4'] : ret()],
    life: [[junior ? 'VIE4' : 'VIE1'], junior ? ret() : ['VIE2'], junior ? ret() : ['VIE3']],
  };
  return sequences[id]?.[count - 1] || ret();
}
