import { frameAt, frameRect, productionSteps } from './dairy-sequence.js';

const base = '/game/station/dairy/';
const stageNames = {
  9: 'Mise sous tension…', 4: 'Le lait entre dans la cuve de caillage…',
  5: 'Le lait caillé passe à l’égouttage…', 6: 'Le fromage passe à l’affinage…',
  7: 'Le laitage arrive dans l’assiette…', 8: 'La souris goûte le résultat…',
};

export function createDairyPlayer({ frame, announce, changed, powerOff, audio, soundEnabled }) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.className = 'dairy-production';
  canvas.hidden = true;
  canvas.setAttribute('aria-label', 'Fabrication du laitage, du lait jusqu’à l’assiette');
  frame.append(canvas);
  const ctx = canvas.getContext('2d');
  const pictures = new Map();
  let catalog, generation = 0, animation = 0, resolveFrame, previousTick;
  let busy = false, complete = false;

  function image(name) {
    if (!pictures.has(name)) {
      const promise = new Promise((resolve, reject) => {
        const picture = new Image();
        picture.onload = () => resolve(picture);
        picture.onerror = () => { pictures.delete(name); reject(new Error(`Missing ${name}`)); };
        picture.src = base + name;
      });
      pictures.set(name, promise);
    }
    return pictures.get(name);
  }

  function reset() {
    generation++;
    cancelAnimationFrame(animation);
    resolveFrame?.(false);
    resolveFrame = null;
    busy = complete = false;
    canvas.hidden = true;
    ctx.clearRect(0, 0, 640, 480);
    frame.dataset.sequenceStage = 'idle';
    delete frame.dataset.sequenceFrame;
    audio.pause();
  }

  function draw(clip, index, loaded) {
    const source = frameRect(clip, index);
    // Opaque replacement patches erase the closed shutter / previous mouse pose.
    ctx.drawImage(loaded[clip.pages[source.page]], source.x, source.y,
      clip.width, clip.height, clip.x, clip.y, clip.width, clip.height);
  }

  function play(step, loaded, token) {
    const backing = step.clip.transparent
      ? ctx.getImageData(step.clip.x, step.clip.y, step.clip.width, step.clip.height) : null;
    return new Promise((resolve) => {
      resolveFrame = resolve;
      let elapsed = 0, lastFrame = -1;
      previousTick = null;
      function tick(now) {
        if (token !== generation) { resolve(false); return; }
        if (previousTick !== null && !document.hidden) elapsed += Math.min(100, now - previousTick);
        previousTick = document.hidden ? null : now;
        const index = frameAt(step.clip, elapsed);
        if (index !== lastFrame) {
          if (backing) ctx.putImageData(backing, step.clip.x, step.clip.y);
          draw(step.clip, index, loaded);
          frame.dataset.sequenceFrame = index;
          lastFrame = index;
        }
        if (elapsed >= step.duration) { resolveFrame = null; resolve(true); }
        else animation = requestAnimationFrame(tick);
      }
      animation = requestAnimationFrame(tick);
    });
  }

  async function start(data, selected) {
    reset();
    const token = generation;
    const states = { ...selected }; // One batch keeps its recipe until it has finished.
    busy = true;
    frame.dataset.sequenceStage = 'loading';
    announce('Préparation de la machine…');
    changed();
    try {
      if (!catalog) {
        const response = await fetch(base + 'catalog.json');
        if (!response.ok) throw new Error('Missing production manifest');
        catalog = await response.json();
      }
      const steps = productionSteps(data, states, catalog);
      const controls = ['1', '2', '3', '9'].map((id) => {
        const option = data.objects.find((obj) => obj.id === id).options
          .find((option) => option.id === (id === '9' ? 1 : states[id]));
        return catalog.clips[option.visual];
      });
      const names = new Set([catalog.background,
        ...[...controls, ...steps.map((step) => step.clip)].flatMap((clip) => clip.pages)]);
      const loaded = Object.fromEntries(await Promise.all([...names].map(async (name) => [name, await image(name)])));
      if (token !== generation) return;
      ctx.drawImage(loaded[catalog.background], 0, 0);
      for (const clip of controls) draw(clip, clip.frameMap.length - 1, loaded);
      canvas.hidden = false;
      for (const step of steps) {
        frame.dataset.sequenceStage = step.object;
        announce(stageNames[step.object]);
        if (soundEnabled() && step.option.audio) {
          audio.pause();
          audio.src = step.option.audio;
          audio.play().catch(() => {});
        }
        if (!await play(step, loaded, token)) return;
      }
      if (token !== generation) return;
      draw(controls[3], controls[3].frameMap.length - 1, loaded);
      busy = false;
      complete = true;
      frame.dataset.sequenceStage = 'complete';
      powerOff();
      changed();
      const product = data.objects.find((obj) => obj.id === '7').options
        .find((option) => option.id === states['7']);
      announce(`${product.label} : la fabrication est terminée. Tu peux relancer Power.`);
    } catch {
      if (token !== generation) return;
      reset();
      powerOff();
      changed();
      announce('La fabrication n’a pas pu être chargée. Réessaie avec Power.');
    }
  }

  const onVisibility = () => { previousTick = null; };
  document.addEventListener('visibilitychange', onVisibility);
  return {
    start, reset,
    get busy() { return busy; },
    get complete() { return complete; },
    dispose() { reset(); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
