import { calculateSimulation, checkChallenge } from './simulation-engine.js';
import { createSimulationState } from './simulation-state.js';
import { createSequencePlayer, stateMedia } from './sequence-player.js';
import { createCinemaPlayer, isCinemaObject } from './cinema-player.js';
import {
  activeControls, caseData, isObjectVisible, isOptionAllowed, optionLabel, position,
  sceneTargets, targetState, usefulLabel,
} from './interaction-model.js';

const esc = (value) => String(value).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Ressources indisponibles');
  return response.json();
}

export async function renderExperiment(main, definition, { sector, sectorName }) {
  main.innerHTML = '<section id="simulation"><p role="status">Ouverture de l’expérience…</p></section>';
  const root = main.firstElementChild;
  let data, assets, cinemaCatalog;
  try {
    [data, assets] = await Promise.all([
      get(`/game/station/sim-${definition.id}.json`), get('/game/station/assets.json'),
    ]);
    if (!definition.createPlayback) {
      assets = { ...assets, ...await get('/game/station/sequences/assets.json') };
    }
    if (definition.cinema) cinemaCatalog = await get(definition.cinema.catalog);
  } catch {
    if (root.isConnected) root.innerHTML = '<p>Les ressources de cette expérience sont indisponibles.</p><a href="#simulations">Toutes les expériences</a>';
    return;
  }
  if (!root.isConnected) return;
  document.title = `${data.title} · ADI 4`;
  root.dataset.experiment = definition.id;
  root.innerHTML = `
    <div class="scene-heading"><a class="back-link" href="#scene/${sector}">← ${esc(sectorName)}</a><h1>${esc(data.title)}</h1><a class="back-link" href="#simulations">Toutes les expériences →</a></div>
    <p>${esc(definition.instructions)}</p>
    <div class="simulation-toolbar">
      <label>Situation <select id="sim-case">${data.cases.map((c) => `<option value="${c.id}">${esc(c.id === '0' ? 'Exploration libre' : c.label)}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="sim-sound" checked> Son</label>
      <label><input type="checkbox" id="sim-zones"> Montrer les zones de clic</label>
      <button class="button secondary" id="sim-reset">Recommencer</button>
    </div>
    <div class="scene-frame simulation-frame" aria-label="${esc(data.title)}">
      <div class="simulation-layers"></div><div class="simulation-targets"></div>
      <div class="simulation-panel" role="dialog" aria-modal="false" aria-labelledby="sim-panel-title" hidden></div>
    </div>
    <p id="sim-pointer" class="simulation-pointer">Survole une commande pour connaître son rôle.</p>
    <div class="simulation-extra"></div>
    <form id="sim-form"><details class="simulation-settings"><summary>Tous les réglages</summary><div class="simulation-controls"></div></details>
      <button class="button primary" type="submit">Vérifier mes réglages</button></form>
    <p id="sim-status" role="status">Choisis une situation et règle les commandes dans le décor.</p>
    <div id="sim-observations" class="simulation-observations"></div>
    <details><summary>Les conseils d’Adi</summary><div id="sim-hints"></div></details>
    <audio preload="none"></audio><p id="sim-audio-status" role="status"></p>
    <p class="development-note">Décors, zones de clic et calculs issus du jeu original. Les panneaux de choix sont adaptés au navigateur ; la fidélité des séquences animées reste en cours de vérification.</p>`;
  const frame = root.querySelector('.simulation-frame');
  const panel = root.querySelector('.simulation-panel');
  const audio = root.querySelector('audio');
  const status = root.querySelector('#sim-status');
  const pointer = root.querySelector('#sim-pointer');
  let currentCase, currentData, controls, targets, selected, panelOpener;
  let session, displayed, paintOrder = [], animation = null, busy = false, generation = 0;
  const playback = definition.createPlayback?.({
    frame, audio, changed: () => update(),
    announce: (message) => { status.textContent = message; pointer.textContent = message; },
    powerOff: () => { selected['9'] = 1; },
    soundEnabled: () => root.querySelector('#sim-sound').checked,
  });
  const cinema = definition.cinema ? createCinemaPlayer({
    frame, config: definition.cinema, catalog: cinemaCatalog,
    soundEnabled: () => root.querySelector('#sim-sound').checked,
    unavailable: () => {
      root.querySelector('#sim-audio-status').textContent = 'Le film n’a pas pu être lu. Tu peux réessayer en cliquant sur le lieu.';
    },
  }) : null;
  const sequencePlayer = playback ? null : createSequencePlayer({
    movie: cinema?.play,
    draw: (id, state, asset) => {
      displayed[id] = state;
      paintOrder = [...paintOrder.filter((key) => key !== id), id];
      animation = asset ? { id, asset } : null;
      update();
    },
    voice: (url, signal) => new Promise((resolve) => {
      if (!url || !root.querySelector('#sim-sound').checked || signal.aborted) return resolve();
      const done = () => {
        clearTimeout(timeout);
        for (const name of ['ended', 'error', 'pause']) audio.removeEventListener(name, done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timeout = setTimeout(done, 120000); // Broken media must not trap the controls.
      for (const name of ['ended', 'error', 'pause']) audio.addEventListener(name, done, { once: true });
      signal.addEventListener('abort', done, { once: true });
      audio.src = url;
      audio.play().catch(() => {
        if (!signal.aborted) root.querySelector('#sim-audio-status').textContent = 'La voix n’a pas pu être lue.';
        done();
      });
    }),
    unavailable: () => {
      root.querySelector('#sim-audio-status').textContent = 'Une animation est indisponible ; son état final reste affiché.';
    },
  });
  const allowed = (id, state) => playback || isOptionAllowed(currentData, id, state, selected);

  function closePanel(restoreFocus = true) {
    panel.hidden = true;
    if (restoreFocus && panelOpener?.isConnected) panelOpener.focus({ preventScroll: true });
    panelOpener = null;
  }

  function openPanel(objectId, opener) {
    const object = controls.find((item) => item.id === objectId);
    const config = definition.controls[objectId];
    panelOpener = opener;
    panel.dataset.object = objectId;
    panel.innerHTML = `<div class="simulation-panel-heading"><h2 id="sim-panel-title">${esc(config.heading || object.label)}</h2><button type="button" data-close aria-label="Fermer les choix">×</button></div>
      <div class="simulation-options">${object.options.map((option) => `<button type="button" data-choice="${option.id}" ${!allowed(objectId, option.id) ? 'disabled' : ''} aria-pressed="${selected[objectId] === option.id}">${esc(optionLabel(object, option, config))}</button>`).join('')}</div>`;
    // Position relative to the object but keep the full panel inside the scene.
    const [x, y, width] = config.panelBox || object.box;
    panel.style.left = `${x > 320 ? Math.max(2, x / 6.4 - 42) : Math.min(54, (x + width) / 6.4 + 1)}%`;
    panel.style.top = `${Math.min(48, Math.max(2, y / 4.8))}%`;
    panel.hidden = false;
    panel.querySelector('[data-choice][aria-pressed="true"]')?.focus({ preventScroll: true });
  }

  function renderControls() {
    targets = sceneTargets(currentData, definition, currentCase, selected);
    root.querySelector('.simulation-targets').innerHTML = targets.map((target, index) =>
      `<button type="button" class="scene-hotspot simulation-target" data-target="${index}" data-object="${target.object}" data-action="${target.action}" ${target.state ? `data-state="${target.state}"` : ''} aria-label="${esc(target.label)}" style="${position(target.box)}"></button>`).join('');
    root.querySelector('.simulation-controls').innerHTML = controls.map((object) => {
      const config = definition.controls[object.id];
      return `<label>${esc(object.label)}<select data-input="${object.id}">${object.options.map((option) => `<option value="${option.id}">${esc(optionLabel(object, option, config))}</option>`).join('')}</select></label>`;
    }).join('');
    root.querySelector('.simulation-extra').innerHTML = controls.filter((object) =>
      definition.controls[object.id].clearState).map((object) => {
      const config = definition.controls[object.id];
      return `<button type="button" class="button secondary" data-clear="${object.id}">${esc(config.clearLabel)}</button>`;
    }).join('');
  }

  function update(replay = false) {
    frame.setAttribute('aria-busy', String(busy || Boolean(playback?.busy)));
    const result = playback
      ? (definition.calculate || calculateSimulation)(currentData, selected)
      : calculateSimulation(currentData, displayed || selected, { sequence: [] });
    if (playback) Object.assign(selected, result.states);
    const layers = root.querySelector('.simulation-layers');
    const keep = new Set();
    function add(asset, key, isBackground = false, state) {
      if (!asset) return;
      keep.add(key);
      let img = layers.querySelector(`[data-layer="${key}"]`);
      const animate = (animation?.id === key || key.startsWith('equilibrium-')) && !isBackground;
      if (replay && animate && img) { img.remove(); img = null; }
      if (!img) {
        img = document.createElement('img');
        img.dataset.layer = key;
        img.alt = '';
      }
      const url = animate && asset.motion ? asset.motion : asset.url;
      if (img.getAttribute('src') !== url) {
        img.src = url;
        img.dataset.asset = asset.url;
      }
      if (state) img.dataset.state = state;
      img.style.cssText = isBackground
        ? 'position:absolute;inset:0;width:100%;height:100%'
        : `position:absolute;${position([asset.x, asset.y, asset.width, asset.height])}`;
      layers.append(img);
    }
    add(assets[data.background], 'background', true);
    const objects = playback ? [...currentData.objects].sort((a, b) => a.plan - b.plan)
      : paintOrder.map((id) => currentData.objects.find((o) => o.id === id));
    for (const object of objects) {
      if (isCinemaObject(definition.cinema, object.id)) continue;
      if (playback && object.type === 1) continue;
      if (!playback && !isObjectVisible(object, currentCase)) continue;
      if (definition.isVisible && !definition.isVisible(object, currentCase)) continue;
      if (object.type === 1 && !result.resolved.includes(object.id)) continue;
      const option = object.options.find((item) => item.id === result.states[object.id]);
      const asset = playback ? assets[option?.visual]
        : animation?.id === object.id ? animation.asset
          : stateMedia(currentData, object.id, option?.id, assets);
      add(asset, object.id, false, option?.id);
      if (!playback && !busy && currentData.native?.objects[object.id]?.equilibrium) {
        const equilibrium = assets[currentData.media?.[object.id]?.[option?.id]?.equilibrium];
        if (equilibrium?.motion) add(equilibrium, `equilibrium-${object.id}`, false, option.id);
      }
    }
    layers.querySelectorAll('[data-layer]').forEach((img) => {
      if (!keep.has(img.dataset.layer)) img.remove();
    });
    root.querySelectorAll('[data-input]').forEach((input) => {
      input.value = selected[input.dataset.input];
      input.disabled = busy || Boolean(playback?.busy && input.dataset.input !== '9');
      for (const option of input.options) option.disabled = !allowed(input.dataset.input, Number(option.value));
    });
    root.querySelectorAll('[data-target]').forEach((button) => {
      const target = targets[button.dataset.target];
      const object = controls.find((o) => o.id === target.object);
      button.disabled = busy || Boolean(playback?.busy && target.object !== '9') ||
        (target.action !== 'panel' && !allowed(target.object, targetState(target, object, selected)));
      if (target.action === 'select' || target.action === 'toggle') {
        button.setAttribute('aria-pressed', String(selected[target.object] === target.state));
      }
    });
    root.querySelectorAll('[data-clear]').forEach((button) => {
      button.disabled = busy || !allowed(button.dataset.clear, definition.controls[button.dataset.clear].clearState);
    });
    root.querySelector('[type="submit"]').disabled = busy;
    root.querySelector('#sim-observations').innerHTML = (playback && !playback.complete ? [] : currentData.objects)
      .filter((object) => object.type === 1 && result.resolved.includes(object.id) &&
        (playback || isObjectVisible(object, currentCase)) &&
        (!definition.isObservationVisible || definition.isObservationVisible(object)))
      .map((object) => {
        const option = object.options.find((item) => item.id === result.states[object.id]);
        const missing = !playback && currentData.media?.[object.id]?.[option?.id]?.direct &&
          !stateMedia(currentData, object.id, option?.id, assets);
        return usefulLabel(option?.label)
          ? `<p><strong>${esc(object.label)}</strong> : ${esc(option.label)}${missing ? ' (animation originale indisponible)' : ''}</p>` : '';
      }).join('');
    root.querySelector('#sim-hints').innerHTML = controls
      .map((object) => object.hints[currentCase.id] || object.hints['0'])
      .filter(Boolean).map((hint) => `<p>${esc(hint)}</p>`).join('') || '<p>Aucun conseil textuel retrouvé pour cette situation.</p>';
    return result;
  }

  async function set(objectId, value, replay = false) {
    if (busy) return;
    if (playback?.busy && objectId !== '9') return;
    const object = controls.find((item) => item.id === objectId);
    const option = object?.options.find((item) => item.id === value);
    if (!option) return;
    if (sequencePlayer) {
      const event = session.change(objectId, value);
      if (!event.accepted) {
        status.textContent = 'Ce réglage n’est pas disponible dans cette situation.';
        update();
        return;
      }
      const token = ++generation;
      selected = { ...event.after };
      displayed = { ...event.before, [objectId]: event.after[objectId] };
      busy = true;
      audio.pause();
      root.querySelector('#sim-audio-status').textContent = '';
      status.textContent = 'Lecture de la séquence…';
      update();
      const completed = await sequencePlayer.play(currentData, event, assets);
      if (!completed || token !== generation || !root.isConnected) return;
      selected = session.finish().states;
      displayed = { ...selected };
      animation = null;
      busy = false;
      update();
      const challenge = session.challenge();
      status.textContent = challenge.success
        ? 'Bravo ! Tes réglages correspondent à une solution originale.'
        : challenge.total
          ? `Parcours : ${challenge.progress} étape(s) correcte(s) sur ${challenge.total}.`
          : event.action ? 'Séquence terminée. Tu peux modifier les réglages ou relancer GO.'
            : `${object.label} : ${optionLabel(object, option, definition.controls[objectId])}.`;
      pointer.textContent = status.textContent;
      return;
    }
    playback?.reset();
    selected[objectId] = value;
    update(replay);
    const actual = object.options.find((item) => item.id === selected[objectId]);
    const label = optionLabel(object, actual || option, definition.controls[objectId]);
    status.textContent = `${object.label} : ${label}.${actual?.id !== option.id ? ' Réglage ajusté par les règles de l’expérience.' : ''}`;
    pointer.textContent = status.textContent;
    audio.pause();
    root.querySelector('#sim-audio-status').textContent = '';
    if (!playback && root.querySelector('#sim-sound').checked && option.audio) {
      audio.src = option.audio;
      audio.play().catch(() => {
        if (root.isConnected) root.querySelector('#sim-audio-status').textContent = 'La voix n’a pas pu être lue.';
      });
    }
    if (playback && objectId === '9' && value === 2) playback.start(currentData, selected);
  }

  function reset() {
    generation++;
    sequencePlayer?.reset();
    cinema?.reset();
    busy = false;
    animation = null;
    playback?.reset();
    audio.pause();
    closePanel(false);
    currentCase = data.cases.find((item) => item.id === root.querySelector('#sim-case').value);
    currentData = caseData(data, currentCase);
    controls = activeControls(currentData, definition, currentCase);
    selected = Object.fromEntries(currentData.objects.filter((object) => object.options.length)
      .map((object) => [object.id, currentCase.initial[object.id] || object.options[0].id]));
    if (sequencePlayer) {
      session = createSimulationState(data, currentCase);
      selected = session.snapshot().states;
      displayed = { ...selected };
      paintOrder = [...currentData.objects].sort((a, b) => a.plan - b.plan).map((o) => o.id);
    }
    renderControls();
    update();
    root.querySelector('#sim-audio-status').textContent = '';
    pointer.textContent = 'Survole une commande pour connaître son rôle.';
  }

  frame.addEventListener('click', (event) => {
    const button = event.target.closest('[data-target]');
    if (!button) {
      if (!panel.contains(event.target)) closePanel(false);
      return;
    }
    const target = targets[button.dataset.target];
    closePanel(false);
    if (target.action === 'panel') openPanel(target.object, button);
    else {
      const object = controls.find((item) => item.id === target.object);
      set(target.object, targetState(target, object, selected), target.action === 'action');
    }
  });
  for (const name of ['pointerover', 'focusin']) frame.addEventListener(name, (event) => {
    const target = event.target.closest('[data-target]');
    if (target) pointer.textContent = targets[target.dataset.target].label;
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closePanel();
    const choice = event.target.closest('[data-choice]');
    if (choice) { set(panel.dataset.object, Number(choice.dataset.choice)); closePanel(); }
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); closePanel(); }
  });
  root.querySelector('.simulation-controls').addEventListener('change', (event) => {
    if (event.target.matches('[data-input]')) set(event.target.dataset.input, Number(event.target.value));
  });
  root.querySelector('.simulation-extra').addEventListener('click', (event) => {
    const objectId = event.target.closest('[data-clear]')?.dataset.clear;
    if (objectId) set(objectId, definition.controls[objectId].clearState);
  });
  root.querySelector('#sim-zones').onchange = (event) => frame.classList.toggle('show-targets', event.target.checked);
  root.querySelector('#sim-sound').onchange = () => { audio.pause(); cinema?.updateSound(); };
  root.querySelector('#sim-case').onchange = () => {
    reset(); status.textContent = 'Nouvelle situation : règle les commandes dans le décor.';
  };
  root.querySelector('#sim-reset').onclick = () => {
    reset(); status.textContent = 'Réglages remis au départ.';
  };
  root.querySelector('#sim-form').onsubmit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (playback && !playback.complete) {
      status.textContent = playback.busy ? 'La fabrication est en cours…' : 'Lance Power pour fabriquer le laitage avant de vérifier le défi.';
      return;
    }
    const result = update();
    const known = Object.fromEntries(result.resolved.map((key) => [key, result.states[key]]));
    const solutions = currentCase.solutions.map((solution) => Object.fromEntries(
      Object.entries(solution).filter(([key]) => controls.some((object) => object.id === key))));
    status.textContent = currentCase.id === '0'
      ? 'Tu es en exploration libre. Choisis un défi pour vérifier une solution.'
      : (session ? session.challenge().success : checkChallenge(solutions, known))
        ? 'Bravo ! Tes réglages correspondent à une solution originale.'
        : 'Cette combinaison ne valide pas le défi. Consulte les conseils et essaie d’autres réglages.';
  };
  main.addEventListener('sceneleave', () => {
    generation++;
    sequencePlayer?.dispose();
    cinema?.dispose();
    playback?.dispose(); audio.pause(); audio.removeAttribute('src');
  }, { once: true });
  reset();
}
