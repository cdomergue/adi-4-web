// Original VMD gestures, including their enter/hold/leave posture transitions.
export function startRoomIdle(
  image,
  actor,
  base,
  { reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches } = {},
) {
  if (reducedMotion || !actor.idle?.length) return () => {};
  let previous = -1,
    timer,
    stopped = false;
  const alive = () => !stopped && image.isConnected;
  function schedule() {
    if (!alive()) return;
    timer = setTimeout(play, 2000 + Math.random() * 4000);
  }
  function play() {
    if (!alive()) return;
    if (document.hidden) {
      schedule();
      return;
    }
    // Avoid the same gesture twice in succession without breaking posture chains.
    let index = Math.floor(Math.random() * actor.idle.length);
    if (index === previous) index = (index + 1) % actor.idle.length;
    previous = index;
    const clip = actor.idle[index];
    image.onload = () => {
      image.onload = null;
      if (!alive()) return;
      timer = setTimeout(() => {
        if (!alive()) return;
        image.src = base;
        schedule();
      }, clip.duration);
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      image.src = base;
    };
    image.src = '/game/room/activities/' + clip.file;
  }
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    image.onload = null;
    image.onerror = null;
  };
}
