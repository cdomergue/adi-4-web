import { matchSolution, greenhouseGrowth } from './greenhouse-rules.js';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const position = ([x, y, w, h]) =>
  `left:${x / 6.4}%;top:${y / 4.8}%;width:${w / 6.4}%;height:${h / 4.8}%`;
export async function renderGreenhouse(main) {
  document.title = 'La serre · ADI 4';
  main.innerHTML = '<section id="greenhouse"><p role="status">Ouverture de la serre…</p></section>';
  const root = main.querySelector('#greenhouse');
  let data, visuals;
  try {
    const response = await fetch('/game/greenhouse/data.json');
    if (!response.ok) throw new Error('missing data');
    data = await response.json();
    const art = await fetch('/game/greenhouse/visuals.json');
    if (!art.ok) throw new Error('missing layers');
    visuals = await art.json();
    const shared = await fetch('/game/station/assets.json');
    if (shared.ok) {
      const assets = await shared.json();
      for (const name of Object.keys(visuals.assets))
        if (assets[name]) visuals.assets[name] = assets[name];
    }
  } catch {
    if (root.isConnected)
      root.innerHTML =
        '<p>Les ressources de la serre sont indisponibles.</p><a href="#scene/farm">Retour à l’aire de culture</a>';
    return;
  }
  if (!root.isConnected) return;
  let values = Object.fromEntries(data.controls.map((c) => [c.id, 1]));
  root.innerHTML = `<div class="scene-heading"><a href="#scene/farm" class="back-link">← Aire de culture</a><h1>La serre</h1><a href="#science" class="back-link">Les cours →</a></div>
    <p>Règle l’eau, la température, la lumière, le dioxyde de carbone et les sels minéraux pour relever un défi.</p>
    <div class="greenhouse-toolbar"><label>Défi <select id="greenhouse-case">${data.cases.map((c) => `<option value="${c.id}">${escape(c.label)}</option>`).join('')}</select></label><label><input id="greenhouse-sound" type="checkbox"> Voix d’Adi lors des réglages</label><button class="button secondary" id="greenhouse-reset">Recommencer</button></div>
    <div class="scene-frame greenhouse-frame"><img src="/game/scenes/greenhouse.webp" width="640" height="480" alt="Les commandes de la serre, décor original">${data.controls.flatMap((c) => c.options.map((o) => `<button class="scene-hotspot" data-control="${c.id}" data-state="${o.id}" aria-label="${escape(c.label + ' : ' + o.label)}" title="${escape(o.label)}" style="${position(o.box)}"><span>${escape(o.label)}</span></button>`)).join('')}</div>
    <form class="greenhouse-controls">${data.controls.map((c) => `<label>${escape(c.label)}<select data-setting="${c.id}" aria-label="${escape(c.label)}">${c.options.map((o) => `<option value="${o.id}">${escape(o.label)}</option>`).join('')}</select></label>`).join('')}<button class="button primary" type="submit">Vérifier mes réglages</button></form>
    <p id="greenhouse-result" role="status" aria-live="polite">Choisis tes réglages, puis vérifie-les.</p>
    <details><summary>Les conseils d’Adi</summary><div id="greenhouse-hints"></div></details>
    <audio preload="none"></audio><p id="greenhouse-audio-status" role="status"></p>
    <p class="development-note">Commandes, croissance et animations issues du jeu original. Les séquences et leur synchronisation restent en cours de vérification.</p>`;
  const audio = root.querySelector('audio');
  const result = root.querySelector('#greenhouse-result');
  const currentCase = () =>
    data.cases.find((c) => c.id === root.querySelector('#greenhouse-case').value);
  function update() {
    const growth = greenhouseGrowth(values);
    const states = {
      ...values,
      6: values['3'],
      7: growth['7'] + 1,
      8: growth['8'] + 1,
      9: growth['9'] + 1,
    };
    const frame = root.querySelector('.greenhouse-frame');
    // PLANOB from OBJS: lighting 101, controls/plants 102, mushrooms 104.
    for (const id of ['6', '1', '2', '3', '4', '5', '7', '8', '9']) {
      const asset = visuals.assets[visuals.states[id]?.[states[id]]];
      if (!asset) continue;
      let img = frame.querySelector(`[data-layer="${id}"]`);
      const existed = Boolean(img);
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        img.className = 'greenhouse-layer';
        img.dataset.layer = id;
        frame.append(img);
      }
      if (img.dataset.asset !== asset.url) {
        img.src = existed && asset.motion ? asset.motion : asset.url;
        img.dataset.asset = asset.url;
      }
      img.style.cssText = position([asset.x, asset.y, asset.width, asset.height]);
    }
    root
      .querySelectorAll('[data-control]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(values[button.dataset.control] === Number(button.dataset.state)),
        ),
      );
    root
      .querySelectorAll('[data-setting]')
      .forEach((select) => (select.value = values[select.dataset.setting]));
    root.querySelector('#greenhouse-hints').innerHTML = data.controls
      .map((c) => `<p>${escape(c.hints[currentCase().id] || c.hints['0'] || '')}</p>`)
      .join('');
  }
  function set(id, value) {
    values[id] = value;
    update();
    result.textContent = 'Réglages modifiés. Tu peux les vérifier.';
    audio.pause();
    root.querySelector('#greenhouse-audio-status').textContent = '';
    const option = data.controls.find((c) => c.id === id).options.find((o) => o.id === value);
    if (root.querySelector('#greenhouse-sound').checked && option.audio) {
      audio.src = option.audio;
      audio.play().catch(() => {
        if (root.isConnected)
          root.querySelector('#greenhouse-audio-status').textContent =
            'La voix n’a pas pu être lue.';
      });
    }
  }
  root
    .querySelectorAll('[data-control]')
    .forEach((b) => (b.onclick = () => set(b.dataset.control, Number(b.dataset.state))));
  root
    .querySelectorAll('[data-setting]')
    .forEach((s) => (s.onchange = () => set(s.dataset.setting, Number(s.value))));
  root.querySelector('#greenhouse-case').onchange = () => {
    audio.pause();
    update();
    result.textContent = 'Nouveau défi : ajuste tes réglages.';
  };
  root.querySelector('#greenhouse-sound').onchange = () => audio.pause();
  root.querySelector('#greenhouse-reset').onclick = () => {
    audio.pause();
    values = Object.fromEntries(data.controls.map((c) => [c.id, 1]));
    update();
    result.textContent = 'Réglages remis au départ.';
  };
  root.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    result.textContent = matchSolution(currentCase().solutions, values)
      ? 'Bravo ! Ces réglages correspondent à une solution du défi.'
      : 'Pas encore : consulte les conseils d’Adi et essaie une autre combinaison.';
  };
  update();
}
