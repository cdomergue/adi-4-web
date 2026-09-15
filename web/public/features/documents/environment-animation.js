export function spriteFrame(clip, frame) {
  const index = Math.max(0, Math.min(clip.frames - 1, Math.floor(frame)));
  const perSheet = clip.framesPerSheet || clip.frames;
  const src = Array.isArray(clip.src) ? clip.src[Math.floor(index / perSheet)] : clip.src;
  return { src, y: clip.format === 'still' ? 0 : (index % perSheet) * clip.height };
}

export function clipDuration(clip) {
  return Math.max((clip.frames * 1000) / clip.fps, (clip.duration || 0) * 1000);
}

export function transitionSteps(data, previous, next, changed = null) {
  const order = changed === null ? data.labels.map((_, i) => i) : data.dependencies[changed];
  const steps = [];
  for (const element of order) {
    const from = previous.states[element],
      to = next.states[element];
    if (data.sequential[element]) {
      const direction = Math.sign(to - from);
      for (let state = from; state !== to; state += direction)
        steps.push({
          element,
          state: state + direction,
          clip: direction > 0 ? state + 1 : state,
          reverse: direction < 0,
        });
    } else if (changed !== null || from !== to) {
      // MOTEUR:6be1 replays direct clips even if the dependent visual state is unchanged.
      steps.push({ element, state: to, clip: to, reverse: false });
    }
  }
  return steps;
}
