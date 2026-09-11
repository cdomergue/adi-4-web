import {WIDTH, HEIGHT, startLevel, move, won, replayMoves} from './mrmatt-engine.js';

const STORE = 'adi4-mrmatt1-v1';
const esc = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tileColumn = [0,1,3,2,4,7,8,9,0,5,6];

export async function renderMrMatt(main) {
  document.title = 'Mr. Matt I · ADI 4';
  main.innerHTML = '<section class="mrmatt-page"><a class="back-link" href="#games">← Les jeux</a><h1>Mr. Matt I</h1><p role="status">Chargement du jeu…</p></section>';
  const root = main.firstElementChild;
  let data, atlas;
  try {
    const response = await fetch('/game/mrmatt1/levels.json');
    if (!response.ok) throw new Error('levels');
    data = await response.json();
    atlas = new Image(); atlas.src = '/game/mrmatt1/tiles.webp'; await atlas.decode();
  } catch {
    if (root.isConnected) root.querySelector('[role=status]').textContent = 'Impossible de charger Mr. Matt. Recharge la page pour réessayer.';
    return;
  }
  if (!root.isConnected) return;
  let pack = data.packs[0], level = pack.levels[0], route = '', snapshot = null;
  let state = startLevel(level), theme = 1, sound = true, protection = false, saved = true;
  let completed = new Set(), demonstration = null, demoTimer, walkTimer;
  let recovery = '';
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const storage = JSON.parse(raw);
      if (![1,2].includes(storage.version)) throw new Error('version');
      const candidatePack = data.packs.find(p => p.id === storage.pack);
      const candidateLevel = candidatePack?.levels.find(l => l.id === storage.level);
      if (!candidateLevel) throw new Error('level');
      const candidateState = replayMoves(candidateLevel,storage.route);
      if (storage.snapshot !== null) replayMoves(candidateLevel,storage.snapshot);
      pack = candidatePack; level = candidateLevel; state = candidateState;
      route = storage.route; snapshot = storage.snapshot;
      if ([1,2,3,4].includes(storage.theme)) theme = storage.theme;
      if (typeof storage.sound === 'boolean') sound = storage.sound;
      // Version 1 enabled protection automatically. Migrate it once without
      // discarding the player's route, snapshot or completed levels.
      if (storage.version === 2 && typeof storage.protection === 'boolean') protection = storage.protection;
      const valid = new Set(data.packs.flatMap(p => p.levels.map(l => `${p.id}/${l.id}`)));
      if (Array.isArray(storage.completed)) completed = new Set(storage.completed.filter(id => valid.has(id)));
      recovery = 'Ta partie a été retrouvée.';
    }
  } catch { recovery = 'La sauvegarde n’a pas pu être lue. Une nouvelle partie est prête.'; }

  root.innerHTML = `<a class="back-link" href="#games">← Les jeux</a>
    <div class="matt-heading"><div><h1>Mr. Matt I</h1><p>Creuse un chemin, mange toutes les pommes et garde un œil sur les pierres.</p></div><span>25 niveaux originaux</span></div>
    <div class="matt-window">
      <div class="matt-titlebar"><span>Mr. Matt</span><span id="matt-pack-title"></span></div>
      <div class="matt-toolbar">
        <label>Jeu <select id="matt-pack">${data.packs.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
        <label>Niveau <select id="matt-level"></select></label>
      </div>
      <div class="matt-toolbar matt-actions">
        <button id="matt-undo" title="Retour arrière">↶ Annuler</button><button id="matt-restart" title="Espace">Recommencer</button>
        <button id="matt-snapshot">Prendre un cliché</button><button id="matt-restore">Restaurer le cliché</button>
        <button id="matt-solution">Voir la solution</button><button id="matt-fullscreen">Plein écran</button>
      </div>
      <div class="matt-scoreboard"><span id="matt-level-title"></span><span id="matt-counts"></span></div>
      <canvas width="496" height="288" tabindex="0" role="application" aria-label="Plateau Mr. Matt. Déplace-toi avec les flèches du clavier." aria-describedby="matt-help matt-status"></canvas>
      <div class="matt-statusbar"><span id="matt-status" role="status"></span><button id="matt-next" hidden>Niveau suivant →</button></div>
    </div>
    <div class="matt-options">
      <label>Décor <select id="matt-theme"><option value="1">Pommes</option><option value="2">Carottes</option><option value="3">Hamburgers</option><option value="4">Citrouilles</option></select></label>
      <label><input id="matt-protection" type="checkbox"> Déplacements réfléchis</label>
      <label><input id="matt-sound" type="checkbox"> Sons d’origine</label>
      <span id="matt-progress"></span>
    </div>
    <div class="sokoban-pad matt-pad" aria-label="Déplacements">
      <button data-direction="U" aria-label="Monter">↑</button><button data-direction="L" aria-label="Aller à gauche">←</button><button data-direction="D" aria-label="Descendre">↓</button><button data-direction="R" aria-label="Aller à droite">→</button>
    </div>
    <p id="matt-help">Flèches ou ZQSD / WASD pour bouger. Retour arrière pour annuler. Espace pour recommencer.<br>Clique sur une case de la même ligne ou colonne pour avancer jusqu’à elle. Les pierres se poussent seulement sur les côtés, vers une case vide.</p>
    <details class="matt-help-details"><summary>Comment jouer</summary><p>Mange toute la nourriture pour terminer le niveau. La terre se creuse, les murs restent en place. Une pierre libérée tombe ; après sa chute, elle peut rouler sur une autre pierre. Attention : une pierre qui arrive juste au-dessus de Matt l’écrase.</p><p>« Déplacements réfléchis » empêche de descendre directement sous une pierre. Tu peux désactiver cette protection pour retrouver les déplacements sans assistance. Un cliché garde un point de reprise dans le niveau. La démonstration utilise la solution enregistrée dans le jeu original ; tu peux l’interrompre et retrouver ta partie.</p></details>
    <p id="matt-save-status" class="quiet"></p>`;
  const $ = selector => root.querySelector(selector);
  const canvas = $('canvas'), ctx = canvas.getContext('2d'), status = $('#matt-status');
  const audio = new Audio(); audio.volume = .55;
  const soundFiles = {kill:'MM_KILL',win:'MM_WIN',pick:'MM_PICK',stone:'MM_STON',push:'MM_STON',dig:'MM_NULL',crate:'MM_STON',snapshot:'MM_SNAP',restore:'MM_REST',blocked:'MM_STUP'};
  function play(event) {
    if (!sound || !event || !root.isConnected || document.hidden) return;
    audio.pause(); audio.src = `/game/mrmatt1/audio/${soundFiles[event]}.wav`; audio.play().catch(() => {});
  }
  function persist() {
    try {
      localStorage.setItem(STORE,JSON.stringify({version:2,pack:pack.id,level:level.id,route,snapshot,
        theme,sound,protection,completed:[...completed]})); saved = true;
    } catch {saved = false;}
    $('#matt-save-status').textContent = saved ? 'Partie et clichés enregistrés automatiquement dans ce navigateur.' : 'Stockage indisponible : ta partie reste accessible pendant cette session.';
  }
  function stopWalk() {clearInterval(walkTimer); walkTimer = null;}
  function stopDemo() {clearInterval(demoTimer); demoTimer = null; demonstration = null; audio.pause();}
  function fillLevels() {
    $('#matt-pack').value = pack.id;
    $('#matt-level').innerHTML = pack.levels.map(l => `<option value="${l.id}">${l.id} · ${esc(l.name)}</option>`).join('');
    $('#matt-level').value = String(level.id);
  }
  function draw(message) {
    const display = demonstration?.state || state;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < display.cells.length; i++) {
      ctx.drawImage(atlas,tileColumn[display.cells[i]]*16,(theme-1)*16,16,16,(i%WIDTH)*16,Math.floor(i/WIDTH)*16,16,16);
    }
    $('#matt-pack-title').textContent = pack.name;
    $('#matt-level-title').textContent = `${level.id}. ${level.name}`;
    const food = {1:'pommes',2:'carottes',3:'hamburgers',4:'citrouilles'}[theme];
    $('#matt-counts').textContent = `${display.remaining} ${food} · ${display.moves} pas`;
    $('#matt-progress').textContent = `${completed.size} / 25 niveaux réussis`;
    $('#matt-next').hidden = !!demonstration || !won(state) || level.id === pack.levels.length;
    $('#matt-undo').disabled = !!demonstration || route.length === 0;
    $('#matt-snapshot').disabled = !!demonstration || state.dead;
    $('#matt-restore').disabled = !!demonstration || snapshot === null;
    $('#matt-solution').textContent = demonstration ? 'Reprendre ma partie' : 'Voir la solution';
    if (demonstration) status.textContent = won(display) ? 'Solution terminée. Reprends ta partie quand tu veux.' : `Solution originale · ${demonstration.cursor} / ${level.solution.count} pas`;
    else if (state.dead) status.textContent = 'Matt est écrasé ! Annule le dernier pas ou recommence.';
    else if (won(state)) status.textContent = 'Bravo ! Toute la nourriture a été mangée.';
    else if (message) status.textContent = message;
  }
  function reset(newLevel = level) {
    stopWalk(); stopDemo(); level = newLevel; state = startLevel(level); route = ''; snapshot = null;
    fillLevels(); persist(); draw('À toi de jouer !');
  }
  function step(direction) {
    if (demonstration) return false;
    if (route.length >= 16384) {draw('Limite de déplacements atteinte. Recommence ce niveau.'); return false;}
    const next = move(state,direction,{noStupidMoves:protection});
    if (next === state) {play('blocked'); return false;}
    state = next; route += direction;
    if (won(state)) completed.add(`${pack.id}/${level.id}`);
    const event = ['kill','win','pick','crate','stone','push','dig'].find(e => state.events.includes(e));
    play(event); persist(); draw('À toi de jouer !'); return true;
  }
  function undo() {
    stopWalk(); if (demonstration || !route.length) return;
    route = route.slice(0,-1); state = replayMoves(level,route); persist(); draw('Dernier pas annulé.');
  }
  $('#matt-pack').onchange = event => {pack = data.packs.find(p => p.id === event.target.value); reset(pack.levels[0]);};
  $('#matt-level').onchange = event => reset(pack.levels.find(l => l.id === Number(event.target.value)));
  $('#matt-theme').value = String(theme);
  $('#matt-theme').onchange = event => {theme = Number(event.target.value); persist(); draw();};
  $('#matt-protection').checked = protection;
  $('#matt-protection').onchange = event => {protection = event.target.checked; persist();};
  $('#matt-sound').checked = sound;
  $('#matt-sound').onchange = event => {sound = event.target.checked; if (!sound) audio.pause(); persist();};
  $('#matt-undo').onclick = () => {undo(); canvas.focus({preventScroll:true});};
  $('#matt-restart').onclick = () => {reset(); canvas.focus({preventScroll:true});};
  $('#matt-next').onclick = () => {reset(pack.levels[level.id]); canvas.focus({preventScroll:true});};
  $('#matt-snapshot').onclick = () => {stopWalk(); snapshot = route; play('snapshot'); persist(); draw('Cliché enregistré. Tu peux le restaurer à tout moment.');};
  $('#matt-restore').onclick = () => {
    if (snapshot === null) return;
    stopWalk(); route = snapshot; state = replayMoves(level,route); play('restore'); persist(); draw('Cliché restauré.');
  };
  $('#matt-solution').onclick = () => {
    stopWalk();
    if (demonstration) {stopDemo(); draw('Ta partie est reprise.'); return;}
    demonstration = {state:startLevel(level),cursor:0}; draw();
    demoTimer = setInterval(() => {
      if (!root.isConnected || !demonstration) {stopDemo(); return;}
      if (document.hidden) return;
      const d = demonstration;
      d.state = move(d.state,level.solution.moves[d.cursor++],{noStupidMoves:false}); draw();
      if (d.cursor >= level.solution.moves.length) {clearInterval(demoTimer); demoTimer = null;}
    },100);
  };
  $('#matt-fullscreen').onclick = () => {
    const window = $('.matt-window');
    if (document.fullscreenElement === window) document.exitFullscreen?.().catch(() => {});
    else window.requestFullscreen?.().catch(() => draw('Le plein écran est indisponible dans ce navigateur.'));
  };
  canvas.onkeydown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const keys = {ArrowUp:'U',w:'U',z:'U',ArrowDown:'D',s:'D',ArrowLeft:'L',a:'L',q:'L',ArrowRight:'R',d:'R'};
    const direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (direction) {event.preventDefault(); stopWalk(); step(direction);}
    else if (event.key === 'Backspace') {event.preventDefault(); undo();}
    else if (event.key === ' ' && !event.repeat) {event.preventDefault(); reset();}
    else if (event.key === 'Escape') {stopWalk(); stopDemo(); draw('Ta partie est reprise.');}
    else if (/^[1-9]$/.test(event.key) && pack.levels[Number(event.key)-1]) {event.preventDefault(); reset(pack.levels[Number(event.key)-1]);}
  };
  root.querySelectorAll('[data-direction]').forEach(button => {
    button.onclick = () => {stopWalk(); step(button.dataset.direction);};
  });
  canvas.onclick = event => {
    stopWalk(); canvas.focus({preventScroll:true}); if (demonstration) return;
    const bounds = canvas.getBoundingClientRect(), x = Math.floor((event.clientX-bounds.left)/bounds.width*WIDTH), y = Math.floor((event.clientY-bounds.top)/bounds.height*HEIGHT);
    const px = state.player%WIDTH, py = Math.floor(state.player/WIDTH);
    if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || (x !== px && y !== py) || (x === px && y === py)) return;
    const destination = y*WIDTH+x, direction = x === px ? (y < py ? 'U':'D') : (x < px ? 'L':'R');
    const walk = () => {if (!root.isConnected || document.hidden || state.player === destination || !step(direction)) stopWalk();};
    walkTimer = setInterval(walk,100); walk();
  };
  canvas.onblur = stopWalk;
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {stopWalk(); stopDemo(); audio.removeAttribute('src'); audio.load(); observer.disconnect();}
  });
  observer.observe(main,{childList:true});
  fillLevels(); persist(); draw(recovery || 'Clique sur le plateau puis utilise les flèches.');
}
