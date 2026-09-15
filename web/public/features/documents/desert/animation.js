// MOTEUR:0526, 8d0f, 8fa3, 9a13. The script advances its clock by 80 per tick.
// ADI4.EXE:004212ff implements RAND(n) as rand() % n, so the upper bound is excluded.
export function createAtmosphere(assets, random = Math.random) {
  let clock, deadline, previous, active, idleFrame;
  function reset() {
    clock = 0;
    deadline = -1;
    previous = -1;
    active = null;
    idleFrame = 0;
  }
  reset();
  return {
    reset,
    tick() {
      if (active && active.frame >= active.resource.frames - 1) active = null;
      if (!active && clock > deadline) {
        const first = deadline === -1;
        const draw = Math.floor(random() * 3);
        // Draw 0 keeps the previous selection, which is not replayed (8fa3:9011).
        // With three declared slots, only S14_0H and S14_1H can be selected.
        if (draw > 0 && draw - 1 !== previous) {
          previous = draw - 1;
          active = { resource: assets.ambientReactions[`S14_${previous}H`], frame: 0 };
        }
        deadline = clock + 20000 + (first ? 0 : Math.floor(random() * 10000));
      }
      const result = { idleFrame: idleFrame++, ambient: active && { ...active } };
      if (active) active.frame++;
      clock += 80;
      return result;
    },
  };
}
