// MOTEUR:0526, 8d0f, 8fa3, 9a13; MAJSIMU:3596.
// The interpreter advances the idle clock by 80 units per animation tick.
export function createEnvironmentAtmosphere(data, assets, prefix, random = Math.random) {
  const count = data.labels.length;
  const ambientCount = data.ambientCount || 0;
  const randomObjects = data.idleModes.filter((mode) => mode === 4).length;
  const pool = ambientCount + randomObjects;
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
    tick(states) {
      if (active && active.frame >= active.resource.frames - 1) active = null;
      if (pool && !active && clock > deadline) {
        const first = deadline === -1;
        const draw = Math.floor(random() * pool);
        // The original random-object branch advances its index before testing
        // selection != previous. With selection 0 and previous nonzero it picks 1.
        const selected =
          draw === 0
            ? previous
            : randomObjects === 0
              ? count + draw - 1
              : draw <= randomObjects
                ? 1
                : pool - draw + count;
        if (selected !== previous) {
          previous = selected;
          const ambient = selected >= count;
          const resource = ambient
            ? assets.ambientReactions?.[`${prefix}_${selected - count}H`]
            : data.idleModes[selected] === 4
              ? assets.idleObjects[
                  `${prefix}_${selected}S${String(states[selected]).padStart(2, '0')}`
                ]
              : null;
          if (resource?.src)
            active = {
              resource,
              frame: 0,
              priority: ambient
                ? data.priorities.ambient[selected - count]
                : data.priorities.idle[selected],
            };
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
