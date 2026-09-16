import { escapeHtml as esc } from '../../shared/text.js';
import { feedbackName } from './environment-feedback.js';
import { createEnvironmentAtmosphere } from './environment-atmosphere.js';
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
    explanationQueue = [];
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
    const [data, assets, common] = await Promise.all([
      json('rules.json'),
      json('assets.json'),
      json('../common/ui.json'),
    ]);
    const commonPath = (src) => (Array.isArray(src) ? src.map(commonPath) : `../common/${src}`);
    assets.validation = Object.fromEntries(
      Object.entries(common.validation).map(([name, clip]) => [
        name,
        {
          ...clip,
          src: clip.src ? commonPath(clip.src) : undefined,
          audio: commonPath(clip.audio),
        },
      ]),
    );
    const uiSource = (id) =>
      commonPath(common.images[id].paletteVariants?.[`${prefix}_0I00`] || common.images[id].src);
    await image(uiSource('4'));
    const borderSheet = await image(uiSource('43'));
    // Browser text stays sharp when the original 640 × 480 panels are scaled.
    const textMeasure = document.createElement('canvas').getContext('2d');
    const typeface = (font) => ({
      size: font === 'heading' ? 19 : 14,
      weight: font === 'body' ? 400 : 600,
    });
    function measureText(text, font) {
      const { size, weight } = typeface(font);
      textMeasure.font = `${weight} ${size}px Arial, sans-serif`;
      return textMeasure.measureText(text).width;
    }
    function writeText(element, text, width, font = 'label', color = 0, align = 'center', lineHeight) {
      const { size, weight } = typeface(font);
      const span = document.createElement('span');
      span.className = 'environment-text';
      span.textContent = text;
      const singleLine = element.matches('button[data-option], button[data-case]');
      const fontSize = singleLine
        ? Math.min(size, size * (width - 28) / Math.max(1, measureText(text, font)))
        : size;
      const leading = Math.max(fontSize + 2, lineHeight ?? (font === 'heading' ? 24 : 20));
      span.style.cssText = `width:${width}px;font-size:${fontSize}px;font-weight:${weight};line-height:${leading}px;text-align:${align};color:rgb(${common.palette.rgb[color].join(',')})`;
      // Keep the source line breaks; measure only additional wraps for the help frame.
      const lines = [];
      for (const paragraph of text.split('\n')) {
        let current = '';
        for (const word of paragraph.split(/\s+/)) {
          const candidate = current ? `${current} ${word}` : word;
          if (current && measureText(candidate, font) > width) {
            lines.push(current);
            current = word;
          } else current = candidate;
        }
        lines.push(current);
      }
      element.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim());
      element.replaceChildren(span);
      return { lines };
    }
    const inputCount = data.inputCount ?? 4;
    const atmosphere = createEnvironmentAtmosphere(data, assets, prefix);
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
    await Promise.all(
      Object.values(assets.validation || {})
        .filter((clip) => clip.src)
        .map(image),
    );
    if (leaving) return;
    state = createInitial(data);
    displayed = [...state.states];
    root.querySelector('[role=status]').remove();
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="environment-actions"><label><input type="checkbox" data-sound checked> Son</label><button data-action="intro">Présentation</button><button data-action="modes">Mode d’étude</button><button data-action="understand">Comprendre</button><button data-action="reset">Recommencer</button><button data-action="stop">Arrêter</button><button data-action="fullscreen">Plein écran</button></div>
      <div class="environment-frame"><div class="environment-stage" tabindex="0" aria-label="${esc(config.title)}, décor interactif"><canvas width="640" height="480" aria-label="${esc(config.sceneDescription)}"></canvas><div class="environment-top-edge"></div><div class="environment-title"></div><div class="environment-markers" style="--environment-help:url('${base + assets.ui['30001'].colorSrc}')">${markers.map(({ box, element: i }) => (box[2] > 0 && box[3] > 0 ? `<button data-element="${i}" style="${position(box)}" aria-label="${esc(data.labels[i])}" title="${esc(data.labels[i])}">↔</button>` : '')).join('')}</div>
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
    stage.append(dialog);
    popup.classList.toggle('environment-confirm-choice', Boolean(config.confirmChoices));
    const resize = new ResizeObserver(() => {
      stage.style.transform = `scale(${frame.clientWidth / 640})`;
    });
    resize.observe(frame);
    lifetime.signal.addEventListener('abort', () => resize.disconnect(), { once: true });
    let focusBeforeDialog, focusBeforePopup;
    function closeDialog() {
      if (!dialog.open) return;
      dialog.close();
      stopVoice();
      focusBeforeDialog?.focus();
    }
    function showDialog(title, content) {
      closeHelp();
      closePopup();
      stopExplanation();
      stopVoice();
      stopEffects();
      focusBeforeDialog = document.activeElement;
      dialog.className = 'environment-dialog';
      dialog.querySelector('h2').removeAttribute('aria-label');
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('.environment-dialog-body').innerHTML = content;
      if (!dialog.open) dialog.show();
      dialog.querySelector('button')?.focus();
    }
    const sheet = document.createElement('div');
    sheet.className = 'environment-dialog-sheet';
    sheet.append(...dialog.childNodes);
    dialog.append(sheet);
    dialog.style.setProperty('--control-sheet', `url("${base + uiSource('4')}")`);
    on(dialog, 'click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    on(dialog.querySelector('[data-close]'), 'click', closeDialog);
    on(dialog, 'keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
    });
    on(dialog, 'cancel', (e) => {
      e.preventDefault();
      closeDialog();
    });
    function closePopup() {
      const wasOpen = !popup.hidden;
      if (selected !== null) status.textContent = config.summary(data, state);
      popup.hidden = true;
      selected = null;
      pendingOption = null;
      if (wasOpen) (focusBeforePopup || stage).focus();
    }
    function summary() {
      stage.classList.toggle('environment-understand', mode === 'understand');
      root
        .querySelectorAll('[data-action=understand]')
        .forEach((button) => button.setAttribute('aria-pressed', String(mode === 'understand')));
      const titleText =
        mode === 'reconstruct'
          ? data.cases[caseIndex].title
          : mode === 'understand'
            ? `COMPRENDRE : ${config.title.toLocaleUpperCase('fr')}`
            : `${config.title.toLocaleUpperCase('fr')} — Mode Découvrir`;
      writeText(root.querySelector('.environment-title'), titleText, 640, 'label', 27);
      root.querySelector('.environment-title').style.backgroundImage =
        `url("${base + uiSource('8')}")`;
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
    let helpOverlay = null,
      helpFocus = null;
    function closeHelp() {
      helpOverlay?.remove();
      helpOverlay = null;
      helpFocus?.focus();
    }
    function explain(i) {
      const example = data.cases[caseIndex];
      const text =
        mode === 'reconstruct' && i < inputCount ? example.hints[i] : data.explanations[i];
      const sourceLines =
        mode === 'reconstruct' && i < inputCount
          ? data.textLayout?.hints[caseIndex][i]
          : data.textLayout?.explanations[i];
      stopVoice();
      stopEffects();
      helpFocus = document.activeElement;
      helpOverlay?.remove();
      helpOverlay = document.createElement('button');
      helpOverlay.className = 'environment-help-overlay';
      helpOverlay.setAttribute('aria-label', `${text} Fermer l’explication.`);
      const bubble = document.createElement('span');
      bubble.className = 'environment-help-bubble';
      const textElement = document.createElement('span');
      const lines = sourceLines || [text];
      const width = Math.min(
        610,
        Math.max(...lines.map((line) => measureText(line, 'body'))) + 20,
      );
      const rendered = writeText(textElement, lines.join('\n'), width - 10, 'body', 0, 'left', 20);
      const height = 16 + rendered.lines.length * 20;
      bubble.style.cssText = `left:${(640 - width) / 2}px;top:${(480 - height) / 2}px;width:${width}px;height:${height}px;background:rgb(${common.palette.rgb[i < inputCount ? 29 : 65].join(',')})`;
      const border = document.createElement('canvas');
      border.width = width + 16;
      border.height = height + 22;
      border.className = 'environment-help-border';
      const c = border.getContext('2d');
      const piece = (sx, sy, w, h, x, y) => c.drawImage(borderSheet, sx, sy, w, h, x, y, w, h);
      for (let x = 31; x < width - 31; x += 33) {
        piece(64, 0, 34, 9, x, 0);
        piece(64, 0, 34, 9, x, height + 8);
      }
      for (let y = 20; y < height; y += 19) {
        piece(0, 32, 8, 19, 0, y);
        piece(156, 30, 8, 19, width + 7, y);
      }
      piece(0, 0, 52, 21, 0, 0);
      piece(118, 0, 46, 21, width - 31, 0);
      piece(0, 65, 52, 21, 0, height - 4);
      piece(118, 65, 46, 21, width - 31, height - 4);
      bubble.append(border, textElement);
      helpOverlay.append(bubble);
      stage.append(helpOverlay);
      on(helpOverlay, 'click', closeHelp);
      helpOverlay.focus();
    }
    function paintOptions() {
      popup.querySelectorAll('[data-option]').forEach((button) => {
        const index = Number(button.dataset.option);
        const active = index === pendingOption;
        button.setAttribute('aria-pressed', String(active));
        writeText(
          button,
          data.options[selected][index],
          335,
          'label',
          button.disabled ? 74 : active ? 26 : 27,
        );
      });
    }
    function openElement(i) {
      if (busy || helpOverlay || dialog.open) return;
      if (!popup.hidden) {
        closePopup();
        return;
      }
      if (i >= inputCount || mode === 'understand') {
        explain(i);
        return;
      }
      stopEffects();
      focusBeforePopup = document.activeElement;
      selected = i;
      pendingOption = state.states[i];
      popup.hidden = false;
      popup.style.setProperty('--choice-sheet', `url("${base + uiSource('4')}")`);
      popup.innerHTML = `<h2></h2><div class="environment-options">${availableOptions(
        data,
        state,
        i,
      )
        .map(
          ({ index, enabled }) =>
            `<button data-option="${index}" ${enabled ? '' : 'disabled'}></button>`,
        )
        .join('')}</div>
        <div class="environment-popup-actions"><button data-action="apply-choice" aria-label="Valider le réglage" title="Valider"></button><button data-action="explain" aria-label="Explication" title="Explication"></button></div>`;
      writeText(popup.querySelector('h2'), data.labels[i], 335, 'heading');
      paintOptions();
      popup.querySelector('[aria-pressed=true]')?.focus();
      status.textContent = `${data.labels[i]} : ${data.options[i][state.states[i]]}. Choisis un réglage.`;
    }
    let validationCount = 0;
    function originalFeedback() {
      if (mode === 'discover') {
        const matched = data.cases.findIndex((example) => matchesCase(state, example));
        if (matched >= 0)
          play(
            (assets.caseAudio || assets.presentations)?.[
              `${prefix}_${String(matched).padStart(2, '0')}RQ`
            ],
          );
        return;
      }
      if (mode !== 'reconstruct') return;
      const resource =
        assets.validation[feedbackName(state, data.cases[caseIndex], ++validationCount)];
      if (!resource) return;
      if (resource.src) {
        stopEffects();
        explanationQueue = [resource];
        nextExplanation(performance.now());
      } else play(resource);
    }
    function finish(completed = false) {
      steps = [];
      activeStep = null;
      displayed = [...state.states];
      busy = false;
      atmosphere.reset();
      idleCycles.clear();
      stage.removeAttribute('aria-busy');
      summary();
      status.textContent = config.summary(data, state);
      if (completed) originalFeedback();
    }
    function update(next, changed = null) {
      closePopup();
      stopExplanation();
      stopVoice();
      stopEffects();
      motion = true;
      const previous = state;
      state = next;
      steps = transitionSteps(data, previous, next, changed);
      activeStep = null;
      busy = steps.length > 0;
      stage.setAttribute('aria-busy', String(busy));
      if (!busy) finish(true);
    }
    function nextStep(now) {
      if (activeStep) displayed[activeStep.element] = activeStep.state;
      activeStep = steps.shift();
      started = now;
      if (!activeStep) {
        finish(true);
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
        (!activeStep || now - started >= Math.max(180, clipDuration(activeStep.resource)))
      )
        nextStep(now);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(background, 0, 0);
      const atmosphericFrame =
        !busy &&
        motion &&
        popup.hidden &&
        !helpOverlay &&
        !dialog.open &&
        !explanation &&
        mode !== 'understand'
          ? atmosphere.tick(displayed)
          : null;
      const layers = [];
      const layer = (clip, n, priority) => layers.push({ clip, n, priority });
      for (const i of data.renderOrder) {
        const clip =
          activeStep?.element === i ? activeStep.resource : assets.objects[i][displayed[i]];

        const n =
          activeStep?.element === i
            ? Math.min(clip.frames - 1, Math.floor(((now - started) * clip.fps) / 1000))
            : clip.frames - 1;
        const idleActive =
          !busy &&
          motion &&
          popup.hidden &&
          !helpOverlay &&
          !dialog.open &&
          !explanation &&
          mode !== 'understand';
        if (!(idleActive && data.hideBaseDuringIdle?.[i] && data.idleEnabled?.[i]))
          layer(clip, n, data.priorities?.objects[i] ?? layers.length);
        const idle = assets.idleObjects[`${prefix}_${i}S${String(displayed[i]).padStart(2, '0')}`];
        if (idleActive && idle?.src && (data.idleEnabled?.[i] ?? true)) {
          const tick = atmosphericFrame?.idleFrame ?? 0;
          layer(idle, tick % idle.frames, data.priorities.idle[i]);
          const cycle = Math.floor(tick / idle.frames);
          const key = `${i}:${displayed[i]}`;
          if (idleCycles.get(key) !== cycle) {
            idleCycles.set(key, cycle);
            effect(i, idle);
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
      if (atmosphericFrame?.ambient) {
        const { resource, frame, priority } = atmosphericFrame.ambient;
        layer(resource, frame, priority);
        if (frame === 0) effect('ambient-reaction', resource);
      }
      layers.sort((a, b) => a.priority - b.priority);
      for (const { clip, n } of layers) paint(clip, n);
    }
    const loaded = new Map(
      await Promise.all([...images].map(async ([key, promise]) => [key, await promise])),
    );
    let pendingCase = 0,
      pageIndex = 0,
      pages = [];
    function panel(kind, imageId, title, content) {
      showDialog(title, content);
      dialog.classList.add(`environment-${kind}-dialog`);
      sheet.style.backgroundImage = `url("${base + uiSource(imageId)}")`;
    }
    function modePanel() {
      panel(
        'mode',
        '9',
        'Choisis ton mode d’étude',
        '<button data-action="cases"></button><button data-action="discover"></button>',
      );
      writeText(dialog.querySelector('h2'), 'Choisis ton mode d’étude', 425, 'heading');
      writeText(
        dialog.querySelector('[data-action=cases]'),
        'Reconstituer',
        285,
        'heading',
        mode === 'reconstruct' ? 26 : 27,
      );
      writeText(
        dialog.querySelector('[data-action=discover]'),
        'Découvrir',
        285,
        'heading',
        mode === 'discover' ? 26 : 27,
      );
    }
    function caseDetails() {
      dialog.querySelectorAll('[data-case]').forEach((button) => {
        const index = Number(button.dataset.case);
        button.setAttribute('aria-pressed', String(index === pendingCase));
        writeText(button, data.cases[index].title, 427, 'label', 0);
      });
      writeText(
        dialog.querySelector('.environment-case-brief'),
        data.textLayout.caseBriefs[pendingCase].join('\n'),
        382,
        'label',
        0,
        'left',
        20,
      );
    }
    function cases() {
      pendingCase = caseIndex;
      panel(
        'cases',
        '10',
        'Choisis ton objectif',
        data.cases
          .map((example, i) => `<button data-case="${i}" style="top:${45 + 25 * i}px"></button>`)
          .join('') +
          '<div class="environment-case-brief"></div><button data-action="start-case" aria-label="Reconstituer cette situation" title="Reconstituer"></button><button data-action="show-case" aria-label="Voir la situation" title="Voir la situation"></button>',
      );
      caseDetails();
    }
    function readPage() {
      writeText(
        dialog.querySelector('.environment-page-text'),
        pages[pageIndex].join('\n'),
        430,
        'body',
        0,
        'left',
        20,
      );
      dialog.querySelector('[data-action=previous-page]').disabled = pageIndex === 0;
      dialog.querySelector('[data-action=next-page]').disabled = pageIndex === pages.length - 1;
      dialog.querySelector('.environment-page-number').textContent =
        `${pageIndex + 1} / ${pages.length}`;
    }
    function presentation() {
      pages = data.textLayout.introduction;
      pageIndex = 0;
      panel(
        'presentation',
        '39',
        config.title,
        '<div class="environment-page-text"></div><button data-action="previous-page" aria-label="Page précédente">↑</button><button data-action="next-page" aria-label="Page suivante">↓</button><span class="environment-page-number"></span>',
      );
      dialog.style.setProperty('--page-arrows', `url("${base + uiSource('40')}")`);
      readPage();
      play(assets.voice[`${prefix}_VO`]);
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
          paintOptions();
          status.textContent = `${data.options[i][option]}. Valide le réglage pour l’appliquer.`;
          return;
        }
        update(changeInput(data, state, i, option), i);
        effect('choice', assets.audioEffects[data.effectNames[i][option]]);
        return;
      }
      if (el.hasAttribute('data-case')) {
        pendingCase = Number(el.dataset.case);
        caseDetails();
        return;
      }
      const action = el.dataset.action;
      if (busy && !['stop', 'sound', 'fullscreen'].includes(action)) return;
      if (action === 'apply-choice' && selected !== null) {
        const i = selected,
          option = pendingOption;
        update(changeInput(data, state, i, option), i);
        effect('choice', assets.audioEffects[data.effectNames[i][option]]);
      }
      if (action === 'close-popup') closePopup();
      if (action === 'explain' && selected !== null) explain(selected);
      if (action === 'intro') presentation();
      if (action === 'modes') modePanel();
      if (action === 'previous-page' || action === 'next-page') {
        pageIndex += action === 'next-page' ? 1 : -1;
        readPage();
      }
      if (action === 'start-case' || action === 'show-case') {
        caseIndex = pendingCase;
        mode = 'reconstruct';
        validationCount = 0;
        closeDialog();
        summary();
        if (action === 'show-case') update(reconstruct(data, state, data.cases[caseIndex]));
      }
      if (action === 'cases') cases();
      if (action === 'discover') {
        mode = 'discover';
        validationCount = 0;
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
        originalFeedback();
      }
      if (action === 'fullscreen') frame.requestFullscreen?.().catch(() => {});
    });
    on(canvas, 'click', (event) => {
      if (dialog.open) return;
      if (!popup.hidden) {
        closePopup();
        return;
      }
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
        if (dialog.open) {
          closeDialog();
          return;
        }
        if (helpOverlay) {
          closeHelp();
          return;
        }
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
