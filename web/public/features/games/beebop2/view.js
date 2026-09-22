import { createGame, step, movePaddle, launch, WIDTH, HEIGHT } from './engine.js';
import { drawGame, drawMenu, createTransition } from './renderer.js';
import { createBonus, bonusRemaining, synchronousCue } from './presentation.js';
import { lossCommands, deathLines, lineCommands } from './death-lines.js';
import { loadArtwork } from '../beebop-common/artwork.js';
import { bindGameCursor } from '../beebop-common/cursor.js';
import { calibrateTiming, frameInterval } from '../beebop-common/timing.js';
import { readScores, insertScore, qualifies } from '../beebop-common/scores.js';

const SAVE_KEY = 'adi4-beebop2-v1';

export async function renderBeeBop2(main) {
  document.title = 'BeeBop II · ADI 4';
  main.innerHTML = `<section class="beebop-page beebop2-page"><a href="#games" class="back-link">← Les jeux</a>
    <h1>BeeBop II</h1><p role="status">Chargement du jeu…</p></section>`;
  const root = main.firstElementChild;
  const controller = new AbortController(), { signal } = controller;
  let disposed = false, frame, activeAudio, activeName, audioSerial = 0;
  const sounds = new Map();
  function stopSound() { audioSerial++; for (const audio of sounds.values()) audio.pause(); activeAudio = null; }
  main.addEventListener('sceneleave', () => {
    disposed = true; controller.abort(); cancelAnimationFrame(frame); stopSound();
  }, { once: true, signal });
  let campaign, art, sequences;
  try {
    const response = await fetch('/game/beebop2/campaign.json', { signal });
    if (!response.ok) throw new Error('campaign');
    const sequenceResponse = await fetch('/game/beebop2/presentation.json', { signal });
    if (!sequenceResponse.ok) throw new Error('presentation');
    [campaign, art, sequences] = await Promise.all([response.json(), loadArtwork('/game/beebop2/'), sequenceResponse.json()]);
  } catch {
    if (!disposed) root.querySelector('[role=status]').textContent = 'Chargement impossible. Recharge la page pour réessayer.';
    return;
  }
  if (disposed || !root.isConnected) return;
  let checkpoint = { path: 0, levelIndex: 0, score: 0, lives: 6 };
  let sound = true, speed = 36, scores = [], storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved?.version === 1) {
      sound = saved.sound !== false;
      if (Number.isInteger(saved.speed) && saved.speed >= 0 && saved.speed <= 72) speed = saved.speed;
      scores = readScores(saved.scores);
      const c = saved.checkpoint;
      if (c && [0, 1].includes(c.path) && Number.isInteger(c.levelIndex) && c.levelIndex >= 0 && c.levelIndex < 20 &&
          Number.isInteger(c.score) && c.score >= 0 && c.score < 100000 &&
          Number.isInteger(c.lives) && c.lives >= 0 && c.lives <= 1000) checkpoint = c;
    }
  } catch { storageAvailable = false; }
  let state = createGame(campaign, checkpoint.levelIndex, checkpoint);
  let screen = 'menu', paused = false, held = false, firePulse = false, pointerX;
  let last = 0, accumulator = 0, presentation = null, alternating = 0;
  const keys = new Set(), menuBall = { x: 140, y: 210, dx: 2, dy: 2 };
  root.innerHTML = `<a href="#games" class="back-link">← Les jeux</a>
    <div class="beebop-heading"><h1>BeeBop II</h1><span>Deux parcours de 20 tableaux</span></div>
    <div class="beebop-controls">
      <button data-action="start">Reprendre</button><button data-action="pause">Pause</button>
      <button data-action="restart">Recommencer le tableau</button><button data-action="menu">Menu</button>
      <button data-action="fullscreen">Plein écran</button>
      <label><input type="checkbox" data-option="sound"> Son</label>
    </div>
    <div class="beebop-fullscreen"><button class="beebop-exit-fullscreen" data-action="exit-fullscreen">Quitter le plein écran</button>
      <div class="beebop-window bee2-window" style="--bee-ratio:1.333333">
        <canvas width="640" height="480" tabindex="0" role="application" aria-label="BeeBop II, casse-briques"
          aria-describedby="bee2-help bee2-status"></canvas>
        <div class="bee2-hud" aria-hidden="true"><span data-hud="level"></span><span data-hud="score"></span>
          <span data-hud="lives"></span><button data-action="quit" tabindex="-1" aria-label="Menu"></button></div>
        <div class="bee2-menu">
          <button class="bee2-go" data-menu="go" aria-label="Go, nouvelle partie"></button>
          <button class="bee2-quit" data-menu="quit" aria-label="Quitter"></button>
          <button class="bee2-faster" data-menu="faster" aria-label="Accélérer"></button>
          <button class="bee2-slower" data-menu="slower" aria-label="Ralentir"></button>
          <span class="bee2-speed">Vitesse : <span data-speed></span></span>
          <section class="bee2-ranking"><h2>Classement</h2><ol>${'<li><span></span><span></span></li>'.repeat(10)}</ol>
          <button data-menu="clear">R.A.Z.</button></section>
        </div>
        <div class="bee2-bonus" hidden aria-hidden="true"><span data-bonus="lives"></span><span data-bonus="score"></span></div>
        <div class="bee2-ending" hidden>PERDU</div>
        <div class="beebop-overlay" hidden><p>Pause</p><button data-action="resume">Reprendre</button></div>
        <form class="beebop-name" hidden><label for="bee2-name">TAPES TON NOM</label>
          <input id="bee2-name" maxlength="17" autocomplete="nickname"><button>OK</button></form>
      </div>
    </div>
    <p id="bee2-status" role="status" aria-live="polite"></p>
    <div class="beebop-controls"><label>Parcours <select data-option="path"><option value="0">1</option><option value="1">2</option></select></label>
      <label>Tableau <select data-option="level">${Array.from({ length: 20 }, (_, i) => `<option value="${i}">${i + 1}</option>`).join('')}</select></label>
      <label>Vitesse <input type="range" data-option="speed" min="0" max="72" step="2" value="36"></label>
    </div>
    <p id="bee2-help">La souris ou le doigt guide la raquette. Clique ou appuie sur Espace pour lancer la balle,
      puis maintiens pour tirer avec un bonus. Les flèches ← → déplacent aussi la raquette.
      Un clic sur le plateau masque le pointeur ; Échap le réaffiche et met en pause.</p>
    <details><summary>Comment jouer</summary><p>Détruis les briques en évitant les lignes bleues mortelles.
      Les blocs renforcés demandent quatre impacts. Les bonus activent le tir simple ou double,
      annulent le tir ou ajoutent une balle de réserve. Certains passages s’ouvrent après la destruction
      de briques précises. Une brique vaut dix points ; chaque balle de réserve vaut cent points en fin de tableau.</p></details>
    <p class="quiet" data-save></p>
    <details><summary>Crédits et fidélité</summary><p>BeeBop II — Stéphane Petit. Ressources de l’édition ADI 4.
      Règles issues de la décompilation Win16 ; le navigateur exécute uniquement JavaScript et Canvas.</p></details>`;
  const $ = selector => root.querySelector(selector);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const cursor = bindGameCursor(canvas, { signal });
  $('[data-option=sound]').checked = sound;

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, checkpoint, scores, sound, speed })); }
    catch { storageAvailable = false; }
    $('[data-save]').textContent = storageAvailable ? 'Reprise enregistrée au début du tableau dans ce navigateur.' :
      'Stockage indisponible : la progression reste en mémoire pour cette session.';
  }
  function play(name, loop = false) {
    stopSound();
    if (!sound || paused || disposed || document.hidden || !name) return;
    if (!sounds.has(name)) {
      const audio = new Audio('/game/beebop2/' + art.manifest.sounds[name]);
      audio.volume = 0.45;
      sounds.set(name, audio);
    }
    const audio = sounds.get(name), serial = audioSerial;
    activeAudio = audio; activeName = name; audio.currentTime = 0; audio.loop = loop;
    audio.play().catch(() => { if (serial === audioSerial) activeAudio = null; });
  }
  function update() {
    const menu = screen === 'menu', naming = screen === 'name';
    cursor.setActive(!menu && !naming && !paused && !presentation && ['ready', 'playing'].includes(state.phase));
    $('.bee2-menu').hidden = !menu;
    $('.bee2-hud').hidden = menu || ['menuExit', 'atom', 'entry', 'gameover', 'closing', 'finale'].includes(presentation?.type);
    $('.beebop-name').hidden = !naming;
    $('.beebop-overlay').hidden = !paused;
    $('.bee2-bonus').hidden = presentation?.type !== 'won';
    $('.bee2-ending').hidden = !['gameover', 'finale'].includes(presentation?.type);
    $('.bee2-ending').textContent = presentation?.type === 'finale' ? 'FIN !' : 'PERDU';
    canvas.inert = naming;
    for (const controls of root.querySelectorAll('.beebop-controls')) controls.inert = naming;
    if (menu) {
      drawMenu(ctx, art, menuBall, speed);
      [...$('.bee2-ranking ol').children].forEach((li, i) => {
        li.children[0].textContent = scores[i]?.name || '';
        li.children[1].textContent = scores[i] ? String(Math.floor(scores[i].score / 10)).padStart(4, '0') : '';
      });
    } else if (presentation?.transition) presentation.transition.draw(ctx, presentation.elapsed);
    else drawGame(ctx, state, art, campaign, presentation);
    $('[data-hud=level]').textContent = String(state.levelIndex + 1);
    $('[data-hud=score]').textContent = String(state.score - (presentation?.remaining || 0)).padStart(5, '0');
    $('[data-hud=lives]').textContent = String(state.lives);
    $('[data-bonus=lives]').textContent = String(state.lives);
    $('[data-bonus=score]').textContent = String(state.bonus || 0);
    $('[data-bonus=lives]').hidden = presentation?.elapsed < presentation?.revealLives;
    $('[data-bonus=score]').hidden = presentation?.elapsed < presentation?.revealBonus;
    $('[data-speed]').textContent = String(speed);
    $('[data-option=speed]').value = String(speed);
    $('[data-action=pause]').disabled = menu || naming;
    $('[data-action=pause]').textContent = paused ? 'Reprendre' : 'Pause';
    $('[data-action=pause]').setAttribute('aria-pressed', String(paused));
    $('[data-action=start]').textContent = menu ? 'Reprendre le tableau enregistré' : state.phase === 'ready' ? 'Lancer la balle' :
      ['won', 'gameover'].includes(state.phase) ? 'Continuer' : 'Tirer';
    $('[data-action=start]').disabled = naming || paused || Boolean(presentation && !['gameover', 'finale'].includes(presentation.type));
    const text = menu ? 'Go commence une nouvelle partie.' : naming ? 'Ton score entre au classement.' : paused ? 'Jeu en pause.' :
      state.phase === 'ready' ? 'Clique ou appuie sur Espace pour lancer la balle.' : state.phase === 'won' ? 'Tableau réussi !' :
      state.phase === 'gameover' ? 'Partie terminée.' : state.weapon ? 'Tir actif : maintiens le clic ou Espace.' : 'À toi de jouer !';
    if ($('#bee2-status').textContent !== text) $('#bee2-status').textContent = text;
  }
  function transitionTo(type, background, name) {
    const transition = createTransition(ctx, art, sequences[type], background);
    presentation = { type, elapsed: 0, duration: transition.duration, transition };
    play(name);
  }
  function reset(c = checkpoint, fromMenu = false) {
    checkpoint = { ...c };
    state = createGame(campaign, c.levelIndex, c);
    screen = 'game'; paused = false; held = firePulse = false; pointerX = undefined; keys.clear();
    last = accumulator = 0; cursor.show();
    transitionTo(fromMenu ? 'menuExit' : 'entry', fromMenu ? 134 : 1001 + state.levelIndex,
      fromMenu ? 'TRANSPPTR' : 'TELEPTR');
    $('[data-option=path]').value = String(state.path);
    $('[data-option=level]').value = String(state.levelIndex);
    persist(); update();
  }
  function menu() {
    screen = 'menu'; paused = false; presentation = null; held = firePulse = false; keys.clear();
    last = accumulator = 0; cursor.show(); play('INTROPTR', true); update();
  }
  function finish() {
    if (qualifies(scores, state.score)) {
      screen = 'name'; stopSound(); update();
      $('#bee2-name').value = ''; $('#bee2-name').focus();
    } else menu();
  }
  function processEvents() {
    for (const event of state.events) {
      const names = { launch: 'DEPAR', wall: 'COTE', hard: 'MURPTR', paddle: 'RAQUE', fire: 'MISSIL', gate: 'INTERPTR' };
      if (event.type === 'brick') play((alternating++ % 2) ? 'BIP' : 'BOP');
      else if (names[event.type]) play(names[event.type]);
      if (event.type === 'loss') {
        held = false;
        drawGame(ctx, { ...state, phase: 'playing', missiles: [],
          ball: { ...state.ball, x: event.x, y: event.y } }, art, campaign);
        const transition = createTransition(ctx, art, lossCommands(state, event), 1001 + state.levelIndex);
        presentation = { type: 'loss', elapsed: 0, duration: transition.duration, transition,
          cues: [[1000, 'RAYONPTR']] };
        play('RAYONPTR');
      }
      if (event.type === 'won') {
        held = false;
        const transition = createTransition(ctx, art, sequences.exit, 134);
        presentation = { type: 'exit', elapsed: 0, remaining: state.bonus,
          duration: transition.duration, transition };
        play('TELEPTR');
      }
    }
  }
  function action() {
    if (screen === 'menu') { reset(); canvas.focus(); return; }
    if (screen === 'name' || paused) return;
    if (presentation) {
      if (['gameover', 'finale'].includes(presentation.type) && presentation.elapsed >= 1000) finish();
      return;
    }
    movePaddle(state, pointerX);
    state.events = [];
    if (!launch(state) && state.phase === 'playing') firePulse = true;
    processEvents(); update(); canvas.focus({ preventScroll: true });
  }
  function pause(value = !paused) {
    if (screen !== 'game') return;
    if (paused === value) return;
    paused = value; held = firePulse = false; keys.clear(); last = accumulator = 0;
    if (paused) { for (const audio of sounds.values()) audio.pause(); }
    else if (activeAudio && sound) activeAudio.play().catch(() => { activeAudio = null; });
    else if (state.phase === 'ready' && !presentation) play('ATTENTEPTR', true);
    update();
  }
  $('[data-action=start]').onclick = action;
  $('[data-action=pause]').onclick = () => pause();
  $('[data-action=resume]').onclick = () => { pause(false); canvas.focus(); };
  $('[data-action=restart]').onclick = () => reset();
  $('[data-action=menu]').onclick = menu;
  $('[data-action=quit]').onclick = menu;
  $('[data-menu=go]').onclick = () => { reset({ path: Number($('[data-option=path]').value), levelIndex: 0, score: 0, lives: 6 }, true); canvas.focus(); };
  $('[data-menu=quit]').onclick = () => { location.hash = '#games'; };
  $('[data-menu=clear]').onclick = () => { scores = []; persist(); update(); };
  $('[data-option=level]').onchange = () => reset({ path: Number($('[data-option=path]').value),
    levelIndex: Number($('[data-option=level]').value), score: 0, lives: 6 });
  $('[data-option=path]').onchange = () => reset({ path: Number($('[data-option=path]').value), levelIndex: 0, score: 0, lives: 6 });
  function setSpeed(value) { speed = Math.max(0, Math.min(timing.maxSpeed, Math.round(value / 2) * 2)); persist(); update(); }
  $('[data-option=speed]').oninput = e => setSpeed(Number(e.target.value));
  $('[data-menu=faster]').onclick = () => setSpeed(speed + 2);
  $('[data-menu=slower]').onclick = () => setSpeed(speed - 2);
  $('[data-option=sound]').onchange = e => {
    sound = e.target.checked; stopSound();
    if (screen === 'menu') play('INTROPTR', true);
    else if (state.phase === 'ready') play('ATTENTEPTR', true);
    persist();
  };
  function fullscreen() {
    const target = $('.beebop-fullscreen');
    if (document.fullscreenElement === target) document.exitFullscreen?.().catch(() => {});
    else target.requestFullscreen?.().catch(() => {});
  }
  $('[data-action=fullscreen]').onclick = fullscreen;
  $('[data-action=exit-fullscreen]').onclick = fullscreen;
  $('.beebop-name').onsubmit = e => {
    e.preventDefault(); scores = insertScore(scores, $('#bee2-name').value, state.score);
    checkpoint = { path: state.path, levelIndex: 0, score: 0, lives: 6 }; persist(); menu();
  };
  $('.beebop-name').addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const first = $('#bee2-name'), last = $('.beebop-name button');
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, { signal });
  function locate(e) {
    const box = canvas.getBoundingClientRect();
    // GetCursorPos in the original controls the LEFT edge of the paddle.
    pointerX = (e.clientX - box.left) * WIDTH / box.width;
  }
  canvas.addEventListener('pointermove', locate, { signal });
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || screen !== 'game') return;
    e.preventDefault(); locate(e); canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId); held = true;
    if (state.phase !== 'ready') action();
  }, { signal });
  canvas.addEventListener('pointerup', () => { if (held && state.phase === 'ready') action(); held = false; }, { signal });
  for (const type of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => { held = false; }, { signal });
  canvas.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!['ArrowLeft', 'ArrowRight', ' ', 'Escape', 'p', 'P'].includes(e.key)) return;
    e.preventDefault();
    if (['Escape', 'p', 'P'].includes(e.key)) { if (!e.repeat) pause(); }
    else if (e.key === ' ') { held = true; if (!e.repeat && state.phase !== 'ready') action(); }
    else { keys.add(e.key); pointerX = undefined; }
  }, { signal });
  canvas.addEventListener('keyup', e => {
    keys.delete(e.key);
    if (e.key === ' ') { if (held && state.phase === 'ready') action(); held = false; }
  }, { signal });
  canvas.addEventListener('blur', () => { held = false; keys.clear(); }, { signal });
  window.addEventListener('blur', () => pause(true), { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) {
    if (screen === 'game') pause(true); else stopSound();
  } }, { signal });
  root.addEventListener('pointerdown', () => { if (screen === 'menu' && sound && (!activeAudio || activeAudio.paused)) play('INTROPTR', true); }, { signal });

  const scratch = new OffscreenCanvas(WIDTH, HEIGHT).getContext('2d');
  const began = performance.now();
  for (let i = 0; i < 32; i++) drawGame(scratch, state, art, campaign);
  const cost = Math.max(0.1, (performance.now() - began) / 32);
  let loops = 0;
  const start = performance.now();
  while (performance.now() - start < 20) loops++;
  const timing = calibrateTiming(1000 / cost, loops * 1000 / (performance.now() - start));
  timing.maxSpeed = Math.min(72, timing.maxSpeed);
  speed = Math.min(speed, timing.maxSpeed);
  $('[data-option=speed]').max = String(timing.maxSpeed);
  function animate(now) {
    if (disposed || !root.isConnected) return;
    const elapsed = last && !paused && !document.hidden ? Math.min(100, now - last) : 0;
    last = now;
    if (presentation && screen === 'game' && !paused) {
      const previous = presentation.elapsed;
      const cue = sound ? synchronousCue(presentation, art.manifest) : null;
      if (cue && activeAudio && activeName === cue.name) {
        presentation.elapsed = activeAudio.ended ? cue.end :
          Math.max(previous, Math.min(cue.end - 0.001, cue.start + activeAudio.currentTime * 1000));
      } else presentation.elapsed += elapsed;
      if (presentation.type === 'won') {
        presentation.remaining = bonusRemaining(presentation, state.lives);
        for (const [at, name] of [[presentation.revealLives, 'KEY'], [presentation.revealBonus, 'KEY'], [presentation.countEnd, 'FINBON']]) {
          if (previous < at && presentation.elapsed >= at) play(name);
        }
        if (presentation.elapsed >= presentation.countStart && presentation.elapsed < presentation.countEnd &&
            Math.floor(previous / 10) !== Math.floor(presentation.elapsed / 10)) play('BOP');
      }
      for (const [at, name] of presentation.cues || []) {
        if (previous < at && presentation.elapsed >= at) play(name);
      }
      if (presentation.elapsed >= presentation.duration) {
        const type = presentation.type;
        presentation.transition?.draw(ctx, presentation.duration);
        const ending = presentation;
        presentation = null;
        if (type === 'menuExit') transitionTo('atom', 134, 'NOVAPTR');
        else if (type === 'atom') transitionTo('entry', 1001 + state.levelIndex, 'TELEPTR');
        else if (type === 'exit') {
          presentation = createBonus(state.lives, art.manifest, sound); play('AFFBON');
        } else if (type === 'entry') {
          drawGame(ctx, state, art, campaign, { type: 'build' });
          const commands = [], cues = [];
          let at = 0;
          for (const line of deathLines(state)) {
            const part = lineCommands(line, false, true);
            if (at) cues.push([at, 'RAYONPTR']);
            commands.push(...part);
            at += part.reduce((sum, c) => sum + (c[0] === 'wait' ? c[1] : 0), 0);
          }
          const transition = createTransition(ctx, art, commands, 1001 + state.levelIndex);
          presentation = { type: 'build', elapsed: 0, duration: transition.duration, transition, cues };
          play('RAYONPTR');
        } else if (type === 'build') play('ATTENTEPTR', true);
        else if (type === 'closing') {
          const transition = createTransition(ctx, art, [['background', 0, 0, 640, 40]], 134);
          presentation = { type: 'gameover', elapsed: 0,
            duration: (sound ? art.manifest.soundDurations.ORAGEPTR * 1000 : 0) + 250, transition };
          play('ORAGEPTR');
        }
        else if (type === 'won') {
          if (state.levelIndex < 19) reset({ path: state.path, levelIndex: state.levelIndex + 1, score: state.score, lives: state.lives });
          else { presentation = { type: 'finale', elapsed: 0,
            duration: (sound ? art.manifest.soundDurations.ORAGEPTR * 1000 : 0) + 250 }; play('ORAGEPTR'); }
        } else if (type === 'loss') {
          if (state.phase === 'gameover') {
            const transition = createTransition(ctx, art, sequences.gameover, 1);
            presentation = { type: 'closing', elapsed: 0, duration: transition.duration, transition };
            play('TERREPTR');
          }
          else play('ATTENTEPTR', true);
        } else if (type === 'gameover' || type === 'finale') { presentation = ending; finish(); }
      }
    } else if (!paused && screen !== 'name') {
      accumulator += elapsed;
      const interval = Math.max(1, frameInterval(speed, timing));
      while (accumulator >= interval && !presentation) {
        accumulator -= interval;
        if (screen === 'menu') {
          menuBall.x += menuBall.dx; menuBall.y += menuBall.dy;
          if (menuBall.x < 69 || menuBall.x > 153) menuBall.dx *= -1;
          if (menuBall.y < 153 || menuBall.y > 249) menuBall.dy *= -1;
        } else {
          const x = keys.size ? state.paddle.x + (Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * 4 : pointerX;
          step(state, { x, fire: (held || firePulse) && state.phase === 'playing' }); firePulse = false; processEvents();
        }
      }
    }
    update(); frame = requestAnimationFrame(animate);
  }
  persist(); menu(); frame = requestAnimationFrame(animate);
}
