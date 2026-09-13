import { calculateSimulation, checkChallenge } from './simulation-engine.js';
import {
  activeControls, caseData, optionLabel, position, sceneTargets, targetState, usefulLabel,
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
  let data, assets;
  try {
    [data, assets] = await Promise.all([
      get(`/game/station/sim-${definition.id}.json`), get('/game/station/assets.json'),
    ]);
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
  const playback = definition.createPlayback?.({
    frame, audio, changed: () => update(),
    announce: (message) => { status.textContent = message; pointer.textContent = message; },
    powerOff: () => { selected['9'] = 1; },
    soundEnabled: () => root.querySelector('#sim-sound').checked,
  });

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
      <div class="simulation-options">${object.options.map((option) => `<button type="button" data-choice="${option.id}" aria-pressed="${selected[objectId] === option.id}">${esc(optionLabel(object, option, config))}</button>`).join('')}</div>`;
    // Position relative to the object but keep the full panel inside the scene.
    const [x, y, width] = config.panelBox || object.box;
    panel.style.left = `${x > 320 ? Math.max(2, x / 6.4 - 42) : Math.min(54, (x + width) / 6.4 + 1)}%`;
    panel.style.top = `${Math.min(48, Math.max(2, y / 4.8))}%`;
    panel.hidden = false;
    panel.querySelector('[data-choice][aria-pressed="true"]')?.focus({ preventScroll: true });
  }

  function renderControls() {
    targets = sceneTargets(currentData, definition, currentCase);
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
    const result = (definition.calculate || calculateSimulation)(currentData, selected);
    Object.assign(selected, result.states);
    const layers = root.querySelector('.simulation-layers');
    const keep = new Set();
    function add(asset, key, isBackground = false, state) {
      if (!asset) return;
      keep.add(key);
      let img = layers.querySelector(`[data-layer="${key}"]`);
      const animate = !playback && !isBackground && (Boolean(img) || replay);
      if (replay && animate && img) { img.remove(); img = null; }
      if (!img) {
        img = document.createElement('img');
        img.dataset.layer = key;
        img.alt = '';
      }
      if (img.dataset.asset !== asset.url) {
        img.src = animate && asset.motion ? asset.motion : asset.url;
        img.dataset.asset = asset.url;
      }
      if (state) img.dataset.state = state;
      img.style.cssText = isBackground
        ? 'position:absolute;inset:0;width:100%;height:100%'
        : `position:absolute;${position([asset.x, asset.y, asset.width, asset.height])}`;
      layers.append(img);
    }
    add(assets[data.background], 'background', true);
    for (const object of [...currentData.objects].sort((a, b) => a.plan - b.plan)) {
      if (playback && object.type === 1) continue;
      if (definition.isVisible && !definition.isVisible(object, currentCase)) continue;
      if (object.type === 1 && !result.resolved.includes(object.id)) continue;
      const option = object.options.find((item) => item.id === result.states[object.id]);
      add(assets[option?.visual], object.id, false, option?.id);
    }
    layers.querySelectorAll('[data-layer]').forEach((img) => {
      if (!keep.has(img.dataset.layer)) img.remove();
    });
    root.querySelectorAll('[data-input]').forEach((input) => {
      input.value = selected[input.dataset.input];
      input.disabled = Boolean(playback?.busy && input.dataset.input !== '9');
    });
    root.querySelectorAll('[data-target]').forEach((button) => {
      const target = targets[button.dataset.target];
      button.disabled = Boolean(playback?.busy && target.object !== '9');
      if (target.action === 'select' || target.action === 'toggle') {
        button.setAttribute('aria-pressed', String(selected[target.object] === target.state));
      }
    });
    root.querySelector('#sim-observations').innerHTML = (playback && !playback.complete ? [] : currentData.objects)
      .filter((object) => object.type === 1 && result.resolved.includes(object.id))
      .map((object) => {
        const option = object.options.find((item) => item.id === result.states[object.id]);
        return usefulLabel(option?.label) ? `<p><strong>${esc(object.label)}</strong> : ${esc(option.label)}</p>` : '';
      }).join('');
    root.querySelector('#sim-hints').innerHTML = controls
      .map((object) => object.hints[currentCase.id] || object.hints['0'])
      .filter(Boolean).map((hint) => `<p>${esc(hint)}</p>`).join('') || '<p>Aucun conseil textuel retrouvé pour cette situation.</p>';
    return result;
  }

  function set(objectId, value, replay = false) {
    if (playback?.busy && objectId !== '9') return;
    const object = controls.find((item) => item.id === objectId);
    const option = object?.options.find((item) => item.id === value);
    if (!option) return;
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
    playback?.reset();
    audio.pause();
    closePanel(false);
    currentCase = data.cases.find((item) => item.id === root.querySelector('#sim-case').value);
    currentData = caseData(data, currentCase);
    controls = activeControls(currentData, definition, currentCase);
    selected = Object.fromEntries(currentData.objects.filter((object) => object.options.length)
      .map((object) => [object.id, currentCase.initial[object.id] || object.options[0].id]));
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
  root.querySelector('#sim-sound').onchange = () => audio.pause();
  root.querySelector('#sim-case').onchange = () => {
    reset(); status.textContent = 'Nouvelle situation : règle les commandes dans le décor.';
  };
  root.querySelector('#sim-reset').onclick = () => {
    reset(); status.textContent = 'Réglages remis au départ.';
  };
  root.querySelector('#sim-form').onsubmit = (event) => {
    event.preventDefault();
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
      : checkChallenge(solutions, known)
        ? 'Bravo ! Tes réglages correspondent à une solution originale.'
        : 'Cette combinaison ne valide pas le défi. Consulte les conseils et essaie d’autres réglages.';
  };
  main.addEventListener('sceneleave', () => {
    playback?.dispose(); audio.pause(); audio.removeAttribute('src');
  }, { once: true });
  reset();
}
