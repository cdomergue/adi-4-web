export function spriteFrame(clip, frame) {
  const index = Math.max(0, Math.min(clip.frames - 1, Math.floor(frame)));
  const perSheet = clip.framesPerSheet || clip.frames;
  const src = Array.isArray(clip.src) ? clip.src[Math.floor(index / perSheet)] : clip.src;
  return { src, y: clip.format === 'still' ? 0 : (index % perSheet) * clip.height };
}
