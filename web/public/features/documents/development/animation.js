// MOTEUR:0526, 8d0f, 8fa3, 9a13; MAJSIMU case 8. RAND's upper bound is excluded.
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
        const draw = Math.floor(random() * 8);
        // The original random-idle branch selects element 1, whose mode is 0.
        // It does not animate. H0 is also outside the script's selectable range.
        const selected = draw === 0 ? previous : draw <= 2 ? 1 : 17 - draw;
        if (selected !== previous) {
          previous = selected;
          if (selected >= 9)
            active = { resource: assets.ambientReactions[`S08_${selected - 9}H`], frame: 0 };
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
