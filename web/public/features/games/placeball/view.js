import { createGame, launch, selectLauncher, step, checkpoint, readCheckpoint,
  SAVE_KEY, TICK_MS, COLS, ROWS, index } from './engine.js';
import { loadArtwork, drawGame } from './renderer.js';

export async function renderPlaceBall(main) {
  document.title = 'Place Ball · ADI 4';
  main.innerHTML = `<section class="placeball-page"><a class="back-link" href="#games">← Les jeux</a>
    <h1>Place Ball</h1><p role="status">Chargement du jeu…</p></section>`;
  const root = main.firstElementChild, controller = new AbortController(), { signal } = controller;
  let frame, disposed = false, modalResolve = null;
  const sounds = new Map();
  function stopSounds() { for (const audio of sounds.values()) audio.pause(); }
  main.addEventListener('sceneleave', () => {
    disposed = true; modalResolve?.(false); modalResolve = null;
    controller.abort(); cancelAnimationFrame(frame); stopSounds();
    root.querySelector('dialog')?.close();
  }, { once: true, signal });
  let campaign, artwork;
  try {
    const response = await fetch('/game/placeball/campaign.json', { signal });
    if (!response.ok) throw new Error('campaign');
    [campaign, artwork] = await Promise.all([response.json(), loadArtwork()]);
  } catch {
    if (!disposed) root.querySelector('[role=status]').textContent =
      'Impossible de charger Place Ball. Recharge la page pour réessayer.';
    return;
  }
  if (disposed || !root.isConnected) return;
  let sound = true, saved = null, scores = [], storageAvailable = true;
  let difficulty = 0, speed = 3;
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (data?.version === 1) {
      saved = readCheckpoint(data.checkpoint, campaign);
      sound = data.sound !== false;
      difficulty = data.difficulty === 1 ? 1 : 0;
      speed = Number.isInteger(data.speed) && data.speed >= 1 && data.speed <= 5 ? data.speed : 3;
      scores = (Array.isArray(data.scores) ? data.scores : []).filter(s => s &&
        typeof s.name === 'string' && Number.isInteger(s.score) && s.score > 0 &&
        s.score <= 0xffffffff && Number.isInteger(s.level) && s.level >= 1 && s.level <= 16)
        .map(s => ({ ...s, name: s.name.slice(0, 31) })).sort((a, b) => b.score - a.score).slice(0, 10);
    }
  } catch { storageAvailable = false; }
  let state = createGame(campaign, 0, { difficulty, speed }), menu = true, paused = false;
  let last = 0, accumulator = 0, idle = 0, mascot = null, finale = null;
  root.innerHTML = `<a class="back-link" href="#games">← Les jeux</a>
    <div class="placeball-heading"><h1>Place Ball</h1><span>15 niveaux · Todd Michael Lewis</span></div>
    <div class="placeball-toolbar">
      <button data-action="new">Nouvelle partie</button><button data-action="load">Charger la partie</button>
      <button data-action="save">Enregistrer</button><button data-action="restart">Recommencer le niveau</button>
      <button data-action="end">Abandonner la partie</button><button data-action="scores">Meilleurs scores</button>
    </div>
    <div class="placeball-window"><button class="placeball-exit-fullscreen" data-action="fullscreen">Quitter le plein écran</button>
      <canvas width="640" height="440" tabindex="0" role="application" aria-label="Place Ball : choisir un lanceur"
        aria-describedby="placeball-help placeball-status"></canvas>
      <div class="placeball-overlay"><img src="/game/placeball/bitmap-102.png" alt="Softdisk Publishing" width="207" height="70">
        <p>Bienvenue dans Place Ball !!</p><button data-action="new">Nouvelle partie</button></div>
    </div>
    <div class="placeball-toolbar">
      <button data-action="launch">Lancer la sphère</button><button data-action="pause" aria-pressed="false">Pause</button>
      <button data-action="fullscreen">Plein écran</button>
      <label><input type="checkbox" data-option="sound"> Son</label>
      <label>Vitesse <select data-option="speed" aria-label="Vitesse"><option value="1">1 · Très lente</option>
        <option value="2">2 · Lente</option><option value="3">3 · Normale</option>
        <option value="4">4 · Rapide</option><option value="5">5 · Très rapide</option></select></label>
      <label>Difficulté <select data-option="difficulty" aria-label="Difficulté de la prochaine partie"><option value="0">Standard</option>
        <option value="1">Challenge</option></select></label>
      <button data-action="help">Aide</button>
    </div>
    <p id="placeball-status" role="status"></p>
    <p id="placeball-help">Clique sur une flèche pour lancer une sphère. Les flèches du clavier ou Tab
      choisissent le lanceur clignotant ; Entrée ou Espace lance. Échap met en pause.</p>
    <details><summary>Comment jouer</summary><p>Place toutes les sphères dans les trous. En mode Challenge,
      ramasse aussi tous les hamburgers, bananes et pommes. La sphère se déplace seule : les murs la font
      rebondir et les flippers changent de sens après chaque passage. Les bombes et les lanceurs sont mortels.
      Une sphère sacrifiée détruit une bombe ; les changements du tableau persistent jusqu’au prochain essai.</p>
      <p>Un mur vaut 5 points, un flipper 10, un prix 100, un trou 250 et un niveau réussi 1 000.
      Le mode Challenge double ces points. Les sphères disponibles sont propres à chaque niveau.
      Recommencer ou épuiser ses sphères annule les points obtenus dans ce niveau.</p>
      <p>L’enregistrement reprend au début du niveau. La difficulté choisie s’applique à la prochaine
      nouvelle partie. Ctrl+N : nouvelle partie ; Ctrl+R : recommencer ; Ctrl+S : enregistrer ;
      Ctrl+O : charger ; Ctrl+E : abandonner.</p></details>
    <p class="quiet" data-storage></p>
    <details><summary>Crédits et adaptation</summary><p>Place Ball — Todd Michael Lewis, Softdisk Publishing,
      édition française 1995–96. Graphismes, bruitages et quinze tableaux de l’édition ADI 4.
      Moteur JavaScript natif fondé sur la décompilation Win16. La piste musicale 110 est absente
      de cet exécutable ; aucun morceau de remplacement n’est utilisé.</p></details>
    <dialog class="placeball-dialog" aria-labelledby="placeball-dialog-title"><h2 id="placeball-dialog-title"></h2>
      <div data-dialog-body></div><div data-dialog-actions></div></dialog>`;
  const $ = selector => root.querySelector(selector);
  const canvas = $('canvas'), ctx = canvas.getContext('2d'), dialog = $('dialog');
  const overlay = $('.placeball-overlay'), status = $('#placeball-status');
  const defaultOverlay = overlay.innerHTML;
  $('[data-option=sound]').checked = sound;
  $('[data-option=speed]').value = String(speed);
  $('[data-option=difficulty]').value = String(difficulty);
  const soundIds = { wall: 106, flipper: 103, prize: 104, death: 107, hole: 111, finale: 109, mascot: 108 };
  const channels = new Map();
  let wallVoice = 0, prizeVoice = 0;
  function play(event) {
    if (!sound || disposed || document.hidden || !soundIds[event]) return;
    const id = soundIds[event];
    // Native WaveMix rotates three wall voices and two prize voices; other effects share channel 7.
    const channel = event === 'wall' ? 2 + wallVoice++ % 3 : event === 'prize' ? 5 + prizeVoice++ % 2 : 7;
    const key = `${id}:${channel}`;
    channels.get(channel)?.pause();
    if (!sounds.has(key)) {
      const audio = new Audio(`/game/placeball/sound-${id}.wav`); audio.volume = 0.45;
      sounds.set(key, audio);
    }
    const audio = sounds.get(key); channels.set(channel, audio); audio.currentTime = 0;
    audio.loop = event === 'mascot'; audio.play().catch(() => {});
  }
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, checkpoint: saved,
      scores, sound, difficulty, speed })); }
    catch { storageAvailable = false; }
    $('[data-storage]').textContent = storageAvailable
      ? 'L’enregistrement et les meilleurs scores restent dans ce navigateur.'
      : 'Stockage indisponible : les enregistrements restent en mémoire pendant cette session.';
  }
  function showDialog(title, body, actions = [['OK', true]]) {
    if (dialog.open || disposed) return Promise.resolve(false);
    stopSounds(); canvas.classList.remove('is-cursor-hidden');
    $('#placeball-dialog-title').textContent = title;
    const content = $('[data-dialog-body]'); content.replaceChildren();
    if (typeof body === 'string') { const p = document.createElement('p'); p.textContent = body; content.append(p); }
    else content.append(body);
    const controls = $('[data-dialog-actions]'); controls.replaceChildren();
    return new Promise(resolve => {
      modalResolve = resolve;
      for (const [label, value] of actions) {
        const button = document.createElement('button'); button.textContent = label;
        button.addEventListener('click', () => { dialog.returnValue = value ? 'yes' : ''; dialog.close(); }, { signal });
        controls.append(button);
      }
      dialog.returnValue = ''; dialog.showModal(); content.querySelector('input')?.focus();
    });
  }
  dialog.addEventListener('close', () => {
    modalResolve?.(dialog.returnValue === 'yes'); modalResolve = null;
    last = 0; accumulator = 0; if (!disposed) canvas.focus({ preventScroll: true });
  }, { signal });
  const confirm = (title, body) => showDialog(title, body, [['Oui', true], ['Non', false]]);
  async function showScores() {
    const list = document.createElement('ol');
    for (const item of scores) {
      const li = document.createElement('li');
      li.textContent = `${item.name} — ${item.score} points · niveau ${item.level}`; list.append(li);
    }
    if (!scores.length) return showDialog('Meilleurs scores', 'Aucun score enregistré.');
    const clear = await showDialog('Meilleurs scores', list, [['OK', false], ['Effacer', true]]);
    if (clear && !disposed && await confirm('Effacer les scores', 'Souhaites-tu effacer les meilleurs scores ?')) {
      if (!disposed) { scores = []; persist(); }
    }
  }
  async function finish() {
    // The original increments the level before recording a completed campaign (16).
    const score = state.score, level = state.levelIndex + (finale !== null ? 2 : 1);
    menu = true; finale = null; paused = false; stopSounds(); update();
    if (score && (scores.length < 10 || score >= scores.at(-1).score)) {
      const form = document.createElement('form');
      form.innerHTML = `<label>Félicitations ! Tu entres dans les Meilleurs scores.
        <input name="player" maxlength="31" aria-label="Ton nom" autocomplete="nickname" required></label>`;
      form.addEventListener('submit', e => { e.preventDefault(); dialog.returnValue = 'yes'; dialog.close(); }, { signal });
      if (await showDialog('Saisie du meilleur score', form, [['Enregistrer', true], ['Annuler', false]])) {
        if (disposed) return;
        scores.unshift({ name: form.elements.player.value.trim().slice(0, 31) || 'Joueur', score, level });
        scores.sort((a, b) => b.score - a.score); scores = scores.slice(0, 10); persist();
      }
      if (!disposed) await showScores();
    } else await showDialog('Fin de partie', 'Ton score est insuffisant pour t’inscrire dans la liste des meilleurs scores.');
  }
  function start(levelIndex = 0, options = { difficulty, speed }) {
    stopSounds(); state = createGame(campaign, levelIndex, options);
    speed = state.speed; $('[data-option=speed]').value = String(speed);
    menu = false; paused = false; idle = 0; mascot = null; finale = null;
    accumulator = 0; last = 0; update(); canvas.focus({ preventScroll: true });
  }
  function update() {
    const canPlay = !menu && finale === null;
    for (const name of ['save', 'restart', 'end'])
      for (const button of root.querySelectorAll('[data-action=' + name + ']')) button.disabled = !canPlay;
    $('[data-action=launch]').disabled = !canPlay || paused || state.phase !== 'ready';
    $('[data-action=load]').disabled = !saved;
    for (const button of root.querySelectorAll('[data-action=pause]')) {
      button.disabled = menu;
      button.textContent = paused ? 'Reprendre' : 'Pause';
      button.setAttribute('aria-pressed', String(paused));
    }
    overlay.hidden = !menu && !paused;
    if (menu && overlay.dataset.kind !== 'menu') { overlay.innerHTML = defaultOverlay; overlay.dataset.kind = 'menu'; }
    else if (paused && overlay.dataset.kind !== 'pause') {
      overlay.innerHTML = '<p>Pause</p><button data-action="pause">Reprendre</button>'; overlay.dataset.kind = 'pause';
    }
    canvas.classList.toggle('is-cursor-hidden', !menu && !paused && !dialog.open && state.phase === 'moving');
    const message = menu ? 'Choisis Nouvelle partie ou charge un enregistrement.'
      : `Niveau ${state.levelIndex + 1} · ${state.lives} sphère${state.lives > 1 ? 's' : ''} · ${state.score} points · ${state.holes} trou${state.holes > 1 ? 's' : ''}`
        + (state.difficulty ? ` · ${state.prizes} prix` : '')
        + (paused ? ' · Pause' : state.phase === 'ready' ? ' · Choisis un lanceur.' : '');
    if (status.textContent !== message) status.textContent = message;
  }
  async function action(name) {
    idle = 0;
    if (finale !== null && !['pause', 'fullscreen', 'help'].includes(name)) return;
    if (name === 'new') {
      if (!menu && !await confirm('Nouvelle partie', 'Une partie est en cours. Souhaites-tu recommencer ?')) return;
      if (!disposed) start();
    } else if (name === 'restart') {
      if (menu || !await confirm('Recommencer le niveau', 'Es-tu sûr de vouloir recommencer ce niveau ?')) return;
      if (!disposed) start(state.levelIndex, checkpoint(state));
    } else if (name === 'save' && !menu) {
      saved = checkpoint(state); persist(); update();
      await showDialog('Enregistrer une partie', 'Partie enregistrée au début du niveau actuel.');
    } else if (name === 'load' && saved) {
      if (!menu && !await confirm('Charger une partie', 'Souhaites-tu interrompre cette partie ?')) return;
      if (!disposed) start(saved.levelIndex, saved);
    } else if (name === 'end' && !menu) {
      if (await confirm('Fin de partie', 'Souhaites-tu interrompre cette partie ?')) {
        // Win16 command 101 abandons without submitting the in-progress score.
        if (!disposed) { menu = true; paused = false; finale = null; mascot = null; stopSounds(); update(); }
      }
    } else if (name === 'pause' && !menu) {
      paused = !paused; last = 0; accumulator = 0; stopSounds(); update();
      if (!paused && mascot) play('mascot');
      if (!paused) canvas.focus({ preventScroll: true });
    } else if (name === 'launch' && !paused && !menu) { launch(state); update(); canvas.focus(); }
    else if (name === 'scores') await showScores();
    else if (name === 'help') await showDialog('Comment utiliser Place Ball', $('#placeball-help').textContent +
      ' Remplis tous les trous ; en mode Challenge, ramasse également tous les prix. Les bombes et les lanceurs détruisent la sphère.');
    else if (name === 'fullscreen') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await $('.placeball-window').requestFullscreen();
      } catch { await showDialog('Plein écran', 'Le plein écran n’est pas disponible dans ce navigateur.'); }
    }
  }
  root.addEventListener('click', e => {
    const button = e.target.closest('[data-action]'); if (button && !dialog.open) void action(button.dataset.action);
  }, { signal });
  canvas.addEventListener('pointerdown', e => {
    if (menu || paused || finale !== null || dialog.open) return;
    canvas.focus({ preventScroll: true }); idle = 0;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) * 640 / rect.width - 8) / 24);
    const y = Math.floor(((e.clientY - rect.top) * 440 / rect.height - 8) / 24);
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) launch(state, index(x, y));
    update();
  }, { signal });
  root.addEventListener('keydown', e => {
    if (dialog.open) return;
    const shortcut = e.ctrlKey && { n: 'new', r: 'restart', s: 'save', o: 'load', e: 'end' }[e.key.toLowerCase()];
    if (shortcut) { e.preventDefault(); void action(shortcut); return; }
    if (e.key === 'Escape') { e.preventDefault(); void action('pause'); return; }
    if (e.key === 'F1') { e.preventDefault(); void action('help'); return; }
    if (e.target !== canvas || menu || paused || finale !== null) return;
    if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Tab', ' ', 'Enter'].includes(e.key)) {
      e.preventDefault(); idle = 0;
      if (e.key === ' ' || e.key === 'Enter') launch(state);
      else selectLauncher(state, ['ArrowLeft', 'ArrowUp'].includes(e.key) || e.shiftKey ? -1 : 1);
      update();
    }
  }, { signal });
  root.addEventListener('change', e => {
    if (e.target.dataset.option === 'sound') { sound = e.target.checked; if (!sound) stopSounds(); }
    if (e.target.dataset.option === 'speed') { speed = Number(e.target.value); state.pendingSpeed = speed; }
    if (e.target.dataset.option === 'difficulty') difficulty = Number(e.target.value);
    persist();
  }, { signal });
  function pauseOnLeave() {
    if (!menu) { paused = true; stopSounds(); update(); }
    last = 0;
  }
  window.addEventListener('blur', pauseOnLeave, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); }, { signal });
  function tick(now) {
    if (disposed) return;
    const delta = last ? Math.min(100, now - last) : 0; last = now;
    if (!paused && !dialog.open && !document.hidden) {
      if (finale !== null) {
        finale += delta;
        if (finale >= 1500) void finish();
      } else if (mascot) {
        mascot.elapsed += delta;
        if (mascot.elapsed >= 4600) { mascot = null; idle = 0; stopSounds(); }
      } else {
        idle += delta;
        if (idle >= 360000) { mascot = { elapsed: 0, y: Math.floor(Math.random() * 350) }; play('mascot'); }
        if (!menu) {
          accumulator += delta;
          while (accumulator >= TICK_MS) {
            accumulator -= TICK_MS; step(state);
            for (const event of state.events) play(event);
            if (state.phase === 'won' && state.phaseTime >= 400) {
              if (state.levelIndex + 1 < campaign.levels.length)
                start(state.levelIndex + 1, { score: state.score, difficulty: state.difficulty, speed: state.pendingSpeed ?? state.speed });
              else { finale = 0; play('finale'); accumulator = 0; }
              break;
            }
            if (state.phase === 'gameover') {
              void (async () => {
                const again = await confirm('J’ai déjà entendu sauve qui peut, mais…',
                  'Aie ! Tu n’as plus aucune boule disponible ! Veux-tu essayer ce niveau encore une fois ?');
                if (disposed) return;
                if (again) start(state.levelIndex, checkpoint(state)); else await finish();
              })();
              accumulator = 0; break;
            }
          }
        }
      }
    }
    drawGame(ctx, artwork, state, { menu, mascot }); update();
    frame = requestAnimationFrame(tick);
  }
  persist(); update(); frame = requestAnimationFrame(tick);
}
