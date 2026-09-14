import {
  evaluate,
  availableOptions,
  changeInput,
  transitionSteps,
  matchesCase,
  scenePoint,
  hitTest,
} from './engine.js';
import { escapeHtml as esc } from '../../../shared/text.js';

const base = '/game/documents/air/';
const position = ([x, y, w, h]) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;

export async function renderAir(main) {
  document.title = 'La pollution de l’air · ADI 4';
  main.innerHTML =
    '<section class="original-scene air-document"><div class="scene-heading"><h1>La pollution de l’air</h1><a class="button secondary" href="#documents">← Les documents</a></div><p role="status">Ouverture du document…</p></section>';
  const root = main.firstElementChild,
    lifetime = new AbortController();
  let leaving = false,
    animation = 0,
    sound = true,
    player = null,
    ambience = null;
  let state,
    displayed,
    activeStep = null,
    steps = [],
    started = 0,
    selected = null,
    mode = 'discover',
    caseIndex = 0,
    busy = false;
  const images = new Map(),
    effectPlayers = new Map(),
    idleCycles = new Map();
  let motion = true,
    unlocked = false,
    lastDraw = 0;
  const stopVoice = () => {
    if (player) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.remove();
      player = null;
    }
  };
  function stopEffects() {
    for (const audio of effectPlayers.values()) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.remove();
    }
    effectPlayers.clear();
  }
  function effect(key, resource) {
    if (
      !sound ||
      !unlocked ||
      !resource?.audio ||
      leaving ||
      (player && !player.paused && !player.ended)
    )
      return;
    effectPlayers.get(key)?.pause();
    effectPlayers.get(key)?.remove();
    const audio = new Audio(base + resource.audio);
    audio.hidden = true;
    root.append(audio);
    effectPlayers.set(key, audio);
    audio.addEventListener(
      'ended',
      () => {
        if (effectPlayers.get(key) === audio) effectPlayers.delete(key);
        audio.remove();
      },
      { once: true },
    );
    audio.play().catch(() => {});
  }
  function dispose() {
    leaving = true;
    lifetime.abort();
    cancelAnimationFrame(animation);
    stopVoice();
    stopEffects();
    if (ambience) {
      ambience.pause();
      ambience.removeAttribute('src');
      ambience.load();
    }
  }
  main.addEventListener('sceneleave', dispose, { once: true });
  const on = (el, type, callback) =>
    el.addEventListener(type, callback, { signal: lifetime.signal });
  async function json(file) {
    const response = await fetch(base + file, { signal: lifetime.signal });
    if (!response.ok) throw new Error('Une ressource du document est indisponible.');
    return response.json();
  }
  async function image(resource) {
    const src = typeof resource === 'string' ? resource : resource?.src;
    if (!src) return null;
    if (!images.has(src))
      images.set(
        src,
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Image indisponible.'));
          img.src = base + src;
        }),
      );
    return images.get(src);
  }
  function play(resource) {
    stopVoice();
    stopEffects();
    if (!sound || !resource?.audio || leaving) return;
    player = new Audio(base + resource.audio);
    player.hidden = true;
    root.append(player);
    player.play().catch(() => {});
  }
  try {
    const [data, assets] = await Promise.all([json('rules.json'), json('assets.json')]);
    const background = await image(assets.ui['30000'].colorSrc);
    await Promise.all(Object.values(assets.objects).flat().map(image));
    await Promise.all(
      Object.values(assets.reverseObjects || {})
        .flat()
        .map(image),
    );
    await Promise.all(Object.values(assets.idleObjects || {}).map(image));
    if (leaving) return;
    state = evaluate(data, data.defaultInputs);
    displayed = [...state.states];
    root.querySelector('[role=status]').remove();
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="air-actions"><label><input type="checkbox" data-sound checked> Son</label><button data-action="intro">Présentation</button><button data-action="modes">Mode d’étude</button><button data-action="understand">Comprendre</button><button data-action="reset">Recommencer</button><button data-action="stop">Arrêter</button><button data-action="fullscreen">Plein écran</button></div>
      <div class="air-frame"><div class="air-stage" tabindex="0" aria-label="La pollution de l’air, décor interactif"><canvas width="640" height="480" aria-label="Ville, industries, centrale et moyens de transport"></canvas><div class="air-title"></div><div class="air-markers" style="--air-help:url('${base + assets.ui['30001'].colorSrc}')">${data.markers.map((box, i) => `<button data-element="${i}" style="${position(box)}" aria-label="${esc(data.labels[i])}" title="${esc(data.labels[i])}">↔</button>`).join('')}</div>
      <div class="air-popup" style="background-image:url('${base + assets.nativeUi.choicePanel.colorSrc}')" role="dialog" aria-label="Choix du réglage" hidden></div>
      <div class="air-bottom-edge"></div><nav class="air-bottom" style="background-image:url('${base + assets.nativeUi.bottomBar.src}')" aria-label="Commandes du document">${[
        ['BAFLE', 'sound', 'Son', 44, 132],
        ['INTERO', 'understand', 'Comprendre', 183, 132],
        ['ICOMODE', 'modes', 'Mode d’étude', 335, 113],
        ['PORTE', 'exit', 'Quitter', 474, 113],
      ]
        .map(([name, action, label, x, w]) => {
          const clip = assets.nativeUi.bottomControls[name];
          const icon = `<span class="air-bar-icon" style="left:${clip.origin[0] - x}px;width:${clip.width}px;height:${clip.height}px;background-image:url('${base + clip.src}');--frames:${clip.frames};--sheet-end:-${clip.frames * clip.height}px;--duration:${clip.frames / clip.fps}s"></span>`;
          return action === 'exit'
            ? `<a href="#documents" style="left:${x}px;width:${w}px" aria-label="${label}" title="${label}">${icon}</a>`
            : `<button data-action="${action}" style="left:${x}px;width:${w}px" aria-label="${label}" title="${label}">${icon}</button>`;
        })
        .join('')}</nav>
      </div></div><p class="air-status" role="status"></p><div class="air-case" hidden></div>
      <details class="air-values"><summary>Réglages et résultats</summary><div></div></details>
      <dialog class="air-dialog" aria-labelledby="air-dialog-title"><div class="dialog-heading"><h2 id="air-dialog-title"></h2><button data-close aria-label="Fermer">×</button></div><div class="air-dialog-body"></div></dialog>`,
    );
    const stage = root.querySelector('.air-stage'),
      frame = root.querySelector('.air-frame'),
      canvas = root.querySelector('canvas'),
      ctx = canvas.getContext('2d'),
      popup = root.querySelector('.air-popup'),
      status = root.querySelector('.air-status'),
      dialog = root.querySelector('dialog');
    const resize = new ResizeObserver(() => {
      stage.style.transform = `scale(${frame.clientWidth / 640})`;
    });
    resize.observe(frame);
    lifetime.signal.addEventListener('abort', () => resize.disconnect(), { once: true });
    let focusBeforeDialog;
    function closeDialog() {
      dialog.close();
      stopVoice();
      focusBeforeDialog?.focus();
    }
    function showDialog(title, content) {
      closePopup();
      stopVoice();
      stopEffects();
      focusBeforeDialog = document.activeElement;
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('.air-dialog-body').innerHTML = content;
      if (!dialog.open) dialog.showModal();
    }
    on(dialog.querySelector('[data-close]'), 'click', closeDialog);
    on(dialog, 'cancel', (e) => {
      e.preventDefault();
      closeDialog();
    });
    function closePopup() {
      popup.hidden = true;
      selected = null;
    }
    function summary() {
      stage.classList.toggle('air-understand', mode === 'understand');
      root
        .querySelectorAll('[data-action=understand]')
        .forEach((button) => button.setAttribute('aria-pressed', String(mode === 'understand')));
      root.querySelector('.air-title').textContent =
        mode === 'reconstruct'
          ? data.cases[caseIndex].title
          : mode === 'understand'
            ? 'COMPRENDRE LA POLLUTION DE L’AIR'
            : 'LA POLLUTION DE L’AIR — Mode Découvrir';
      root.querySelector('.air-values div').innerHTML = data.labels
        .map(
          (label, i) =>
            `<p><button data-element="${i}">${esc(label)}</button> : <strong>${esc(data.options[i][state.states[i]])}</strong></p>`,
        )
        .join('');
      const task = root.querySelector('.air-case');
      task.hidden = mode !== 'reconstruct';
      task.innerHTML = `<h2>${esc(data.cases[caseIndex].title)}</h2><p>${esc(data.cases[caseIndex].text)}</p><button data-action="validate">Valider</button><button data-action="solution">Voir la solution</button><button data-action="cases">Choisir une situation</button>`;
    }
    function explain(i) {
      const example = data.cases[caseIndex];
      const text = mode === 'reconstruct' && i < 4 ? example.hints[i] : data.explanations[i];
      showDialog(
        data.labels[i],
        `<p>${esc(text)}</p><p><strong>${esc(data.options[i][state.states[i]])}</strong></p>`,
      );
      // Element explanations are text; RE clips narrate the complete study cases.
    }
    function openElement(i) {
      if (busy) return;
      if (i >= 4 || mode === 'understand') {
        explain(i);
        return;
      }
      selected = i;
      popup.hidden = false;
      popup.innerHTML = `<h2>${esc(data.labels[i])}</h2><div class="air-options">${availableOptions(
        data,
        state,
        i,
      )
        .map(
          ({ index, enabled }) =>
            `<button data-option="${index}" ${enabled ? '' : 'disabled'} aria-pressed="${state.states[i] === index}">${esc(data.options[i][index])}</button>`,
        )
        .join(
          '',
        )}</div><div class="air-popup-actions"><button data-action="explain">Explication</button><button data-action="close-popup">Fermer</button></div>`;
      popup.querySelector('[aria-pressed=true]')?.focus();
      status.textContent = `${data.labels[i]} : ${data.options[i][state.states[i]]}. Choisis un réglage.`;
    }
    function finish() {
      steps = [];
      activeStep = null;
      displayed = [...state.states];
      busy = false;
      stage.removeAttribute('aria-busy');
      summary();
      status.textContent = `${data.options[4][state.states[4]]}. Santé des hommes : ${data.options[5][state.states[5]].toLowerCase()}.`;
    }
    function update(next, changed = null) {
      closePopup();
      stopVoice();
      stopEffects();
      motion = true;
      const previous = state;
      state = next;
      steps = transitionSteps(data, previous, next, changed);
      activeStep = null;
      busy = steps.length > 0;
      stage.setAttribute('aria-busy', String(busy));
      if (!busy) finish();
    }
    function nextStep(now) {
      if (activeStep) displayed[activeStep.element] = activeStep.state;
      activeStep = steps.shift();
      started = now;
      if (!activeStep) {
        finish();
        return;
      }
      const { element, clip, reverse } = activeStep;
      activeStep.resource = reverse
        ? assets.reverseObjects?.[element]?.[clip]
        : assets.objects[element][clip];
      activeStep.resource ||= assets.objects[element][activeStep.state];
      status.textContent = `${data.labels[element]} : ${data.options[element][activeStep.state]}`;
    }
    function paint(clip, n) {
      const img = loaded.get(clip.src);
      if (!img) return;
      const [x, y] = clip.origin;
      ctx.drawImage(
        img,
        0,
        clip.format === 'vertical-sprite-sheet' ? n * clip.height : 0,
        clip.width,
        clip.height,
        x,
        y,
        clip.width,
        clip.height,
      );
    }
    function draw(now) {
      if (leaving) return;
      animation = requestAnimationFrame(draw);
      if (now - lastDraw < 1000 / 12) return;
      lastDraw = now;
      if (
        busy &&
        (!activeStep ||
          now - started >=
            Math.max(180, (activeStep.resource.frames * 1000) / activeStep.resource.fps))
      )
        nextStep(now);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(background, 0, 0);
      for (const i of [0, 1, 2, 5, 7, 4, 6, 3]) {
        const clip =
          activeStep?.element === i ? activeStep.resource : assets.objects[i][displayed[i]];

        const n =
          activeStep?.element === i
            ? Math.min(clip.frames - 1, Math.floor(((now - started) * clip.fps) / 1000))
            : clip.frames - 1;
        paint(clip, n);
        const idle = assets.idleObjects[`S16_${i}S${String(displayed[i]).padStart(2, '0')}`];
        if (!busy && motion && idle?.src && !dialog.open) {
          const duration = (idle.frames * 1000) / idle.fps;
          const rest = [3, 5, 6].includes(i) ? 9000 : 0;
          const elapsed = (now + i * 1100) % (duration + rest),
            cycle = Math.floor((now + i * 1100) / (duration + rest));
          if (elapsed < duration) {
            paint(idle, Math.min(idle.frames - 1, Math.floor((elapsed * idle.fps) / 1000)));
            const key = `${i}:${displayed[i]}`;
            if (idleCycles.get(key) !== cycle) {
              idleCycles.set(key, cycle);
              effect(i, idle);
            }
          }
        }
      }
    }
    const loaded = new Map(
      await Promise.all([...images].map(async ([key, promise]) => [key, await promise])),
    );
    function cases() {
      showDialog(
        'Choisis ton objectif',
        data.cases
          .map(
            (example, i) =>
              `<button class="air-case-choice" data-case="${i}">${esc(example.title)}</button>`,
          )
          .join(''),
      );
    }
    function toggleSound() {
      sound = !sound;
      root.querySelector('[data-sound]').checked = sound;
      if (!sound) {
        stopVoice();
        stopEffects();
        ambience?.pause();
      } else ambience?.play().catch(() => {});
    }
    on(root.querySelector('[data-sound]'), 'change', toggleSound);
    on(root, 'click', (event) => {
      const el = event.target.closest('button');
      if (!el) return;
      if (el.hasAttribute('data-element')) return openElement(Number(el.dataset.element));
      if (el.hasAttribute('data-option') && selected !== null) {
        const i = selected,
          option = Number(el.dataset.option);
        update(changeInput(data, state, i, option), i);
        effect('choice', assets.audioEffects[data.effectNames[i][option]]);
        return;
      }
      if (el.hasAttribute('data-case')) {
        caseIndex = Number(el.dataset.case);
        mode = 'reconstruct';
        closeDialog();
        summary();
        play(assets.audio[`S16_RE${String(caseIndex + 1).padStart(2, '0')}`]);
        return;
      }
      const action = el.dataset.action;
      if (action === 'close-popup') closePopup();
      if (action === 'explain' && selected !== null) explain(selected);
      if (action === 'intro') {
        showDialog('La pollution de l’air', `<p>${esc(data.introduction)}</p>`);
        play(assets.voice.S16_VO);
      }
      if (action === 'modes')
        showDialog(
          'Choisis ton mode d’étude',
          '<button data-action="discover">Découvrir</button><button data-action="cases">Reconstituer</button><button data-action="understand">Comprendre la simulation</button>',
        );
      if (action === 'cases') cases();
      if (action === 'discover') {
        mode = 'discover';
        closeDialog();
        summary();
      }
      if (action === 'understand') {
        mode = mode === 'understand' ? 'discover' : 'understand';
        closeDialog();
        summary();
        status.textContent =
          mode === 'understand'
            ? 'Clique sur un élément pour lire son explication. Clique à nouveau sur Comprendre pour modifier les réglages.'
            : 'Clique dans le décor pour modifier un réglage.';
      }
      if (action === 'reset') {
        mode = 'discover';
        finish();
        update(evaluate(data, data.defaultInputs));
      }
      if (action === 'stop') {
        stopVoice();
        stopEffects();
        ambience?.pause();
        motion = false;
        finish();
      }
      if (action === 'sound') toggleSound();
      if (action === 'solution') {
        finish();
        update(evaluate(data, data.cases[caseIndex].inputs));
      }
      if (action === 'validate') {
        const success = matchesCase(state, data.cases[caseIndex]);
        status.textContent = success
          ? 'Bravo ! Tu as reconstitué cette situation.'
          : 'Il reste des réglages à corriger. Les explications des éléments peuvent t’aider.';
      }
      if (action === 'fullscreen') frame.requestFullscreen?.().catch(() => {});
    });
    on(canvas, 'click', (event) => {
      const { x, y } = scenePoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
      const i = hitTest(data, x, y);
      if (i !== null) openElement(i);
    });
    on(canvas, 'pointermove', (event) => {
      const { x, y } = scenePoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
      canvas.style.cursor = hitTest(data, x, y) === null ? 'default' : 'pointer';
    });
    on(stage, 'keydown', (event) => {
      if (event.key === 'Escape') {
        closePopup();
        stopVoice();
      }
    });
    on(root, 'pointerdown', () => {
      unlocked = true;
      if (sound && motion) ambience?.play().catch(() => {});
    });
    if (assets.ambience?.A_MUS16?.audio) {
      ambience = new Audio(base + assets.ambience.A_MUS16.audio);
      ambience.hidden = true;
      root.append(ambience);
      ambience.loop = true;
      ambience.volume = 0.2;
    }
    summary();
    status.textContent =
      'Clique sur le relief, les industries, la centrale ou les voitures pour modifier un réglage.';
    animation = requestAnimationFrame(draw);
  } catch (error) {
    if (leaving || error.name === 'AbortError') return;
    dispose();
    root.innerHTML =
      '<h1>Le document ne peut pas être ouvert.</h1><p>Recharge la page pour réessayer.</p><a href="#documents">Les documents</a>';
  }
}
