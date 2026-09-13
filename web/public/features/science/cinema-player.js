import { position } from './interaction-model.js';

export const isCinemaObject = (config, id) => Boolean(config?.objects.includes(id));

export function cinemaClip(data, config, catalog, id, state) {
  if (!isCinemaObject(config, id)) return null;
  const option = data.objects.find((o) => o.id === id)?.options.find((s) => s.id === state);
  const name = data.media?.[id]?.[state]?.direct?.replace(/\.VMD$/i, '') || option?.visual;
  if (!name || name.startsWith('VIDE')) return { empty: true };
  const movie = catalog.movies[name];
  if (!movie) return { missing: true };
  return { ...movie, box: [...config.origin, movie.width, movie.height] };
}

// SL_SIMUL PlayDirectAnim @5a1c: PERSOOB=-1 is a temporary cinema,
// not a persistent sprite. capturePush / capturePop preserve the scene below.
export function createCinemaPlayer({ frame, config, catalog, soundEnabled, unavailable }) {
  let close = null, video = null;
  function reset() { close?.(); }
  async function play(data, id, state, signal) {
    const clip = cinemaClip(data, config, catalog, id, state);
    if (!clip) return false;
    if (clip.empty || signal.aborted) return true;
    if (clip.missing) { unavailable(); return true; }
    reset();
    const doc = frame.ownerDocument;
    const previousFocus = doc.activeElement;
    const overlay = doc.createElement('div');
    overlay.className = 'simulation-cinema';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Gros plan de la fourmilière');
    const border = doc.createElement('img');
    border.className = 'simulation-cinema-frame';
    border.src = catalog.frame.url;
    border.alt = '';
    const movie = doc.createElement('video');
    video = movie;
    movie.className = 'simulation-cinema-video';
    movie.style.cssText = position(clip.box);
    movie.playsInline = true;
    movie.muted = !soundEnabled();
    movie.preload = 'auto';
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'button secondary simulation-cinema-close';
    button.textContent = 'Fermer le gros plan';
    overlay.append(border, movie, button);
    frame.append(overlay);
    await new Promise((resolve) => {
      let timer;
      const done = () => {
        if (close !== done) return;
        close = null;
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        movie.removeEventListener('ended', done);
        movie.removeEventListener('error', error);
        movie.removeEventListener('playing', playing);
        movie.pause();
        movie.removeAttribute('src');
        movie.load();
        video = null;
        overlay.remove();
        resolve();
        // The enclosing sequence first unlocks controls in its continuation.
        doc.defaultView?.requestAnimationFrame(() => {
          if (!signal.aborted && !close && previousFocus?.isConnected && !previousFocus.disabled) {
            previousFocus.focus({ preventScroll: true });
          }
        });
      };
      const error = () => {
        // Removing src during reset may reject the pending play() promise.
        if (close !== done || signal.aborted) return;
        unavailable();
        done();
      };
      const playing = () => { clearTimeout(timer); };
      close = done;
      signal.addEventListener('abort', done, { once: true });
      movie.addEventListener('ended', done, { once: true });
      movie.addEventListener('error', error, { once: true });
      movie.addEventListener('playing', playing, { once: true });
      button.addEventListener('click', done);
      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); done(); }
      });
      // A missing or unsupported resource must not strand the controls.
      timer = setTimeout(error, 30000);
      movie.src = clip.url;
      movie.play().catch(error);
      button.focus({ preventScroll: true });
    });
    return true;
  }
  return { play, reset, dispose: reset, updateSound: () => { if (video) video.muted = !soundEnabled(); } };
}
