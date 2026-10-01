// Shared lifecycle for Science media. Each view owns its channels and cancels
// pending playback when the router emits sceneleave.
let catalogPromise;
export function scienceMedia() {
  return catalogPromise ||= fetch('/game/science-media/catalog.json').then((response) => {
    if (!response.ok) throw new Error('Médias Sciences indisponibles');
    return response.json();
  }).catch((error) => { catalogPromise = null; throw error; });
}

export function createMediaScope(root, soundEnabled, report = () => {}) {
  const controller = new AbortController();
  const media = new Set();
  const cleanups = new Set();
  const signal = controller.signal;
  function channel(loop = false) {
    const audio = root.ownerDocument.createElement('audio');
    audio.preload = 'none';
    audio.loop = loop;
    audio.muted = !soundEnabled();
    root.append(audio);
    media.add(audio);
    return audio;
  }
  async function start(element) {
    if (signal.aborted) return false;
    element.muted = !soundEnabled();
    try { await element.play(); return !signal.aborted; }
    catch (error) {
      if (!signal.aborted && error.name !== 'AbortError') {
        report(error.name === 'NotAllowedError'
          ? 'Clique sur Écouter Adi ou sur Lecture pour activer les médias.'
          : 'Ce média n’a pas pu être lu. Tu peux réessayer.');
      }
      return false;
    }
  }
  function play(element, url, playbackSignal = signal) {
    if (!url || signal.aborted || playbackSignal.aborted) return Promise.resolve(false);
    return new Promise((resolve) => {
      let timer, settled = false;
      const done = (result = true) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        element.removeEventListener('ended', ended);
        element.removeEventListener('error', failed);
        signal.removeEventListener('abort', stopped);
        playbackSignal.removeEventListener('abort', stopped);
        cleanups.delete(stopped);
        element.pause();
        resolve(result);
      };
      const ended = () => done(true);
      const failed = () => { report('Ce média n’a pas pu être lu.'); done(false); };
      const stopped = () => done(false);
      cleanups.add(stopped);
      signal.addEventListener('abort', stopped, { once: true });
      playbackSignal.addEventListener('abort', stopped, { once: true });
      element.addEventListener('ended', ended, { once: true });
      element.addEventListener('error', failed, { once: true });
      element.src = url;
      // Source durations bound corrupt or stalled media without locking navigation.
      timer = setTimeout(stopped, 300000);
      start(element).then((ok) => { if (!ok) done(false); });
    });
  }
  function delay(ms) {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => { clearTimeout(timer); cleanups.delete(finish); resolve(); };
      const timer = setTimeout(finish, ms);
      cleanups.add(finish);
    });
  }
  function dispose() {
    controller.abort();
    for (const cleanup of [...cleanups]) cleanup();
    for (const element of media) {
      element.pause(); element.removeAttribute('src'); element.load(); element.remove();
    }
  }
  return {
    signal, channel, start, play, delay, dispose,
    track: (element) => media.add(element),
    updateSound: () => { for (const element of media) element.muted = !soundEnabled(); },
  };
}
