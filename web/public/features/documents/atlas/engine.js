export const viewport = { width: 640, height: 480 };
export const dimensions = { 4: { width: 748, height: 480 }, 5: { width: 2688, height: 1728 } };
export const wrap = (value, size) => ((value % size) + size) % size;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createAtlas() {
  return {
    level: 3,
    x: 0,
    y: 0,
    rotation: 0,
    topic: 41,
    overlay: null,
    borders: false,
    names: true,
    cities: false,
    media: true,
    grid: false,
  };
}

export function pan(state, dx, dy) {
  if (state.level === 3) return { ...state, rotation: wrap(state.rotation + dx / 4, 90) };
  const size = dimensions[state.level];
  return {
    ...state,
    x: wrap(state.x + dx, size.width),
    y: clamp(state.y + dy, 0, size.height - viewport.height),
  };
}

// NAVIGA4 projects the selected pixel into 2688 × 1728, then centers 640 × 480 on it.
export function zoom(state, direction, point = { x: 320, y: 240 }) {
  const level = clamp(state.level + Math.sign(direction), 3, 5);
  if (level === state.level) return state;
  if (level === 3) return { ...state, level, rotation: wrap((-state.x / 748) * 90, 90) };
  if (state.level === 3)
    return { ...state, level, x: wrap((-state.rotation / 90) * 748, 748), y: 0 };
  const from = dimensions[state.level],
    to = dimensions[level];
  return pan(
    { ...state, level, x: 0, y: 0 },
    (wrap(state.x + point.x, from.width) / from.width) * to.width - 320,
    ((state.y + point.y) / from.height) * to.height - 240,
  );
}

export function screenPoint(point, state) {
  if (state.level === 3) return null;
  const size = dimensions[state.level];
  return {
    x: wrap((point.x * size.width) / 2688 - state.x, size.width),
    y: (point.y * size.height) / 1728 - state.y,
  };
}

export function visibleMedia(topic, state) {
  if (!state.media || state.level === 3) return [];
  const points = state.level === 4 ? topic.points.slice(0, 5) : topic.points.slice(0, 40);
  return points.flatMap((item) => {
    const point = screenPoint(item, state),
      width = dimensions[state.level].width;
    return [point.x, point.x - width]
      .filter((x) => x >= -25 && x < 665 && point.y >= -21 && point.y < 501)
      .map((x) => ({ ...item, left: x - 25, top: point.y - 21 }));
  });
}

export function selectTopic(state, topic) {
  return { ...state, topic: topic.id, overlay: null };
}
