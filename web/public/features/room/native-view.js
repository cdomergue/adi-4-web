import { createNativeRoom } from './native-engine.js';

const BASE = '/game/room/native/';
// EDIINTRO.EXT #0..3 and LIBAPPEL:ab25: the original resting sprites.
const POSES = { 0: [210,150,210,330], 3: [250,180,100,229],
  6: [265,190,65,200], 10: [250,270,120,150] };
const FACES = { 0: [276, 164], 3: [288, 189], 6: [284, 194], 8: [371, 195], 10: [297, 279] };

// Independent tracks retain replacement rectangles between VMDs. The original
// script controls which tracks run together and when it can advance.
export function startNativeRoom({ frame, actorImage, canPlay, hint, catalog, texts, trajectories, makeEngine = createNativeRoom }) {
  const canvases = {}, contexts = {}, tracks = new Map(), images = new Map();
  const channels = {};
  for (const type of ['actor', 'object', 'voice']) {
    const audio = document.createElement('audio');
    audio.dataset.roomTrack = type; audio.preload = 'auto';
    frame.append(audio); channels[type] = audio;
  }
  let engine, stopped = false, suspended = false, failed = false, generation = 0, lastTick = 0;
  let soundEnabled = true;
  let raf, pose = 3, sceneImage, poseLoading = 0;
  let frozenAt = null, pausedMilliseconds = 0;
  const startAt = performance.now(), epoch = Date.now() / 1000 - new Date().getTimezoneOffset() * 60;
  const still = frame.querySelector('img');
  const hotspot = frame.querySelector('[data-room-object="adi"]');
  const baseImage = still.src;
  for (const name of ['object', 'actor', 'mouth']) {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    canvas.className = `room-native room-native-${name}`;
    canvas.setAttribute('aria-hidden', 'true');
    frame.append(canvas); canvases[name] = canvas; contexts[name] = canvas.getContext('2d');
  }
  const soundToggle = document.createElement('button');
  soundToggle.className = 'button secondary room-enable-sound';
  soundToggle.type = 'button';
  soundToggle.setAttribute('aria-pressed', 'true');
  soundToggle.textContent = 'Désactiver le son';
  frame.after(soundToggle);
  const updateSoundToggle = () => {
    soundToggle.textContent = soundEnabled ? 'Désactiver le son' : 'Activer le son';
    soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    for (const audio of Object.values(channels)) audio.muted = !soundEnabled;
  };
  const disableSound = () => {
    soundEnabled = false;
    updateSoundToggle();
  };
  const playTrackAudio = (track) => {
    if (soundEnabled) track.audio?.play().catch(disableSound);
  };
  const unlockChannels = () => {
    for (const [type, audio] of Object.entries(channels)) if (!audio.getAttribute('src')) {
      audio.src = 'data:audio/wav;base64,UklGRtwBAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YbgBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
      audio.play().then(() => { if (!tracks.get(type)?.audio) audio.pause(); }).catch(() => {});
    }
  };
  soundToggle.onclick = () => {
    soundEnabled = !soundEnabled;
    updateSoundToggle();
    if (!soundEnabled) return;
    unlockChannels();
    for (const track of tracks.values()) if (track.audio && track.audio.paused) {
      track.audio.currentTime = Math.min(track.audio.duration || 0, Math.max(0, (performance.now() - track.start) / 1000));
      playTrackAudio(track);
    }
  };
  function image(file) {
    if (!images.has(file)) {
      const promise = new Promise((resolve, reject) => {
        const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error(`Image ${file}`)); value.src = BASE + file;
      });
      images.set(file, promise);
      // Atlas pages are immutable; release old references while preserving the
      // current movie's own references until its playback has completed.
      if (images.size > 24) images.delete(images.keys().next().value);
    }
    return images.get(file);
  }
  function clear(type) { contexts[type].clearRect(0, 0, 640, 480); }
  function draw(track, index) {
    const { clip, pages, type } = track;
    if (!clip.frameMap.length || type === 'voice') return;
    const frameIndex = clip.frameMap[Math.min(index, clip.frameMap.length - 1)];
    const page = pages[Math.floor(frameIndex / clip.capacity)];
    const tile = frameIndex % clip.capacity;
    const face = type === 'actor' && clip.x === 0 && clip.y === 0;
    let [x, y] = face ? FACES[track.pose] || [0, 0] : [clip.x, clip.y];
    if (face) {
      const delta = track.tilt === 1 ? ({3: [-6,4],6: [-5,3]}[track.pose])
        : track.tilt === 2 ? ({0: [-16,9],3: [-7,3]}[track.pose]) : null;
      if (delta) { x += delta[0]; y += delta[1]; }
    }
    if (type === 'mouth') {
      [x, y] = track.trajectory[Math.min(index + 1, track.trajectory.length - 1)];
      clear('mouth');
    }
    canvases[type].dataset.clip = track.name || '';
    canvases[type].dataset.frame = String(index);
    const ctx = contexts[type];
    ctx.clearRect(x, y, clip.width, clip.height);
    ctx.drawImage(page, (tile % clip.columns) * clip.width, Math.floor(tile / clip.columns) * clip.height,
      clip.width, clip.height, x, y, clip.width, clip.height);
  }
  function updateHotspot(value) {
    const bounds = POSES[value];
    if (!bounds) return;
    const [x, y, width, height] = bounds;
    Object.assign(hotspot.style, { left: `${x / 6.4}%`, top: `${y / 4.8}%`,
      width: `${width / 6.4}%`, height: `${height / 4.8}%` });
  }
  async function showPose(value) {
    pose = value; updateHotspot(value);
    const bounds = POSES[value];
    if (!bounds) return;
    const token = generation; poseLoading++;
    try {
      const picture = await image(`pose-${value}.webp`);
      if (stopped || token !== generation) return;
      const [x, y, w, h] = bounds;
      clear('actor');
      contexts.actor.drawImage(picture,0,0,w,h,x,y,w,h);
      canvases.actor.hidden = false;
    } finally { poseLoading--; }
  }
  function finishTrack(type, notify = true) {
    const track = tracks.get(type); if (!track) return;
    track.audio?.pause(); tracks.delete(type);
    if (type === 'object') clear(type);
    if (type === 'voice') clear('mouth');
    if (notify) engine.complete(type, track.name);
  }
  async function play(event) {
    finishTrack(event.type, false);
    const token = generation, clip = catalog.clips[event.name];
    if (!clip) throw new Error(`Média original absent : ${event.name}`);
    const track = { ...event, clip, loading: true, start: 0, lastFrame: -1 };
    tracks.set(event.type, track);
    const pages = event.type === 'voice' ? [] : await Promise.all(clip.pages.map(image));
    if (stopped || token !== generation || tracks.get(event.type) !== track) return;
    track.pages = pages;
    if (event.mouth) {
      const mouthClip = catalog.clips[event.mouth.name];
      const trajectory = trajectories[event.mouth.trajectory];
      if (!mouthClip || !trajectory) throw new Error(`Bouche originale absente : ${event.mouth.name}`);
      track.mouth = { clip: mouthClip, pages: await Promise.all(mouthClip.pages.map(image)),
        type: 'mouth', name: event.mouth.name, trajectory };
    }
    if (event.type === 'actor') {
      pose = event.pose; updateHotspot(pose);
      canvases.actor.hidden = false;
    }
    if (clip.audio && !event.muted) {
      const audio = channels[event.type];
      audio.src = BASE + clip.audio;
      audio.muted = !soundEnabled;
      track.audio = audio; audio.preload = 'auto';
      // Decode/load before starting the frame clock so the face and voice share
      // the same start, including first use on a slow connection.
      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = resolve;
        audio.onerror = () => reject(new Error(`Son ${event.name}`));
        audio.load();
      });
      if (stopped || token !== generation || tracks.get(event.type) !== track) { audio.pause(); return; }
    }
    track.pendingStart = true;
    track.loading = false;
    if (event.type === 'actor') draw(track, 0);
  }
  function emit(event) {
    if (event.type === 'cancelTracks') {
      generation++;
      for (const type of tracks.keys()) finishTrack(type, false);
      clear('mouth'); return;
    }
    if (['actor', 'object', 'voice'].includes(event.type)) { play(event).catch(fail); return; }
    if (event.type === 'pose') { showPose(event.pose).catch(fail); return; }
    if (event.type === 'hideActor') { canvases.actor.hidden = true; return; }
    if (event.type === 'scene') {
      clear('actor'); clear('object'); clear('mouth');
      canvases.actor.hidden = !event.actorVisible;
      return;
    }
    if (event.type === 'background') {
      sceneImage = `/game/room/image-${event.index}.webp`; still.src = sceneImage; return;
    }
    if (event.type === 'text' && event.text) {
      // CCONT:d2f3 uses ve15, initialized to palette index 0 (black).
      const ctx = contexts.object; ctx.fillStyle = '#000'; ctx.font = '16px monospace';
      ctx.fillText(event.text, event.x, event.y + 14); return;
    }
    if (event.type === 'closeToolbar') frame.classList.remove('toolbar-pinned');
    if (event.type === 'sleep') { frame.classList.add('room-sleeping'); }
    if (event.type === 'wake') {
      frame.classList.remove('room-sleeping'); finishTrack('actor', false);
    }
    if (event.type === 'end') updateHotspot(event.pose);
  }
  function fail(error) {
    failed = true;
    console.error('Lecture du scénario original ADI', error);
    hint.textContent = error.message;
    suspend();
  }
  function suspend() {
    generation++; engine?.stop();
    for (const type of tracks.keys()) finishTrack(type, false);
    clear('actor'); clear('object'); clear('mouth'); suspended = true;
    canvases.actor.hidden = canvases.object.hidden = canvases.mouth.hidden = true;
    frame.classList.remove('room-sleeping');
    if (sceneImage) still.src = baseImage;
    sceneImage = null;
    actorImage.hidden = false;
  }
  function resume() {
    suspended = false; generation++; actorImage.hidden = true;
    canvases.actor.hidden = canvases.object.hidden = canvases.mouth.hidden = false;
    engine = makeEngine({ emit, texts,
      seconds: () => epoch + ((frozenAt ?? performance.now()) - startAt - pausedMilliseconds) / 1000,
      available: name => !!catalog.clips[name] });
    showPose(engine.v[0x14d]).catch(fail);
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function loop(now) {
    if (stopped) return;
    if (document.hidden) { raf = requestAnimationFrame(loop); return; }
    const allowed = !failed && !reduced.matches && canPlay();
    if (!allowed && !suspended) suspend();
    if (allowed && suspended) resume();
    if (!suspended) {
      if (![...tracks.values()].some(t => t.loading)) {
        for (const track of tracks.values()) if (track.pendingStart) {
          track.pendingStart = false;
          track.start = now + (track.delayFrames || 0) / 12 * 1000;
        }
      }
      for (const [type, track] of tracks) {
        if (track.loading || track.pendingStart || now < track.start) continue;
        const elapsed = now - track.start;
        if (track.audio && !track.audioStarted) {
          track.audioStarted = true;
          track.audio.loop = track.repeats === Infinity;
          playTrackAudio(track);
        }
        const { clip } = track, step = track.step || 1;
        const passDuration = Math.max(clip.frames / clip.fps / step * 1000, track.muted ? 0 : clip.audioDuration);
        const repeats = track.repeats || 1;
        if (elapsed >= passDuration * repeats) { finishTrack(type); continue; }
        const pass = Math.floor(elapsed / passDuration);
        if (pass && track.pass !== pass && track.audio && repeats !== Infinity) {
          track.audio.currentTime = 0; playTrackAudio(track);
        }
        track.pass = pass;
        const index = Math.min(clip.frames - 1, Math.floor((elapsed % passDuration) * clip.fps / 1000) * step);
        if (track.lastFrame !== index) { draw(track, index); track.lastFrame = index; }
        if (track.mouth) {
          const mouthFrame = Math.min(track.mouth.clip.frames - 1, Math.floor(elapsed * 12 / 1000));
          draw(track.mouth, mouthFrame);
        }
      }
      if (!poseLoading && now - lastTick >= 1000 / 12 && ![...tracks.values()].some(t => t.loading)) {
        lastTick = now;
        try { engine.tick(); } catch (error) { fail(error); }
      }
    }
    raf = requestAnimationFrame(loop);
  }
  function visibilityChanged() {
    if (document.hidden && frozenAt === null) {
      frozenAt = performance.now();
      for (const track of tracks.values()) track.audio?.pause();
    } else if (!document.hidden && frozenAt !== null) {
      const delta = performance.now() - frozenAt; pausedMilliseconds += delta; frozenAt = null;
      for (const track of tracks.values()) {
        track.start += delta;
        if (track.audioStarted) playTrackAudio(track);
      }
    }
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  function interact(event) {
    if (stopped) return;
    unlockChannels();
    if (suspended || event.target.closest('.room-toolbar')) return;
    if (engine.interact()) { event.stopImmediatePropagation(); event.preventDefault(); }
  }
  frame.addEventListener('click', interact, true);
  resume(); raf = requestAnimationFrame(loop);
  return {
    reset() { failed = false; suspend(); },
    speak() { if (suspended) resume(); engine.speak(); return true; },
    stop() {
      stopped = true; suspend(); cancelAnimationFrame(raf);
      frame.removeEventListener('click', interact, true);
      document.removeEventListener('visibilitychange', visibilityChanged);
      for (const canvas of Object.values(canvases)) canvas.remove();
      for (const audio of Object.values(channels)) { audio.pause(); audio.remove(); }
      soundToggle.remove(); images.clear();
    },
  };
}
