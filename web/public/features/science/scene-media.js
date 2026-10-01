import { scienceMedia, createMediaScope } from './media.js';
import { actors, narration, visitScene } from './narration.js';
import { position } from './interaction-model.js';

const loops = {
  station: 'VUEXLOOP', biology: 'VUINLOOP', geology: 'GEOLOOP', chemistry: 'CHIMLOOP',
  physics: 'PHYLOOP', health: 'SANTLOOP', farm: 'ELELOOP', life: 'VIELOOP',
};

export async function startSceneMedia(main, root, id, { level = '6', arrival = false } = {}) {
  const sound = root.querySelector('[data-science-sound]');
  const report = (text) => { root.querySelector('[data-media-status]').textContent = text; };
  const scope = createMediaScope(root, () => sound.checked, report);
  main.addEventListener('sceneleave', () => scope.dispose(), { once: true });
  const frame = root.querySelector('.scene-frame');
  const bed = scope.channel(true), voice = scope.channel(), effect = scope.channel();
  let speaking = false, presenting = false, speechController, movieController, ambientController, ambientImage;
  let media, actorData;
  try {
    [media, actorData] = await Promise.all([scienceMedia(), fetch('/game/science-media/actors.json').then((r) => {
      if (!r.ok) throw new Error('Adi indisponible');
      return r.json();
    })]);
  } catch { if (!scope.signal.aborted) report('Les médias de cet écran sont indisponibles.'); return; }
  if (scope.signal.aborted) return;
  const visit = visitScene(id);
  const layer = document.createElement('div');
  layer.className = 'science-actor';
  layer.setAttribute('aria-label', 'Adi');
  layer.hidden = true;
  const base = document.createElement('img'), face = document.createElement('img');
  base.alt = ''; face.alt = '';
  layer.append(base, face); frame.append(layer);
  const actor = actors[id];
  base.src = actorData.poses[actor.pose].url;
  base.style.cssText = position([...actor.origin, 215, 330]);
  async function speak() {
    if (presenting || scope.signal.aborted) return;
    speechController?.abort();
    ambientController?.abort(); effect.pause(); ambientImage?.remove();
    const controller = new AbortController();
    speechController = controller;
    speaking = true;
    report('Adi présente cet écran. Clique à nouveau sur Écouter Adi pour recommencer.');
    const fade = async (appearing) => {
      face.hidden = true;
      layer.hidden = false;
      // AE_ADI LaSemiTransAdi: 17 blend levels, one every 20 ms.
      for (let step = 0; step <= 16; step++) {
        if (scope.signal.aborted || controller.signal.aborted) return;
        layer.style.opacity = (appearing ? step : 16 - step) / 16;
        await scope.delay(20);
      }
    };
    await fade(true);
    for (const name of narration(id, level, visit.count)) {
      if (controller.signal.aborted || scope.signal.aborted) break;
      const clip = actorData.clips[name];
      if (!clip?.sound) continue;
      const offset = clip.origin.every((v) => v === 0)
        ? { A: [66, 14], D: [78, 39], X: [87, 129] }[actor.pose] : [0, 0];
      face.style.cssText = position([actor.origin[0] + offset[0], actor.origin[1] + offset[1], clip.width, clip.height]);
      let url;
      try {
        const response = await fetch(clip.url, { signal: controller.signal });
        if (!response.ok) throw new Error('Animation absente');
        url = URL.createObjectURL(await response.blob());
        if (scope.signal.aborted || controller.signal.aborted) { URL.revokeObjectURL(url); break; }
        face.src = url;
        await face.decode();
        if (scope.signal.aborted || controller.signal.aborted) break;
        face.hidden = false;
        layer.hidden = false;
        const played = await scope.play(voice, clip.sound.url, controller.signal);
        if (!played) break;
      } catch (error) {
        if (error.name !== 'AbortError' && !scope.signal.aborted) report('L’animation d’Adi n’a pas pu être lue.');
      } finally { if (url) URL.revokeObjectURL(url); }
    }
    if (speechController === controller) {
      if (!scope.signal.aborted && !controller.signal.aborted) await fade(false);
      speaking = false; layer.hidden = true;
      if (!scope.signal.aborted) report('');
    }
  }
  async function intro(name = 'INTRO') {
    if (presenting || scope.signal.aborted) return;
    presenting = true; speechController?.abort(); layer.hidden = true; bed.pause(); effect.pause();
    ambientController?.abort(); ambientImage?.remove();
    const overlay = document.createElement('div'); overlay.className = 'science-arrival';
    const video = document.createElement('video'); video.playsInline = true; video.controls = true;
    video.setAttribute('aria-label', name === 'INTRO' ? 'Arrivée à la station Sciences' : 'Départ de la station Sciences');
    const skip = document.createElement('button'); skip.className = 'button secondary';
    skip.textContent = name === 'INTRO' ? 'Entrer dans la station' : 'Revenir à la chambre';
    overlay.append(video, skip); frame.append(overlay); scope.track(video);
    movieController = new AbortController();
    skip.onclick = () => movieController.abort();
    // A rejected autoplay leaves visible native controls and the skip button.
    const finished = scope.play(video, media.movies[name].url, movieController.signal);
    await finished;
    if (video.currentTime === 0 && !scope.signal.aborted && !movieController.signal.aborted) {
      await new Promise((resolve) => {
        video.addEventListener('ended', resolve, { once: true });
        movieController.signal.addEventListener('abort', resolve, { once: true });
        scope.signal.addEventListener('abort', resolve, { once: true });
      });
    }
    video.pause(); video.removeAttribute('src'); video.load(); overlay.remove();
    presenting = false;
    if (!scope.signal.aborted && name === 'INTRO') { scope.start(bed); await speak(); }
  }
  sound.onchange = () => { scope.updateSound(); if (sound.checked && !presenting) scope.start(bed); };
  root.querySelector('[data-adi-replay]').onclick = () => { scope.start(bed); speak(); };
  const replay = root.querySelector('[data-intro-replay]');
  if (replay) replay.onclick = () => intro();
  const back = root.querySelector('.scene-heading a[href="#room"]');
  if (back) back.onclick = async (event) => {
    if (presenting) return;
    event.preventDefault();
    await intro('SHIP6');
    if (!scope.signal.aborted) location.hash = 'room';
  };
  bed.src = media.audio[loops[id]].url;
  if (arrival && id === 'station') await intro();
  else { scope.start(bed); if (visit.first) await speak(); }
  let previous = '';
  while (!scope.signal.aborted) {
    await scope.delay(2000 + Math.random() * 300);
    if (scope.signal.aborted) break;
    if (speaking || presenting) continue;
    const choices = (media.ambience[id] || []).filter((name) => name !== previous && (media.animations[name] || media.audio[name]));
    const name = choices[Math.floor(Math.random() * choices.length)];
    if (!name) continue;
    previous = name;
    ambientController = new AbortController();
    const clip = media.animations[name];
    if (!clip) { await scope.play(effect, media.audio[name].url, ambientController.signal); continue; }
    const image = document.createElement('img');
    ambientImage = image;
    image.className = 'science-ambient'; image.alt = '';
    image.style.cssText = position([...clip.origin, clip.width, clip.height]);
    let url;
    try {
      const response = await fetch(clip.url, { signal: scope.signal });
      if (!response.ok) continue;
      url = URL.createObjectURL(await response.blob());
      if (scope.signal.aborted) break;
      image.src = url; await image.decode();
      if (scope.signal.aborted || presenting || speaking) continue;
      frame.append(image);
      if (clip.sound) { effect.src = clip.sound.url; scope.start(effect); }
      await scope.delay(clip.duration * 1000);
    } catch { /* Navigation cancels pending media fetches. */ }
    finally { image.remove(); effect.pause(); if (url) URL.revokeObjectURL(url); }
  }
}
