/** Hide only the board's cursor after a mouse click, never the page's controls. */
export function bindGameCursor(canvas, { signal, fullscreenTarget = document } = {}) {
  let active = false;
  const show = () => canvas.classList.remove('is-cursor-hidden');
  canvas.addEventListener('pointerdown', event => {
    if (active && event.button === 0 && event.pointerType === 'mouse') {
      canvas.classList.add('is-cursor-hidden');
    }
  }, { signal });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') show();
  }, { signal });
  canvas.addEventListener('blur', show, { signal });
  canvas.addEventListener('pointercancel', show, { signal });
  // Browsers may consume Escape to leave fullscreen without a keydown event.
  fullscreenTarget.addEventListener('fullscreenchange', show, { signal });
  signal?.addEventListener('abort', show, { once: true });
  return {
    show,
    setActive(value) {
      active = value;
      if (!active) show();
    },
  };
}
