import { startLevel, move, won, tileAt } from './engine.js';
export async function renderSokoban(main) {
  document.title = 'Sokoban · ADI 4';
  main.innerHTML =
    '<section id="sokoban"><a href="#games" class="back-link">← Les jeux</a><h1>Sokoban</h1><p role="status">Chargement du jeu…</p></section>';
  const root = main.firstElementChild;
  let data, atlas;
  try {
    const response = await fetch('/game/sokoban/levels.json');
    if (!response.ok) throw new Error('levels');
    data = await response.json();
    atlas = new Image();
    atlas.src = '/game/sokoban/tiles.webp';
    await atlas.decode();
  } catch {
    if (root.isConnected)
      root.querySelector('[role=status]').textContent =
        'Les ressources de Sokoban sont indisponibles.';
    return;
  }
  if (!root.isConnected) return;
  root.innerHTML = `<a href="#games" class="back-link">← Les jeux</a><h1>Sokoban</h1><p>Pousse les caisses sur les emplacements clignotants. Tu peux pousser une seule caisse à la fois, jamais la tirer.</p>
    <div class="greenhouse-toolbar"><label>Niveau <select id="soko-level">${data.levels.map((l) => `<option value="${l.id}">${l.id}</option>`).join('')}</select></label><button class="button secondary" id="soko-reset">Recommencer</button><button class="button secondary" id="soko-pause" aria-pressed="false">Pause</button><button class="button secondary" id="soko-next" hidden>Niveau suivant</button></div>
    <canvas class="sokoban-board" width="624" height="384" tabindex="0" role="application" aria-label="Plateau Sokoban. Utilise les flèches du clavier pour te déplacer." aria-describedby="soko-status"></canvas>
    <div class="sokoban-pad" aria-label="Déplacements"><button data-dx="0" data-dy="-1" aria-label="Monter">↑</button><button data-dx="-1" data-dy="0" aria-label="Aller à gauche">←</button><button data-dx="0" data-dy="1" aria-label="Descendre">↓</button><button data-dx="1" data-dy="0" aria-label="Aller à droite">→</button></div>
    <p id="soko-counters"></p><p id="soko-status" role="status">Clique sur le plateau puis utilise les flèches, ZQSD ou WASD.</p>
    <p class="development-note">15 niveaux et graphismes originaux. Règles de déplacement et compteur retrouvés dans l’exécutable 16 bits. Les scores cumulés, sauvegardes et sons d’origine restent à porter.</p>`;
  const canvas = root.querySelector('canvas'),
    context = canvas.getContext('2d'),
    select = root.querySelector('select'),
    status = root.querySelector('#soko-status');
  context.imageSmoothingEnabled = false;
  let state = startLevel(data.levels[0]),
    paused = false,
    started = false,
    last = performance.now(),
    phase = 0;
  function draw() {
    for (let i = 0; i < state.cells.length; i++) {
      const tile = tileAt(state, i, phase);
      context.drawImage(
        atlas,
        (tile % 10) * 24,
        Math.floor(tile / 10) * 24,
        24,
        24,
        (i % 26) * 24,
        Math.floor(i / 26) * 24,
        24,
        24,
      );
    }
    root.querySelector('#soko-counters').textContent =
      `${state.moves} déplacements · ${state.pushes} poussées · Réserve : ${state.remaining}`;
    root.querySelector('#soko-next').hidden =
      !won(state) || Number(select.value) === data.levels.length;
    if (won(state)) status.textContent = 'Bravo ! Toutes les caisses sont en place.';
    else if (state.remaining <= 0)
      status.textContent = 'Réserve épuisée. Recommence le niveau pour réessayer.';
  }
  function reset() {
    state = startLevel(data.levels.find((l) => l.id === Number(select.value)));
    paused = false;
    started = false;
    last = performance.now();
    root.querySelector('#soko-pause').textContent = 'Pause';
    root.querySelector('#soko-pause').setAttribute('aria-pressed', 'false');
    status.textContent =
      'Déplace-toi avec les flèches. La réserve diminue à chaque pas et chaque seconde de jeu.';
    draw();
  }
  function step(dx, dy) {
    if (paused) return;
    const next = move(state, dx, dy);
    if (next !== state) {
      if (!started) last = performance.now();
      started = true;
      state = next;
      draw();
    }
  }
  canvas.onkeydown = (event) => {
    const keys = {
      ArrowUp: [0, -1],
      w: [0, -1],
      z: [0, -1],
      ArrowDown: [0, 1],
      s: [0, 1],
      ArrowLeft: [-1, 0],
      a: [-1, 0],
      q: [-1, 0],
      ArrowRight: [1, 0],
      d: [1, 0],
    };
    const delta = keys[event.key];
    if (delta) {
      event.preventDefault();
      step(...delta);
    }
  };
  root
    .querySelectorAll('[data-dx]')
    .forEach((b) => (b.onclick = () => step(Number(b.dataset.dx), Number(b.dataset.dy))));
  select.onchange = reset;
  root.querySelector('#soko-reset').onclick = reset;
  root.querySelector('#soko-next').onclick = () => {
    select.value = String(Number(select.value) + 1);
    reset();
  };
  root.querySelector('#soko-pause').onclick = (event) => {
    paused = !paused;
    last = performance.now();
    event.currentTarget.textContent = paused ? 'Reprendre' : 'Pause';
    event.currentTarget.setAttribute('aria-pressed', String(paused));
    status.textContent = paused ? 'Jeu en pause.' : 'Partie reprise.';
  };
  const timer = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(timer);
      return;
    }
    const now = performance.now();
    phase = (phase + 1) % 3;
    if (!started || paused || document.hidden || won(state)) last = now;
    else if (now - last >= 1000) {
      state.remaining = Math.max(0, state.remaining - Math.floor((now - last) / 1000));
      last = now;
    }
    draw();
  }, 100);
  draw();
}
