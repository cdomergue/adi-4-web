export function scenePoint(clientX, clientY, bounds, width = 640, height = 480) {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const x = Math.floor(((clientX - bounds.left) * width) / bounds.width);
  const y = Math.floor(((clientY - bounds.top) * height) / bounds.height);
  return x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
}

export function maskColor(pixels, width, height, point) {
  if (!point || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return 0;
  return pixels[(Math.floor(point.y) * width + Math.floor(point.x)) * 4] || 0;
}

export function menuOffset(offset, amount, count, visible = 7) {
  return Math.max(0, Math.min(Math.max(0, count - visible), offset + amount));
}

export function spacePoint(point, scroll) {
  return {
    x: Math.trunc(72 + point.x - 470 + (Math.max(0, Math.min(100, scroll)) * -33) / 100),
    y: Math.trunc(44 + point.y - 184 + (Math.max(0, Math.min(100, scroll)) * 83) / 100),
  };
}
