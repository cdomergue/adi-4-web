import { createMediaScope } from './media.js';
import { position } from './interaction-model.js';

const backgrounds = { 1: '01A1', 3: '03A1', 4: '04A1', 5: '05A1', 8: '08A1', 13: '13A1' };
export function simulationAmbience(id, states) {
  if (String(id) === '6' && states['6'] >= 1 && states['6'] <= 3) return `06A6000${states['6']}`;
  if (String(id) === '7' && states['1'] >= 1 && states['1'] <= 4) return `07A1000${states['1']}`;
  return backgrounds[id] || '';
}
export function welcomeClips(catalog, id, level) {
  const prefix = String(id).padStart(2, '0');
  // Both original discs' experiments are available together in the web version.
  const supported = [String(level), '6', '5', '4', '3'].find((n) => catalog.audio[`${prefix}WLC${n}N0`]);
  return [0, 1, 2].map((part) => `${prefix}WLC${supported}N${part}`).filter((name) => catalog.audio[name]);
}
export function createSimulationAudio(root, id, level, catalog) {
  const sound = () => root.querySelector('#sim-sound').checked;
  const report = (text) => { root.querySelector('#sim-audio-status').textContent = text; };
  const scope = createMediaScope(root, sound, report);
  const bed = scope.channel(true), voice = scope.channel();
  let current = '', paused = false, narration, celebration;
  const prefix = String(id).padStart(2, '0');
  function stopVoice() {
    narration?.abort(); voice.pause(); celebration?.remove(); celebration = null;
  }
  async function say(names) {
    stopVoice();
    narration = new AbortController();
    const signal = narration.signal;
    if (!sound()) return;
    for (const name of names) {
      if (signal.aborted || scope.signal.aborted) break;
      const clip = catalog.audio[name];
      if (clip && !await scope.play(voice, clip.url, signal)) break;
    }
  }
  function update(states) {
    const name = simulationAmbience(id, states);
    if (current === name) return;
    current = name; bed.pause();
    if (catalog.audio[name]) { bed.src = catalog.audio[name].url; if (!paused) scope.start(bed); }
    else bed.removeAttribute('src');
  }
  async function celebrate(situation) {
    say([`${prefix}EVL${situation}1`]);
    bed.pause();
    celebration?.remove();
    const clip = catalog.animations.BRAVO;
    const image = root.ownerDocument.createElement('img');
    celebration = image;
    image.className = 'science-ambient'; image.alt = 'Bravo !';
    image.style.cssText = position([...clip.origin, clip.width, clip.height]);
    let url;
    try {
      const response = await fetch(clip.url, { signal: scope.signal });
      if (!response.ok) return;
      url = URL.createObjectURL(await response.blob());
      if (scope.signal.aborted || celebration !== image) return;
      image.src = url; await image.decode();
      if (scope.signal.aborted || celebration !== image) return;
      root.querySelector('.simulation-frame').append(image);
      await scope.delay(clip.duration * 1000);
    } catch { /* Navigation cancels this temporary animation. */ }
    finally {
      image.remove(); if (url) URL.revokeObjectURL(url);
      if (!paused && !scope.signal.aborted && bed.getAttribute('src')) scope.start(bed);
    }
  }
  return {
    update, stopVoice,
    welcome: () => say(welcomeClips(catalog, id, level)),
    objective: () => say([`${prefix}WLC2O`]),
    success: celebrate,
    help: (challenge) => {
      const step = challenge.total ? challenge.progress : challenge.help;
      if (!Number.isInteger(step) || step < 1 || step > 3) return;
      const name = `${prefix}ASOL${step}`;
      say([catalog.audio[name] ? name : `__ASOL${step}`]);
    },
    pause: (value) => {
      paused = value;
      if (value) { bed.pause(); stopVoice(); }
      else if (bed.getAttribute('src')) scope.start(bed);
    },
    updateSound: () => { scope.updateSound(); if (sound() && !paused && bed.getAttribute('src')) scope.start(bed); },
    dispose: () => { celebration?.remove(); celebration = null; stopVoice(); scope.dispose(); },
  };
}
