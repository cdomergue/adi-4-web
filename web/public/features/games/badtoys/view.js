import { createGame, step, use, chooseWeapon, saveGame, loadGame, episodeSaveKey } from './engine.js';
import { createRenderer } from './renderer.js';
import { escapeHtml } from '../../../shared/text.js';
const base = '/game/badtoys/';
export async function renderBadToys(main, episode = '1') {
  const saveKey = episodeSaveKey(episode);
  document.title = `Bad Toys 3D ${episode} — ADI 4`;
  main.innerHTML = '<p class="loading">Ouverture de la fabrique de jouets…</p>';
  let disposed = false, raf = 0;
  const abort = new AbortController();
  const activeAudio = new Set(), pressed = new Set(), pulses = new Map();
  let canvas;
  const stopAudio = () => { activeAudio.forEach((a) => { a.pause(); a.remove(); }); activeAudio.clear(); };
  main.addEventListener('sceneleave', () => {
    disposed = true; cancelAnimationFrame(raf); abort.abort();
    stopAudio();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }, { once: true });
  try {
    const [catalog, maps] = await Promise.all(['catalog.json', 'maps.json'].map(async (file) => {
      const response = await fetch(base + file, { signal: abort.signal });
      if (!response.ok) throw new Error(file);
      return response.json();
    }));
    const episodeMaps = catalog.episodes[episode].maps;
    const campaigns = Object.values(catalog.episodes);
    const commonLevels = episodeMaps.findIndex((id, index) =>
      campaigns.some((campaign) => campaign.maps[index] !== id));
    // Shared assets are loaded once per visit, independent of episode configuration.
    const pictures = Object.fromEntries(await Promise.all(Object.entries(catalog.images).map(([name, entry]) =>
      new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve([name, image]);
        image.onerror = reject; image.src = base + entry.file; }))));
    if (disposed) return;
    main.innerHTML = `<section class="badtoys">
      <div class="scene-heading"><a href="#games">← La caisse</a><h1>Bad Toys 3D ${['I','II','III','IV'][Number(episode) - 1]}</h1></div>
      <div class="badtoys-toolbar"><button class="button" data-start>Jouer</button>
        <button class="button secondary" data-pause>Pause</button><button class="button secondary" data-save>Sauvegarder</button>
        <button class="button secondary" data-load>Reprendre</button>
        <label><input type="checkbox" data-sound checked> Son</label>
        <label><input type="checkbox" data-map> Carte</label>
        <button class="button secondary" data-fullscreen>Plein écran</button></div>
      <div class="badtoys-screen"><canvas tabindex="0" aria-label="Bad Toys 3D, vue de la fabrique"></canvas>
        <div class="badtoys-cover"><img src="${base + catalog.images[`BM_BT${episode}`].file}" alt="Bad Toys 3D ${episode}"><p data-cover-text>Entre dans la fabrique et trouve la sortie.</p><button class="button" data-play>Commencer la partie</button></div></div>
      <p class="badtoys-status" role="status">Prêt à jouer.</p>
      ${commonLevels > 0 ? `<div class="badtoys-campaign-note"><p>Les ${commonLevels} premiers niveaux sont communs aux quatre épisodes dans les jeux originaux. Les parcours commencent à diverger au niveau ${commonLevels + 1}.</p><button class="button secondary" data-skip-common>Passer au niveau ${commonLevels + 1}</button></div>` : ''}
      <div class="badtoys-controls" aria-label="Commandes tactiles">
        <button data-hold="ArrowLeft" aria-label="Tourner à gauche">↶</button><button data-hold="ArrowUp" aria-label="Avancer">↑</button><button data-hold="ArrowRight" aria-label="Tourner à droite">↷</button>
        <button data-hold="KeyQ" aria-label="Pas à gauche">←</button><button data-hold="ArrowDown" aria-label="Reculer">↓</button><button data-hold="KeyE" aria-label="Pas à droite">→</button>
        <button data-hold="ControlLeft">Tirer</button><button data-use>Ouvrir / actionner</button></div>
      <div class="badtoys-weapons">${['Poings', 'Pistolet', 'Fusil', 'Énergie'].map((name, i) => `<button data-weapon="${i}">${i + 1} · ${name}</button>`).join('')}</div>
      <p>Flèches ou Z/W/S pour avancer et tourner · Q/A et E/D pour les pas de côté · Ctrl ou clic pour tirer · Espace pour ouvrir · 1–4 pour les armes · Virgule (,) pour la carte · Échap pour la pause.</p>
      <p>Clique dans l’image pour viser à la souris. Échap libère le pointeur.</p>
      <details><summary>Choisir un niveau</summary><label>Niveau <select data-level>${episodeMaps.map((id, i) => `<option value="${i}">${i + 1}${i < commonLevels ? ' · commun aux quatre épisodes' : ''}</option>`).join('')}</select></label> <button class="button secondary" data-level-start>Jouer ce niveau</button></details>
      ${catalog.credits?.text ? `<details class="badtoys-credits">
        <summary>Crédits</summary>
        <p>Jeu original : <strong>Bad Toys 3D</strong></p>
        <p class="badtoys-copyright">${escapeHtml(catalog.credits.text)}</p>
      </details>` : ''}
    </section>`;
    const root = main.querySelector('.badtoys'); canvas = root.querySelector('canvas');
    const screen = root.querySelector('.badtoys-screen'), cover = root.querySelector('.badtoys-cover');
    const status = root.querySelector('[role="status"]'), sound = root.querySelector('[data-sound]');
    const mapToggle = root.querySelector('[data-map]');
    const render = createRenderer(canvas, pictures);
    let level = 0, game = createGame(maps[catalog.episodes[episode].maps[0]], catalog), paused = true, previous = 0;
    const notify = (text) => { status.textContent = text; };
    const playSound = (id, volume = 1) => {
      const file = catalog.sounds[`SND_${id}`]; if (!file || !sound.checked) return;
      const audio = new Audio(base + file); audio.volume = .5 * volume; audio.hidden = true; root.append(audio); activeAudio.add(audio);
      const release = () => { activeAudio.delete(audio); audio.remove(); };
      audio.onended = release; audio.onerror = release;
      audio.play().catch(release);
    };
    function persist() {
      if (game.status !== 'playing') return;
      try { localStorage.setItem(saveKey, saveGame(game, episode, level)); notify('Partie sauvegardée.'); }
      catch { notify('La sauvegarde n’est pas disponible dans ce navigateur.'); }
    }
    function updateControls() {
      root.querySelectorAll('[data-weapon]').forEach((b) => {
        b.disabled = !game.player.owned[Number(b.dataset.weapon)];
        b.setAttribute('aria-pressed', String(Number(b.dataset.weapon) === game.player.weapon));
      });
      canvas.dataset.health = game.player.health;
      canvas.dataset.ammo = game.player.ammo[game.player.weapon];
      canvas.dataset.gameStatus = game.status;
      canvas.dataset.episode = episode;
      canvas.dataset.levelNumber = level + 1;
      canvas.dataset.mapId = episodeMaps[level];
      canvas.dataset.position = `${game.player.x.toFixed(2)},${game.player.y.toFixed(2)}`;
    }
    function resume() { if (game.status !== 'playing') return; paused = false; pressed.clear(); pulses.clear(); cover.hidden = true; canvas.focus(); previous = 0; notify(`Niveau ${level + 1} — trouve la sortie.`); }
    function begin(index = 0, carry = null) {
      stopAudio();
      level = index;
      game = createGame(maps[catalog.episodes[episode].maps[index]], catalog);
      if (carry) Object.assign(game.player, carry, { x: game.player.x, y: game.player.y, angle: game.player.angle, keys: game.player.keys });
      root.querySelector('[data-level]').value = index;
      resume(); updateControls();
    }
    function pause() {
      if (paused || game.status !== 'playing') return;
      paused = true; pressed.clear(); pulses.clear(); stopAudio();
      cover.hidden = false; cover.querySelector('img').hidden = true;
      cover.querySelector('[data-cover-text]').textContent = 'Pause';
      cover.querySelector('[data-play]').textContent = 'Continuer';
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    }
    root.querySelector('[data-play]').onclick = () => {
      if (game.status === 'won') {
        if (level + 1 < catalog.episodes[episode].maps.length) begin(level + 1, game.player);
        else begin(0);
      } else if (game.status === 'dead') {
        const lives = game.player.lives - 1; begin(lives > 0 ? level : 0);
        if (lives > 0) game.player.lives = lives;
      } else resume();
    };
    root.querySelector('[data-start]').onclick = () => begin(0);
    const skipCommon = root.querySelector('[data-skip-common]');
    if (skipCommon) skipCommon.onclick = () => begin(commonLevels);
    root.querySelector('[data-level-start]').onclick = () => begin(Number(root.querySelector('[data-level]').value));
    root.querySelector('[data-pause]').onclick = () => paused ? resume() : pause();
    root.querySelector('[data-save]').onclick = persist;
    root.querySelector('[data-load]').onclick = () => {
      let saved;
      try { saved = loadGame(localStorage.getItem(saveKey), maps, catalog); } catch { /* Storage unavailable. */ }
      if (!saved || saved.episode !== episode) { notify('Aucune sauvegarde compatible.'); return; }
      stopAudio();
      game = saved.game; level = saved.level; root.querySelector('[data-level]').value = level; resume(); updateControls();
    };
    root.querySelector('[data-fullscreen]').onclick = () => screen.requestFullscreen?.().catch(() => notify('Le plein écran n’est pas disponible.'));
    sound.onchange = () => { if (!sound.checked) stopAudio(); };
    root.querySelector('[data-use]').onclick = () => { if (!paused) use(game); };
    root.querySelectorAll('[data-weapon]').forEach((b) => { b.onclick = () => chooseWeapon(game, Number(b.dataset.weapon)); });
    root.querySelectorAll('[data-hold]').forEach((b) => {
      let heldAt = 0;
      const pulse = () => { if (!paused) pulses.set(b.dataset.hold, game.time + .12); };
      b.onpointerdown = (e) => { e.preventDefault(); heldAt = performance.now(); b.setPointerCapture(e.pointerId); if (!paused) pressed.add(b.dataset.hold); };
      b.onpointerup = () => { if (performance.now() - heldAt < 120) pulse(); pressed.delete(b.dataset.hold); };
      b.onpointercancel = b.onlostpointercapture = () => pressed.delete(b.dataset.hold);
      b.onclick = (e) => { if (e.detail === 0) pulse(); };

    });
    canvas.onpointerdown = () => { if (!paused) { canvas.focus(); pressed.add('ControlLeft'); canvas.requestPointerLock?.()?.catch?.(() => {}); } };
    const options = { signal: abort.signal };
    window.addEventListener('pointerup', () => pressed.delete('ControlLeft'), options);
    window.addEventListener('blur', pause, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, options);
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) pause(); }, options);
    document.addEventListener('mousemove', (e) => { if (!paused && document.pointerLockElement === canvas) game.player.angle += e.movementX * .003; }, options);
    const codes = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyZ','KeyS','KeyQ','KeyA','KeyD','KeyE','ControlLeft','ControlRight','ShiftLeft','ShiftRight'];
    window.addEventListener('keydown', (e) => {
      if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName) ||
        (e.target.tagName === 'BUTTON' && ['Space','Enter'].includes(e.code))) return;
      if (e.code === 'Escape') { pause(); return; }
      if (paused) return;
      if (codes.includes(e.code)) { e.preventDefault(); pressed.add(e.code); }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) use(game); }
      if (e.key === ',' && !e.repeat) { e.preventDefault(); mapToggle.checked = !mapToggle.checked; }
      if (/^Digit[1-4]$/.test(e.code)) chooseWeapon(game, Number(e.code.slice(-1)) - 1);
    }, options);
    window.addEventListener('keyup', (e) => pressed.delete(e.code), options);
    function tick(now) {
      if (disposed) return;
      const down = (...keys) => keys.some((k) => pressed.has(k) || (pulses.get(k) || 0) > game.time) ? 1 : 0;
      if (!paused) {
        step(game, { forward: down('ArrowUp','KeyW','KeyZ') - down('ArrowDown','KeyS'),
          strafe: down('KeyD','KeyE') - down('KeyA','KeyQ'), turn: down('ArrowRight') - down('ArrowLeft'),
          run: down('ShiftLeft','ShiftRight'), fire: down('ControlLeft','ControlRight') }, previous ? (now - previous) / 1000 : 0);
        for (const event of game.events.splice(0)) event.type === 'sound' ? playSound(event.id, event.volume) : notify(event.text);
        if (game.status !== 'playing') {
          paused = true; pressed.clear(); pulses.clear(); cover.hidden = false; cover.querySelector('img').hidden = true;
          cover.querySelector('[data-cover-text]').textContent = game.status === 'dead' ? 'Les jouets t’ont attrapé !' : level === catalog.episodes[episode].maps.length - 1 ? 'Bravo ! La fabrique est traversée.' : 'Niveau terminé !';
          cover.querySelector('[data-play]').textContent = game.status === 'dead' ? 'Réessayer' : level === catalog.episodes[episode].maps.length - 1 ? 'Rejouer' : 'Niveau suivant';
          if (document.pointerLockElement === canvas) document.exitPointerLock();
        }
      }
      previous = now; render(game, mapToggle.checked); updateControls(); raf = requestAnimationFrame(tick);
    }
    render(game); updateControls(); raf = requestAnimationFrame(tick);
  } catch (error) {
    if (!disposed) main.innerHTML = '<p>Bad Toys n’a pas pu être chargé. Recharge la page pour réessayer.</p><a href="#games">Retour à la caisse</a>';
  }
}
