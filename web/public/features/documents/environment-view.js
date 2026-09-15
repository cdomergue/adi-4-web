import { escapeHtml as esc } from '../../shared/text.js';
import { spriteFrame, clipDuration } from './environment-animation.js';

const position = ([x, y, w, h]) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;

export async function renderEnvironment(main, config) {
  const {
    createInitial,
    reconstruct,
    availableOptions,
    changeInput,
    transitionSteps,
    matchesCase,
    scenePoint,
    hitTest,
  } = config.engine;
  const base = `/game/documents/${config.folder}/`;
  const prefix = config.program;
  document.title = `${config.title} · ADI 4`;
  main.innerHTML = `<section class="original-scene environment-document"><div class="scene-heading"><h1>${esc(config.title)}</h1><a class="button secondary" href="#documents">← Les documents</a></div><p role="status">Ouverture du document…</p></section>`;
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
    pendingOption = null,
    mode = 'discover',
    caseIndex = 0,
    busy = false;
  let explanation = null,
    explanationQueue = [],
    ambientReaction = null,
    nextReaction = 0;
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
    if (Array.isArray(src)) return Promise.all(src.map(image));
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
    const inputCount = data.inputCount ?? 4;
    const atmosphere = config.createAtmosphere?.(assets);
    const markers = [
      ...data.markers.map((box, element) => ({ box, element })),
      ...(data.extraMarkers || []),
    ];
    const background = await image(assets.ui['30000'].colorSrc);
    await Promise.all(Object.values(assets.objects).flat().map(image));
    await Promise.all(
      Object.values(assets.reverseObjects || {})
        .flat()
        .map(image),
    );
    await Promise.all(Object.values(assets.idleObjects || {}).map(image));
    await Promise.all(Object.values(assets.explanations || {}).map(image));
    await Promise.all(Object.values(assets.ambientReactions || {}).map(image));
    await Promise.all(Object.values(assets.foregroundObjects || {}).map(image));
    if (leaving) return;
    state = createInitial(data);
    displayed = [...state.states];
    root.querySelector('[role=status]').remove();
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="environment-actions"><label><input type="checkbox" data-sound checked> Son</label><button data-action="intro">Présentation</button><button data-action="modes">Mode d’étude</button><button data-action="understand">Comprendre</button><button data-action="reset">Recommencer</button><button data-action="stop">Arrêter</button><button data-action="fullscreen">Plein écran</button></div>
      <div class="environment-frame"><div class="environment-stage" tabindex="0" aria-label="${esc(config.title)}, décor interactif"><canvas width="640" height="480" aria-label="${esc(config.sceneDescription)}"></canvas><div class="environment-title"></div><div class="environment-markers" style="--environment-help:url('${base + assets.ui['30001'].colorSrc}')">${markers.map(({ box, element: i }) => (box[2] > 0 && box[3] > 0 ? `<button data-element="${i}" style="${position(box)}" aria-label="${esc(data.labels[i])}" title="${esc(data.labels[i])}">↔</button>` : '')).join('')}</div>
      <div class="environment-popup" style="background-image:url('${base + assets.nativeUi.choicePanel.colorSrc}')" role="dialog" aria-label="Choix du réglage" hidden></div>
      <div class="environment-bottom-edge"></div><nav class="environment-bottom" style="background-image:url('${base + assets.nativeUi.bottomBar.src}')" aria-label="Commandes du document">${[
        ['BAFLE', 'sound', 'Son', 44, 132],
        ['INTERO', 'understand', 'Comprendre', 183, 132],
        ['ICOMODE', 'modes', 'Mode d’étude', 335, 113],
        ['PORTE', 'exit', 'Quitter', 474, 113],
      ]
        .map(([name, action, label, x, w]) => {
          const clip = assets.nativeUi.bottomControls[name];
          const icon = `<span class="environment-bar-icon" style="left:${clip.origin[0] - x}px;width:${clip.width}px;height:${clip.height}px;background-image:url('${base + clip.src}');--frames:${clip.frames};--sheet-end:-${clip.frames * clip.height}px;--duration:${clip.frames / clip.fps}s"></span>`;
          return action === 'exit'
            ? `<a href="#documents" style="left:${x}px;width:${w}px" aria-label="${label}" title="${label}">${icon}</a>`
            : `<button data-action="${action}" style="left:${x}px;width:${w}px" aria-label="${label}" title="${label}">${icon}</button>`;
        })
        .join('')}</nav>
      </div></div><p class="environment-status" role="status"></p><div class="environment-case" hidden></div>
      <div class="environment-relations" hidden><button data-action="relations">${esc(config.relationsLabel || 'Rejouer les liens de l’écosystème')}</button></div>
      <details class="environment-values"><summary>Réglages et résultats</summary><div></div></details>
      <dialog class="environment-dialog" aria-labelledby="environment-dialog-title"><div class="dialog-heading"><h2 id="environment-dialog-title"></h2><button data-close aria-label="Fermer">×</button></div><div class="environment-dialog-body"></div></dialog>`,
    );
    const stage = root.querySelector('.environment-stage'),
      frame = root.querySelector('.environment-frame'),
      canvas = root.querySelector('canvas'),
      ctx = canvas.getContext('2d'),
      popup = root.querySelector('.environment-popup'),
      status = root.querySelector('.environment-status'),
      dialog = root.querySelector('dialog');
    popup.classList.toggle('environment-confirm-choice', Boolean(config.confirmChoices));
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
      stopExplanation();
      stopVoice();
      stopEffects();
      focusBeforeDialog = document.activeElement;
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('.environment-dialog-body').innerHTML = content;
      if (!dialog.open) dialog.showModal();
    }
    on(dialog.querySelector('[data-close]'), 'click', closeDialog);
    on(dialog, 'cancel', (e) => {
      e.preventDefault();
      closeDialog();
    });
    function closePopup() {
      if (selected !== null) status.textContent = config.summary(data, state);
      popup.hidden = true;
      selected = null;
      pendingOption = null;
    }
    function summary() {
      stage.classList.toggle('environment-understand', mode === 'understand');
      root
        .querySelectorAll('[data-action=understand]')
        .forEach((button) => button.setAttribute('aria-pressed', String(mode === 'understand')));
      root.querySelector('.environment-title').textContent =
        mode === 'reconstruct'
          ? data.cases[caseIndex].title
          : mode === 'understand'
            ? `COMPRENDRE : ${config.title.toLocaleUpperCase('fr')}`
            : `${config.title.toLocaleUpperCase('fr')} — Mode Découvrir`;
      root.querySelector('.environment-values div').innerHTML = data.labels
        .map(
          (label, i) =>
            `<p><button data-element="${i}">${esc(label)}</button> : <strong>${esc(data.options[i][state.states[i]])}</strong></p>`,
        )
        .join('');
      const task = root.querySelector('.environment-case');
      root.querySelector('.environment-relations').hidden =
        mode !== 'understand' || !assets.explanations;
      task.hidden = mode !== 'reconstruct';
      task.innerHTML = `<h2>${esc(data.cases[caseIndex].title)}</h2><p>${esc(data.cases[caseIndex].text)}</p><button data-action="validate">Valider</button><button data-action="solution">Voir la solution</button><button data-action="cases">Choisir une situation</button>`;
    }
    function explain(i) {
      const example = data.cases[caseIndex];
      const text =
        mode === 'reconstruct' && i < inputCount ? example.hints[i] : data.explanations[i];
      showDialog(
        data.labels[i],
        `<p>${esc(text)}</p><p><strong>${esc(data.options[i][state.states[i]])}</strong></p>`,
      );
    }
    function openElement(i) {
      if (busy) return;
      if (i >= inputCount || mode === 'understand') {
        explain(i);
        return;
      }
      selected = i;
      pendingOption = state.states[i];
      popup.hidden = false;
      popup.innerHTML = `<h2>${esc(data.labels[i])}</h2><div class="environment-options">${availableOptions(
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
        )}</div><div class="environment-popup-actions">${config.confirmChoices ? '<button data-action="apply-choice" aria-label="Valider le réglage">Valider</button>' : ''}<button data-action="explain">Explication</button><button data-action="close-popup">Fermer</button></div>`;
      popup.querySelector('[aria-pressed=true]')?.focus();
      status.textContent = `${data.labels[i]} : ${data.options[i][state.states[i]]}. Choisis un réglage.`;
    }
    function finish() {
      steps = [];
      activeStep = null;
      displayed = [...state.states];
      busy = false;
      atmosphere?.reset();
      stage.removeAttribute('aria-busy');
      summary();
      status.textContent = config.summary(data, state);
    }
    function update(next, changed = null) {
      closePopup();
      stopExplanation();
      ambientReaction = null;
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
      effect('transition', activeStep.resource);
      status.textContent = `${data.labels[element]} : ${data.options[element][activeStep.state]}`;
    }
    function paint(clip, n) {
      if (!clip?.src) return;
      const frame = spriteFrame(clip, n);
      const img = loaded.get(frame.src);
      if (!img) return;
      const [x, y] = clip.origin;
      ctx.drawImage(img, 0, frame.y, clip.width, clip.height, x, y, clip.width, clip.height);
    }
    function stopExplanation() {
      explanation = null;
      explanationQueue = [];
    }
    function nextExplanation(now) {
      const resource = explanationQueue.shift();
      explanation = resource ? { resource, started: now } : null;
      if (resource) play(resource);
    }
    function explainRelations(index = null) {
      if (!assets.explanations) return;
      closePopup();
      stopVoice();
      finish();
      const clips = Object.values(assets.explanations);
      explanationQueue = index === null ? clips : [clips[index]];
      nextExplanation(performance.now());
      status.textContent =
        config.relationsHelp ||
        'Les flèches montrent les liens entre les activités humaines, les animaux et la végétation.';
    }
    function draw(now) {
      if (leaving) return;
      animation = requestAnimationFrame(draw);
      if (now - lastDraw < 1000 / 12) return;
      lastDraw = now - ((now - lastDraw) % (1000 / 12));
      if (
        busy &&
        (!activeStep ||
          now - started >=
            Math.max(180, (activeStep.resource.frames * 1000) / activeStep.resource.fps))
      )
        nextStep(now);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(background, 0, 0);
      const atmosphericFrame =
        !busy && motion && !dialog.open && !explanation && mode !== 'understand'
          ? atmosphere?.tick()
          : null;
      const layers = [];
      const layer = (clip, n, priority) => layers.push({ clip, n, priority });
      for (const i of config.renderOrder || data.renderOrder) {
        const clip =
          activeStep?.element === i ? activeStep.resource : assets.objects[i][displayed[i]];

        const n =
          activeStep?.element === i
            ? Math.min(clip.frames - 1, Math.floor(((now - started) * clip.fps) / 1000))
            : clip.frames - 1;
        layer(clip, n, data.priorities?.objects[i] ?? layers.length);
        const idle = assets.idleObjects[`${prefix}_${i}S${String(displayed[i]).padStart(2, '0')}`];
        if (
          !busy &&
          motion &&
          idle?.src &&
          !dialog.open &&
          !explanation &&
          (data.idleEnabled?.[i] ?? true)
        ) {
          const duration = (idle.frames * 1000) / idle.fps;
          const rest = config.idleRest?.[i] ?? 0;
          const elapsed = atmosphere
              ? (((atmosphericFrame?.idleFrame ?? 0) % idle.frames) * 1000) / idle.fps
              : (now + i * 1100) % (duration + rest),
            cycle = atmosphere
              ? Math.floor((atmosphericFrame?.idleFrame ?? 0) / idle.frames)
              : Math.floor((now + i * 1100) / (duration + rest));
          if (elapsed < duration) {
            layer(
              idle,
              Math.min(idle.frames - 1, Math.floor((elapsed * idle.fps) / 1000)),
              data.priorities?.idle[i] ?? layers.length,
            );
            const key = `${i}:${displayed[i]}`;
            if (idleCycles.get(key) !== cycle) {
              idleCycles.set(key, cycle);
              effect(i, idle);
            }
          }
        }
      }
      for (const clip of Object.values(assets.foregroundObjects || {}))
        layer(clip, clip.frames - 1, data.priorities?.foreground ?? layers.length);
      if (explanation) {
        const { resource, started } = explanation;
        const n = Math.floor(((now - started) * resource.fps) / 1000);
        if (now - started >= clipDuration(resource) && (!player || player.ended || player.paused))
          nextExplanation(now);
        else layer(resource, n, 1000);
      }
      const reactions = Object.values(assets.ambientReactions || {});
      if (
        !busy &&
        motion &&
        !dialog.open &&
        !explanation &&
        mode !== 'understand' &&
        reactions.length &&
        !atmosphere
      ) {
        if (!nextReaction) nextReaction = now + 18000;
        if (!ambientReaction && now >= nextReaction) {
          const resource = reactions[Math.floor(Math.random() * reactions.length)];
          ambientReaction = { resource, started: now };
          effect('ambient-reaction', resource);
        }
        if (ambientReaction) {
          const { resource, started } = ambientReaction;
          const n = Math.floor(((now - started) * resource.fps) / 1000);
          if (n < resource.frames)
            layer(
              resource,
              n,
              data.priorities?.ambient[reactions.indexOf(resource)] ?? layers.length,
            );
          else {
            ambientReaction = null;
            nextReaction = now + 18000;
          }
        }
      }
      if (atmosphericFrame?.ambient) {
        const { resource, frame } = atmosphericFrame.ambient;
        layer(resource, frame, data.priorities.ambient[reactions.indexOf(resource)]);
        if (frame === 0) effect('ambient-reaction', resource);
      }
      layers.sort((a, b) => a.priority - b.priority);
      for (const { clip, n } of layers) paint(clip, n);
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
              `<button class="environment-case-choice" data-case="${i}">${esc(example.title)}</button>`,
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
        if (config.confirmChoices) {
          pendingOption = option;
          popup
            .querySelectorAll('[data-option]')
            .forEach((button) =>
              button.setAttribute('aria-pressed', String(Number(button.dataset.option) === option)),
            );
          status.textContent = `${data.options[i][option]}. Valide le réglage pour l’appliquer.`;
          return;
        }
        update(changeInput(data, state, i, option), i);
        effect('choice', assets.audioEffects[data.effectNames[i][option]]);
        return;
      }
      if (el.hasAttribute('data-case')) {
        caseIndex = Number(el.dataset.case);
        mode = 'reconstruct';
        closeDialog();
        summary();
        const name = `${prefix}_${String(caseIndex).padStart(2, '0')}RQ`;
        play(assets.caseAudio?.[name] || assets.presentations?.[name]);
        return;
      }
      const action = el.dataset.action;
      if (action === 'apply-choice' && selected !== null) {
        const i = selected,
          option = pendingOption;
        update(changeInput(data, state, i, option), i);
        effect('choice', assets.audioEffects[data.effectNames[i][option]]);
      }
      if (action === 'close-popup') closePopup();
      if (action === 'explain' && selected !== null) explain(selected);
      if (action === 'intro') {
        showDialog(config.title, `<p>${esc(data.introduction)}</p>`);
        play(assets.voice[`${prefix}_VO`]);
      }
      if (action === 'modes')
        showDialog(
          'Choisis ton mode d’étude',
          '<button data-action="discover">Découvrir</button><button data-action="cases">Reconstituer</button><button data-action="understand">Comprendre la simulation</button>',
        );
      if (action === 'cases') cases();
      if (action === 'discover') {
        mode = 'discover';
        stopExplanation();
        closeDialog();
        summary();
      }
      if (action === 'understand') {
        mode = mode === 'understand' ? 'discover' : 'understand';
        stopExplanation();
        closeDialog();
        summary();
        status.textContent =
          mode === 'understand'
            ? 'Clique sur un élément pour lire son explication. Clique à nouveau sur Comprendre pour modifier les réglages.'
            : 'Clique dans le décor pour modifier un réglage.';
        if (mode === 'understand') explainRelations();
      }
      if (action === 'relations') explainRelations();
      if (action === 'reset') {
        mode = 'discover';
        finish();
        update(createInitial(data));
      }
      if (action === 'stop') {
        stopExplanation();
        ambientReaction = null;
        stopVoice();
        stopEffects();
        ambience?.pause();
        motion = false;
        finish();
      }
      if (action === 'sound') toggleSound();
      if (action === 'solution') {
        finish();
        update(reconstruct(data, state, data.cases[caseIndex]));
      }
      if (action === 'validate') {
        const success = matchesCase(state, data.cases[caseIndex]);
        status.textContent = success
          ? 'Bravo ! Tu as reconstitué cette situation.'
          : 'Il reste des réglages à corriger. Les explications des éléments peuvent t’aider.';
        if (success) {
          const name = `${prefix}_${String(caseIndex).padStart(2, '0')}BR`;
          play(assets.feedback?.[name] || assets.presentations?.[name]);
        }
      }
      if (action === 'fullscreen') frame.requestFullscreen?.().catch(() => {});
    });
    on(canvas, 'click', (event) => {
      const { x, y } = scenePoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
      if (mode === 'understand' && data.explanationZones) {
        const index = data.explanationZones.findIndex(
          ([left, top, w, h]) => x >= left && x < left + w && y >= top && y < top + h,
        );
        if (index !== -1) return explainRelations(index);
      }
      const i = hitTest(data, x, y);
      if (i !== null) openElement(i);
    });
    on(canvas, 'pointermove', (event) => {
      const { x, y } = scenePoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
      const explanationHit =
        mode === 'understand' &&
        data.explanationZones?.some(
          ([left, top, width, height]) =>
            x >= left && x < left + width && y >= top && y < top + height,
        );
      canvas.style.cursor = explanationHit || hitTest(data, x, y) !== null ? 'pointer' : 'default';
    });
    on(stage, 'keydown', (event) => {
      if (event.key === 'Escape') {
        closePopup();
        stopExplanation();
        stopVoice();
      }
    });
    const unlockAudio = () => {
      unlocked = true;
      if (sound && motion) ambience?.play().catch(() => {});
    };
    on(root, 'pointerdown', unlockAudio);
    on(root, 'keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') unlockAudio();
    });
    if (assets.ambience?.[config.ambience]?.audio) {
      ambience = new Audio(base + assets.ambience[config.ambience].audio);
      ambience.hidden = true;
      root.append(ambience);
      ambience.loop = true;
      ambience.volume = 0.2;
    }
    summary();
    status.textContent = config.help;
    animation = requestAnimationFrame(draw);
  } catch (error) {
    if (leaving || error.name === 'AbortError') return;
    dispose();
    root.innerHTML =
      '<h1>Le document ne peut pas être ouvert.</h1><p>Recharge la page pour réessayer.</p><a href="#documents">Les documents</a>';
  }
}
