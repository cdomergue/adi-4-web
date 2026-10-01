export const closeupAssets = '/game/room/closeups/';
export const placeRoomMedia = ({ x, y, width, height }, [dx, dy] = [0, 0]) =>
  `left:${(x + dx) / 6.4}%;top:${(y + dy) / 4.8}%;width:${width / 6.4}%;height:${height / 4.8}%`;

// Each channel owns its pending load, audio and completion. Cancelling a scene
// settles its promises, so a late load cannot navigate to a document afterwards.
export function createCloseupPlayer(frame, catalog, onBlocked = () => {}) {
  const channels = new Map();
  let disposed = false, muted = false;
  function channel(name) {
    if (!channels.has(name)) {
      const image = document.createElement('img');
      image.className = `room-closeup-layer room-closeup-${name}`;
      image.alt = name === 'actor' ? 'Adi' : '';
      image.hidden = true;
      const audio = document.createElement('audio');
      audio.preload = 'auto';
      frame.append(image, audio);
      channels.set(name, { image, audio, serial: 0 });
    }
    return channels.get(name);
  }
  function stop(name) {
    const c = channels.get(name);
    if (!c) return;
    c.serial++;
    clearTimeout(c.timer);
    c.image.onload = c.image.onerror = null;
    c.audio.pause();
    c.audio.removeAttribute('src');
    c.image.hidden = true;
    c.finish?.(false);
    c.finish = null;
  }
  function still(media, offset = [0, 0], name = 'actor') {
    stop(name);
    if (disposed || !media) return;
    const c = channel(name);
    c.image.style.cssText = placeRoomMedia(media, offset);
    c.image.src = closeupAssets + media.file;
    c.image.hidden = false;
  }
  function play(name, { offset = [0, 0], track = 'actor' } = {}) {
    stop(track);
    if (disposed) return Promise.resolve(false);
    const media = catalog.clips[name];
    if (!media) return Promise.reject(new Error(`Média de chambre absent : ${name}`));
    const c = channel(track), token = c.serial;
    c.image.dataset.clip = name;
    return new Promise((resolve) => {
      let settled = false;
      c.finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const current = () => !disposed && token === c.serial;
      const start = async () => {
        if (!current()) return;
        c.image.onload = c.image.onerror = null;
        if (media.audio) {
          c.audio.src = closeupAssets + media.audio;
          c.audio.muted = muted;
          try { await c.audio.play(); }
          catch {
            if (current()) { onBlocked(); c.finish(false); }
            return;
          }
        }
        if (!current()) return;
        if (media.file) {
          c.image.src = closeupAssets + media.file + `?play=${token}`;
          c.image.hidden = false;
        }
        c.timer = setTimeout(() => {
          if (!current()) return;
          c.audio.pause();
          c.image.hidden = true;
          c.finish(true);
        }, media.duration);
      };
      if (media.file) {
        c.image.style.cssText = placeRoomMedia(media, offset);
        c.image.onload = start;
        c.image.onerror = () => { if (current()) { onBlocked(); c.finish(false); } };
        c.image.src = closeupAssets + media.file;
      } else start();
    });
  }
  return { play, still, stop,
    mute(value) { muted = value; for (const c of channels.values()) c.audio.muted = value; },
    dispose() {
      disposed = true;
      for (const [name, c] of channels) { stop(name); c.image.remove(); c.audio.remove(); }
      channels.clear();
    },
  };
}
