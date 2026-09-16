import { createGame, step, SAVE_KEY, WIDTH, HEIGHT, TICK_MS } from './engine.js';
import { loadArtwork, drawGame, drawMenu, drawEnding } from './renderer.js';
import { bindGameCursor } from './cursor.js';
import { MENU_WIDTH, MENU_HEIGHT, DEFAULT_SPEED, FINALE_DURATION, frameInterval,
  calibrateTiming, createMenuBall, stepMenuBall, soundWait, createBonus, bonusRemaining, synchronousCue,
  readScores, qualifies, insertScore } from './presentation.js';

export async function renderBeeBop(main) {
  document.title = 'BeeBop I · ADI 4';
  main.innerHTML = `<section class="beebop-page"><a class="back-link" href="#games">← Les jeux</a>
    <h1>BeeBop I</h1><p role="status">Chargement du jeu…</p></section>`;
  const root = main.firstElementChild;
  const controller = new AbortController();
  const { signal } = controller;
  let frame, disposed = false, activeAudio = null;
  let activeName, audioStatus = 'idle', audioSerial = 0;
  const sounds = new Map();
  function stopAudio() { for (const audio of sounds.values()) audio.pause(); }
  main.addEventListener('sceneleave', () => {
    disposed = true; controller.abort(); cancelAnimationFrame(frame); stopAudio();
  }, { once: true, signal });
  let campaign, artwork;
  try {
    const response = await fetch('/game/beebop1/campaign.json', { signal });
    if (!response.ok) throw new Error('campaign');
    [campaign, artwork] = await Promise.all([response.json(), loadArtwork()]);
  } catch {
    if (!disposed) root.querySelector('[role=status]').textContent =
      'Impossible de charger BeeBop. Recharge la page pour réessayer.';
    return;
  }
  if (disposed || !root.isConnected) return;
  for (const name of Object.keys(artwork.manifest.sounds)) {
    const audio = new Audio(`/game/beebop1/sounds/${name}-pcm.wav`);
    audio.preload = 'auto'; audio.volume = 0.45;
    audio.addEventListener('error', () => { if (activeAudio === audio) audioStatus = 'blocked'; }, { signal });
    sounds.set(name, audio);
  }
  let checkpoint = { levelIndex: 0, score: 0, lives: 8 }, best = 0, sound = true;
  let scores = [], speed = DEFAULT_SPEED;
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved?.version === 1) {
      if (Number.isInteger(saved.best) && saved.best >= 0) best = saved.best;
      sound = saved.sound !== false;
      scores = readScores(saved.scores);
      if (Number.isInteger(saved.speed) && saved.speed >= 0 && saved.speed <= 80 && saved.speed % 2 === 0)
        speed = saved.speed;
      const c = saved.checkpoint;
      if (c && Number.isInteger(c.levelIndex) && campaign.levels[c.levelIndex] &&
        Number.isInteger(c.score) && c.score >= 0 && c.score < 100000 &&
        Number.isInteger(c.lives) && c.lives >= 0 && c.lives <= 1000) {
        const flags = Object.fromEntries(['48fe', '4900', '4902', '4904', '4906', '4908']
          .map(key => [key, Number.isInteger(c.flags?.[key]) && c.flags[key] >= 0 && c.flags[key] <= 2
            ? c.flags[key] : 0]));
        checkpoint = { levelIndex: c.levelIndex, score: c.score, lives: c.lives, flags };
      }
    }
  } catch { storageAvailable = false; }
  let state = createGame(campaign, checkpoint.levelIndex, checkpoint);
  let screen = 'menu', menuBall = createMenuBall(), timing;
  let paused = false, last = 0, accumulator = 0, pointerX, held = false;
  let presentation = null;
  const keys = new Set();
  root.innerHTML = `<a class="back-link" href="#games">← Les jeux</a>
    <div class="beebop-heading"><h1>BeeBop I</h1><span>${campaign.levels.length} tableaux</span></div>
    <div class="beebop-controls">
      <button data-action="start">Lancer la balle</button>
      <button data-action="pause" aria-pressed="false">Pause</button>
      <button data-action="restart">Recommencer le tableau</button>
      <button data-action="new">Nouvelle partie</button>
      <button data-action="menu">Menu</button>
      <button data-action="fullscreen">Plein écran</button>
      <label><input type="checkbox" data-option="sound"> Son</label>
    </div>
    <div class="beebop-fullscreen"><button class="beebop-exit-fullscreen" data-action="exit-fullscreen">Quitter le plein écran</button><div class="beebop-window">
      <canvas width="${WIDTH}" height="${HEIGHT}" tabindex="0" role="application"
        aria-label="BeeBop I, casse-briques. Déplace la raquette avec la souris ou les flèches."
        aria-describedby="bee-help bee-status"></canvas>
      <div class="beebop-hud" aria-hidden="true"><span class="bee-number bee-level"></span>
        <span class="bee-number bee-points"></span><span class="bee-number bee-reserve"></span>
        <span class="bee-bonus">Cliquer</span></div>
      <div class="beebop-win-values" hidden aria-hidden="true"><span></span><span></span></div>
      <div class="beebop-menu">
        <span class="bee-speed-label">Vitesse de la balle</span><output class="bee-speed-value"></output>
        <span class="bee-scores-label">Scores:</span>
        <ol class="bee-leaderboard" aria-label="Meilleurs scores">${Array.from({ length: 10 }, () =>
          '<li><span></span><span></span></li>').join('')}</ol>
        <button class="bee-menu-button bee-go" data-menu="go" aria-label="Go — Nouvelle partie"></button>
        <button class="bee-menu-button bee-quit" data-menu="quit" aria-label="Quitter"></button>
        <button class="bee-menu-button bee-clear" data-menu="clear" aria-label="R.A.Z. — Effacer les scores"></button>
        <button class="bee-menu-button bee-sound" data-menu="sound" aria-label="Son"></button>
        <button class="bee-menu-button bee-faster" data-menu="faster" aria-label="Accélérer"></button>
        <button class="bee-menu-button bee-slower" data-menu="slower" aria-label="Ralentir"></button>
      </div>
      <form class="beebop-name" role="dialog" aria-modal="true" aria-label="Meilleur score" hidden>
        <label for="bee-name">TAPES TON NOM</label><input id="bee-name" maxlength="18" autocomplete="nickname">
        <button type="submit">OK</button>
      </form>
      <div class="beebop-overlay" hidden><p></p><button data-action="resume">Reprendre</button></div>
    </div></div>
    <div class="beebop-score" aria-live="off"><span data-value="level"></span>
      <span data-value="score"></span><span data-value="lives"></span><span data-value="best"></span></div>
    <p id="bee-status" role="status"></p>
    <div class="beebop-controls beebop-settings"><label>Vitesse de la balle
      <input type="range" min="0" max="80" step="2" value="36" data-option="speed"><output data-value="speed"></output></label>
      <label>Tableau <select data-option="level">${campaign.levels.map((l, i) =>
        `<option value="${i}">${i + 1}</option>`).join('')}</select></label></div>
    <p id="bee-help">Déplace la souris ou le doigt sur le plateau pour guider la raquette.
      Clique ou appuie sur Espace pour lancer la balle et tirer quand le bonus est actif.
      Les flèches ← → déplacent aussi la raquette. Un clic sur le plateau masque le pointeur.
      P ou Échap met le jeu en pause et réaffiche le pointeur.</p>
    <details><summary>Comment jouer</summary><p>Détruis les briques sans perdre la balle.
      Le point de contact sur la raquette détermine le rebond. Les blocs métalliques résistent,
      les blocs renforcés demandent plusieurs impacts et les obstacles rouges sont mortels.
      Certaines briques donnent une balle supplémentaire ou permettent de tirer.
      Les passages et la position de la raquette changent selon le tableau.</p>
      <p>Une brique détruite rapporte un point. À la fin d’un tableau, chaque balle de réserve
      rapporte dix points.</p></details>
    <p class="quiet" data-save></p>
    <details><summary>Crédits</summary><p>BeeBop — Stéphane Petit, 1995. Graphismes et sons de
      l’édition fournie avec ADI 4 · Coktel.</p></details>`;
  const $ = (s) => root.querySelector(s);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const cursor = bindGameCursor(canvas, { signal });
  const status = $('#bee-status'), overlay = $('.beebop-overlay');
  const startButton = $('[data-action=start]');
  $('[data-option=sound]').checked = sound;
  $('[data-option=speed]').value = String(speed);
  $('[data-option=level]').value = String(state.levelIndex);
  function persist() {
    if (screen === 'game') best = Math.max(best, state.score);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, checkpoint, best, sound, scores, speed })); }
    catch { storageAvailable = false; }
    $('[data-save]').textContent = storageAvailable
      ? 'Progression enregistrée au début de chaque tableau dans ce navigateur.'
      : 'Stockage indisponible : la progression reste en mémoire pendant cette session.';
  }
  const names = { launch: 'DEPAR', loss: 'PERDU', paddle: 'RAQUE', wall: 'COTE', win: 'AFFBON' };
  function play(name, loop = false) {
    if (!sound || paused || disposed || document.hidden || !name) return;
    name = name.toUpperCase();
    if (!sounds.has(name)) {
      const audio = new Audio(`/game/beebop1/sounds/${name}-pcm.wav`);
      audio.volume = 0.45; sounds.set(name, audio);
    }
    const audio = sounds.get(name);
    stopAudio();
    activeAudio = audio;
    activeName = name; audioStatus = 'pending';
    const serial = ++audioSerial;
    audio.loop = loop;
    audio.currentTime = 0;
    audio.play().then(() => { if (serial === audioSerial) audioStatus = 'playing'; })
      .catch(() => { if (serial === audioSerial) audioStatus = 'blocked'; });
  }
  function showMenu() {
    screen = 'menu'; presentation = null; paused = false;
    held = false; keys.clear(); accumulator = 0; last = 0;
    menuBall = createMenuBall();
    stopAudio(); play('INTRO', true); update();
    $('[data-menu=go]').focus({ preventScroll: true });
  }
  function askName() {
    if (qualifies(scores, state.score)) {
      screen = 'name'; stopAudio(); update();
      $('#bee-name').value = '';
      $('#bee-name').focus({ preventScroll: true });
    } else showMenu();
    checkpoint = { levelIndex: 0, score: 0, lives: 8 };
    persist();
  }
  $('.beebop-name').onsubmit = event => {
    event.preventDefault();
    scores = insertScore(scores, $('#bee-name').value, state.score);
    persist(); showMenu();
  };
  $('.beebop-name').addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === $('#bee-name')
        ? $('.beebop-name button') : $('#bee-name')).focus();
    }
    if (event.key === 'Escape') { event.preventDefault(); showMenu(); }
  }, { signal });
  function events() {
    for (const e of state.events) {
      if (e.type !== 'win') play(e.type === 'sound' ? e.sound || e.name : names[e.type]);
      if (e.type === 'loss') {
        presentation = { type: 'loss', elapsed: 0, duration: 500, x: e.x, y: e.y };
        held = false;
      } else if (e.type === 'win') {
        presentation = createBonus(state.lives, artwork.manifest, sound);
        held = false;
      }
      if (e.type === 'loss' || e.type === 'win') {
        // 1008:8925/8fa5 drain 1000:0e87 in a tight loop WITHOUT the normal
        // frame wait. Do not invent a 20-tick pause before the end sequence.
        for (const explosion of state.explosions) explosion.age = 20;
        if (e.type === 'win') play('AFFBON');
        persist();
      }
    }
  }
  function update() {
    const menu = screen === 'menu';
    cursor.setActive(screen === 'game' && !paused && !presentation &&
      (state.phase === 'ready' || state.phase === 'playing'));
    const width = menu ? MENU_WIDTH : WIDTH, height = menu ? MENU_HEIGHT : HEIGHT;
    if (canvas.width !== width) { canvas.width = width; canvas.height = height; }
    $('.beebop-window').classList.toggle('is-menu', menu);
    $('.beebop-window').style.setProperty('--bee-ratio', String(width / height));
    $('.beebop-menu').hidden = !menu;
    $('.beebop-name').hidden = screen !== 'name';
    $('.beebop-controls').inert = screen === 'name';
    $('.beebop-settings').inert = screen === 'name';
    canvas.inert = menu || screen === 'name';
    $('.beebop-hud').hidden = menu || presentation?.type === 'finale';
    if (menu) {
      drawMenu(ctx, artwork, menuBall, speed, sound);
      $('.bee-speed-value').textContent = String(speed);
      $('[data-menu=sound]').setAttribute('aria-pressed', String(sound));
      $('[data-menu=faster]').disabled = speed >= timing.maxSpeed;
      $('[data-menu=slower]').disabled = speed <= 0;
      [...$('.bee-leaderboard').children].forEach((row, i) => {
        row.children[0].textContent = scores[i]?.name || '';
        row.children[1].textContent = scores[i] ? String(scores[i].score).padStart(4, '0') : '-';
      });
    } else if (presentation?.type === 'finale' || presentation?.type === 'gameover') {
      drawEnding(ctx, state, artwork, presentation);
    } else drawGame(ctx, state, artwork, presentation);
    $('.bee-level').textContent = String(state.levelIndex + 1);
    $('.bee-points').textContent = String(state.score - bonusRemaining(presentation, state.lives)).padStart(4, '0');
    const losing = presentation?.type === 'loss';
    $('.bee-reserve').textContent = String(Math.max(0, state.lives + (losing ? 1 : 0)));
    $('.bee-bonus').hidden = !state.laser;
    $('.beebop-win-values').hidden = presentation?.type !== 'win';
    $('.beebop-win-values span:first-child').textContent = String(state.lives);
    $('.beebop-win-values span:last-child').textContent = String(state.lives * 10);
    $('.beebop-win-values span:first-child').hidden = presentation?.elapsed < presentation?.revealLives;
    $('.beebop-win-values span:last-child').hidden = presentation?.elapsed < presentation?.revealBonus;
    $('[data-value=level]').textContent = `Tableau ${state.levelIndex + 1}`;
    $('[data-value=score]').textContent = `Score : ${state.score}`;
    $('[data-value=lives]').textContent = `Réserve : ${Math.max(0, state.lives)}`;
    $('[data-value=best]').textContent = `Record : ${menu ? best : Math.max(best, state.score)}`;
    $('[data-value=speed]').textContent = String(speed);
    const done = state.phase === 'won', over = state.phase === 'gameover';
    startButton.textContent = menu ? 'Reprendre le tableau enregistré' : done ? state.levelIndex + 1 === campaign.levels.length
      ? 'Continuer' : 'Tableau suivant' : over ? 'Nouvelle partie'
        : state.phase === 'ready' ? 'Lancer la balle' : 'Tirer';
    startButton.disabled = !menu && (screen === 'name' || paused ||
      Boolean(presentation && !(presentation.type === 'finale' && presentation.elapsed >= presentation.duration)) ||
      (state.phase === 'playing' && !state.laser));
    $('[data-action=pause]').disabled = menu || screen === 'name';
    const message = menu ? 'Go commence une nouvelle partie. Tu peux aussi reprendre le tableau enregistré.'
      : screen === 'name' ? 'Ton score entre au classement. Tapes ton nom.'
      : paused ? 'Jeu en pause.' : over ? 'Partie terminée.' : done
      ? state.levelIndex + 1 === campaign.levels.length ? 'Bravo ! Tu as terminé BeeBop I !'
        : `Tableau réussi ! Bonus de réserve : ${state.lives * 10} points.`
      : state.phase === 'ready' ? 'Clique ou appuie sur Espace pour lancer la balle.'
        : state.laser ? 'Bonus de tir actif : clique ou maintiens Espace pour tirer.' : 'À toi de jouer !';
    if (status.textContent !== message) status.textContent = message;
    overlay.hidden = !paused || menu || screen === 'name';
    overlay.querySelector('p').textContent = 'Pause';
    $('[data-action=pause]').textContent = paused ? 'Reprendre' : 'Pause';
    $('[data-action=pause]').setAttribute('aria-pressed', String(paused));
  }
  function reset(c = checkpoint) {
    cursor.show();
    screen = 'game';
    checkpoint = c;
    state = createGame(campaign, c.levelIndex, c);
    paused = false; held = false; keys.clear(); pointerX = undefined;
    last = 0; accumulator = 0; stopAudio();
    presentation = { type: 'entry', elapsed: 0, duration: 1600 };
    play('AFFCAR');
    $('[data-option=level]').value = String(state.levelIndex);
    persist(); update();
  }
  function action() {
    if (screen === 'menu') { reset(); canvas.focus(); return; }
    if (screen === 'name') return;
    if (!paused && presentation?.type === 'finale' && presentation.elapsed >= presentation.duration) {
      askName(); return;
    }
    if (paused || presentation) return;
    if (state.phase === 'won') {
      if (state.levelIndex + 1 < campaign.levels.length)
        reset({ levelIndex: state.levelIndex + 1, score: state.score, lives: state.lives,
          flags: state.flags });
      else reset({ levelIndex: 0, score: 0, lives: 8 });
    } else if (state.phase === 'gameover') reset({ levelIndex: 0, score: 0, lives: 8 });
    else {
      step(state, { x: pointerX, fire: true }, campaign.patterns);
      events();
      update();
    }
    canvas.focus({ preventScroll: true });
  }
  function pause(value = !paused) {
    if (screen === 'menu' || screen === 'name') { if (value) stopAudio(); return; }
    paused = value; held = false; keys.clear(); accumulator = 0; last = 0;
    if (paused) stopAudio();
    else if (presentation) {
      if (sound && activeAudio && !activeAudio.ended) activeAudio.play().catch(() => {});
    }
    else if (state.phase === 'ready' && !presentation) play('ATTENTE', true);
    update();
  }
  $('[data-action=start]').onclick = action;
  $('[data-action=pause]').onclick = () => pause();
  $('[data-action=resume]').onclick = () => { pause(false); canvas.focus(); };
  $('[data-action=restart]').onclick = () => reset();
  $('[data-action=new]').onclick = () => reset({ levelIndex: 0, score: 0, lives: 8 });
  $('[data-action=menu]').onclick = showMenu;
  $('[data-option=level]').onchange = (e) => reset({ levelIndex: Number(e.target.value), score: 0, lives: 8 });
  function toggleSound(value = !sound) {
    sound = value; $('[data-option=sound]').checked = sound;
    if (!sound) stopAudio();
    else if (screen === 'menu') play('INTRO', true);
    else if (!presentation && state.phase === 'ready') play('ATTENTE', true);
    persist(); update();
  }
  function setSpeed(value) {
    speed = Math.max(0, Math.min(timing.maxSpeed, value));
    $('[data-option=speed]').value = String(speed);
    accumulator = 0; persist(); update();
  }
  $('[data-option=sound]').onchange = e => toggleSound(e.target.checked);
  $('[data-option=speed]').oninput = e => setSpeed(Number(e.target.value));
  $('[data-menu=go]').onclick = () => { reset({ levelIndex: 0, score: 0, lives: 8 }); canvas.focus(); };
  $('[data-menu=quit]').onclick = () => { location.hash = '#games'; };
  $('[data-menu=clear]').onclick = () => { scores = []; best = 0; persist(); update(); };
  $('[data-menu=sound]').onclick = () => toggleSound();
  $('[data-menu=faster]').onclick = () => setSpeed(speed + 2);
  $('[data-menu=slower]').onclick = () => setSpeed(speed - 2);
  function fullscreen() {
    const target = $('.beebop-fullscreen');
    if (document.fullscreenElement === target) document.exitFullscreen?.().catch(() => {});
    else target.requestFullscreen?.().catch(() => {});
  }
  $('[data-action=fullscreen]').onclick = fullscreen;
  $('[data-action=exit-fullscreen]').onclick = fullscreen;
  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) * WIDTH / rect.width - state.paddle.width / 2;
  }
  canvas.addEventListener('pointermove', locate, { signal });
  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== 'game') return;
    if (event.button !== 0) return;
    event.preventDefault(); locate(event); canvas.setPointerCapture(event.pointerId);
    if (state.phase !== 'ready') action();
    held = true;
  }, { signal });
  canvas.addEventListener('pointerup', () => {
    if (held && state.phase === 'ready') action();
    held = false;
  }, { signal });
  for (const type of ['pointercancel', 'lostpointercapture'])
    canvas.addEventListener(type, () => { held = false; }, { signal });
  canvas.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['ArrowLeft', 'ArrowRight', ' ', 'p', 'P', 'Escape'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        if (!event.repeat) pause();
      } else if (event.key === ' ') {
        if (!event.repeat && state.phase !== 'ready') action();
        held = true;
      }
      else { keys.add(event.key); pointerX = undefined; }
    }
  }, { signal });
  canvas.addEventListener('keyup', (event) => {
    keys.delete(event.key);
    if (event.key === ' ') {
      if (held && state.phase === 'ready') action();
      held = false;
    }
  }, { signal });
  canvas.addEventListener('blur', () => { held = false; keys.clear(); }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); }, { signal });
  window.addEventListener('blur', () => pause(true), { signal });
  root.addEventListener('pointerdown', () => {
    if (screen === 'menu' && sound && ![...sounds.values()].some(audio => !audio.paused)) play('INTRO', true);
  }, { signal });
  function animate(now) {
    if (disposed || !root.isConnected) return;
    const elapsed = last && !paused && !document.hidden ? Math.min(100, now - last) : 0;
    const interval = frameInterval(speed, timing);
    if (screen === 'menu') {
      accumulator += elapsed;
      while (accumulator >= interval) { stepMenuBall(menuBall); accumulator -= interval; }
      last = now; update(); frame = requestAnimationFrame(animate); return;
    }
    if (screen === 'name') { last = now; frame = requestAnimationFrame(animate); return; }
    if (presentation && !paused) {
      const previous = presentation.elapsed;
      const cue = synchronousCue(presentation);
      if (cue && sound && activeName === cue.name && audioStatus !== 'blocked') {
        presentation.elapsed = activeAudio.ended ? cue.end :
          Math.max(previous, Math.min(cue.end - 0.001, cue.start + activeAudio.currentTime * 1000));
      } else presentation.elapsed += elapsed;
      if (presentation.type === 'win') {
        for (const [at, name] of [[presentation.revealLives, 'KEY'], [presentation.revealBonus, 'KEY'],
          [presentation.countEnd, 'FINBON']]) {
          if (previous < at && at <= presentation.elapsed) play(name);
        }
        if (presentation.elapsed >= presentation.countStart && presentation.elapsed < presentation.countEnd &&
          Math.floor(previous / 10) !== Math.floor(presentation.elapsed / 10)) play('BOP');
      }
      // Drain brick animations while the simulation itself waits.
      for (const e of state.explosions) e.age = (e.age ?? state.tick - e.tick) + elapsed / TICK_MS;
      if (presentation.elapsed >= presentation.duration) {
        const finished = presentation.type;
        if (finished !== 'finale' && finished !== 'gameover') presentation = null;
        if (finished === 'win') {
          if (state.levelIndex + 1 < campaign.levels.length) {
            reset({ levelIndex: state.levelIndex + 1, score: state.score, lives: state.lives,
              flags: state.flags });
          } else {
            presentation = { type: 'finale', elapsed: 0, duration: FINALE_DURATION };
            play('FINMEU', true);
          }
        } else if (finished === 'loss' && state.phase === 'gameover') {
          presentation = { type: 'gameover', elapsed: 0,
            duration: soundWait(artwork.manifest, 'ORGUE', sound) };
          play('ORGUE');
        } else if (finished === 'gameover') askName();
        else if (state.phase === 'ready') play('ATTENTE', true);
      }
    } else accumulator += elapsed;
    last = now;
    while (screen === 'game' && !paused && !presentation && accumulator >= interval) {
      const x = keys.size ? state.paddle.x +
        (Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * 4 : pointerX;
      step(state, { x, fire: held && state.phase === 'playing' }, campaign.patterns);
      events();
      accumulator -= interval;
    }
    update(); frame = requestAnimationFrame(animate);
  }
  // Calibrate the non-waiting portion on a scratch canvas, without changing the
  // player's board or producing audio. The native version similarly times its
  // simulation+blit loop before setting its 94 Hz reference waiting count.
  const benchmark = createGame(campaign);
  const scratch = new OffscreenCanvas(WIDTH, HEIGHT).getContext('2d');
  drawGame(scratch, benchmark, artwork);
  const began = performance.now();
  for (let i = 0; i < 64; i++) {
    step(benchmark, { fire: true }, campaign.patterns);
    drawGame(scratch, benchmark, artwork);
  }
  const frameCostMs = Math.max(0.1, (performance.now() - began) / 64);
  let busyLoops = 0;
  const loopBegan = performance.now();
  while (performance.now() - loopBegan < 20) busyLoops++;
  const busyLoopsPerSecond = Math.max(1, busyLoops * 1000 / (performance.now() - loopBegan));
  timing = calibrateTiming(1000 / frameCostMs, busyLoopsPerSecond);
  speed = Math.min(speed, timing.maxSpeed);
  $('[data-option=speed]').max = String(timing.maxSpeed);
  $('[data-option=speed]').value = String(speed);
  persist(); showMenu(); frame = requestAnimationFrame(animate);
}
