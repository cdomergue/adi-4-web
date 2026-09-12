// SEQS.DBF runs the five observation objects after the power control (object 9).
export function productionSteps(data, states, catalog) {
  const ids = ['9', ...catalog.sequence];
  return ids.flatMap((id) => {
    const object = data.objects.find((entry) => entry.id === id);
    const option = object?.options.find((entry) => entry.id === (id === '9' ? 2 : states[id]));
    if (!option) throw new Error(`Missing dairy state: ${id}`);
    if (option.visual === 'VIDE_DF') return [];
    const clip = catalog.clips[option.visual];
    if (!clip?.frameMap.length || !(clip.fps > 0)) {
      throw new Error(`Missing dairy animation: ${option.visual}`);
    }
    return [{ object: id, name: option.visual, option, clip,
      duration: clip.frameMap.length * 1000 / clip.fps }];
  });
}

export function frameAt(clip, elapsed) {
  return Math.min(clip.frameMap.length - 1, Math.floor(Math.max(0, elapsed) * clip.fps / 1000));
}

export function frameRect(clip, frame) {
  const index = clip.frameMap[frame];
  const local = index % clip.capacity;
  return { page: Math.floor(index / clip.capacity),
    x: (local % clip.columns) * clip.width,
    y: Math.floor(local / clip.columns) * clip.height };
}
