import { roomCloseups, chooseRoomVoice } from './interactions.js';
import { closeupAssets, createCloseupPlayer, placeRoomMedia } from './closeup-player.js';
import { escapeHtml as escape } from '../../shared/text.js';

let catalogPromise;
export function loadRoomCloseupCatalog() {
  return catalogPromise ||= fetch(closeupAssets + 'catalog.json').then(response => {
    if (!response.ok) throw new Error('Les médias de la chambre sont indisponibles.');
    return response.json();
  }).catch(error => { catalogPromise = null; throw error; });
}

export async function renderRoomCloseup(main, id) {
  if (id !== 'results' && !roomCloseups[id]) { location.hash = 'room'; return; }
  const config = roomCloseups[id] || { title: 'Mes résultats', image: 1 };
  document.title = `${config.title} · ADI 4`;
  main.innerHTML = `<section class="original-scene room-closeup"><div class="scene-heading"><h1>${config.title}</h1><a class="button secondary" href="#room">← La chambre</a></div>
    <div class="scene-frame room-closeup-frame"><img src="/game/room/image-${config.image}.webp" width="640" height="480" alt="${config.title} — gros plan original"></div>
    <div class="room-controls"><button class="button secondary" data-room-listen${id === 'results' ? ' hidden' : ''}>Écouter Adi</button><button class="button primary" data-room-continue${config.menu || config.rewards || id === 'results' ? ' hidden' : ''}>Ouvrir le document</button><button class="button secondary" data-room-sound aria-pressed="true">Désactiver le son</button></div>
    <p role="status" class="room-closeup-status">Ouverture…</p></section>`;
  const root = main.firstElementChild, frame = root.querySelector('.scene-frame');
  const status = root.querySelector('[role="status"]');
  let leaving = false, generation = 0, idleTimer, player, previousVoice;
  let introPlaying = false, opening = false;
  main.addEventListener('sceneleave', () => {
    leaving = true; generation++; clearTimeout(idleTimer); player?.dispose();
  }, { once: true });
  try {
    const catalog = await loadRoomCloseupCatalog();
    if (leaving || !root.isConnected) return;
    player = createCloseupPlayer(frame, catalog, () => {
      status.textContent = 'Clique sur « Écouter Adi » pour relancer la présentation.';
    });
    const restorePose = () => {
      if (config.pose) player.still(catalog.poses[config.pose], config.offset);
    };
    const scheduleIdle = () => {
      clearTimeout(idleTimer);
      if (!config.pose || leaving || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      idleTimer = setTimeout(async () => {
        if (leaving || introPlaying || opening) return;
        if (!document.hidden) {
          const names = catalog.idle[config.pose];
          const token = generation;
          await player.play(names[Math.floor(Math.random() * names.length)], { offset: config.offset });
          if (leaving || token !== generation) return;
          restorePose();
        }
        scheduleIdle();
      }, 2000 + Math.random() * 4000);
    };
    const cancel = () => {
      generation++; clearTimeout(idleTimer); introPlaying = false;
      player.stop('actor'); player.stop('object'); restorePose();
    };
    const openDocument = async () => {
      cancel();
      // DOC calls LIBADI command 18 before the document transition: remove
      // the whole actor, including the pixels outside the VMD rectangle.
      player.stop('actor');
      const token = generation;
      opening = true;
      status.textContent = `Ouverture : ${config.title}`;
      if (config.transition) {
        const completed = await player.play(config.transition, { track: 'object' });
        if (leaving || token !== generation) return;
        if (!completed) { opening = false; restorePose(); scheduleIdle(); return; }
      }
      if (!leaving && token === generation) location.hash = `document/${id}`;
    };
    const speak = async () => {
      if (opening || leaving) return;
      cancel(); introPlaying = true;
      const token = generation;
      previousVoice = chooseRoomVoice(config.voices, previousVoice);
      status.textContent = 'Adi présente cette activité.';
      const completed = await player.play(previousVoice, { offset: config.offset });
      if (leaving || token !== generation) return;
      introPlaying = false; restorePose();
      if (!completed) { scheduleIdle(); return; }
      if (!config.menu && !config.rewards) return openDocument();
      if (config.rewards) {
        const completed = await player.play(config.transition, { track: 'object' });
        if (leaving || token !== generation) return;
        if (completed) player.still({ ...catalog.clips.CBONPOIN, file: 'rewards-panel.webp' }, [0, 0], 'object');
        status.textContent = 'Les bons points récompensent les exercices des matières. Ces exercices ne sont pas encore disponibles dans cette version.';
      } else status.textContent = 'Choisis une expérience dans la malle.';
      scheduleIdle();
    };
    root.querySelector('[data-room-listen]').onclick = speak;
    root.querySelector('[data-room-continue]').onclick = openDocument;
    root.querySelector('[data-room-sound]').onclick = (event) => {
      const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
      event.currentTarget.setAttribute('aria-pressed', String(enabled));
      event.currentTarget.textContent = enabled ? 'Désactiver le son' : 'Activer le son';
      player.mute(!enabled);
    };
    restorePose();
    const escapeKey = event => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) location.hash = 'room';
    };
    document.addEventListener('keydown', escapeKey);
    main.addEventListener('sceneleave', () => document.removeEventListener('keydown', escapeKey), { once: true });
    if (id === 'results') {
      frame.classList.add('room-results-frame');
      player.still(catalog.poses.D);
      const overlay = document.createElement('div');
      overlay.className = 'room-results';
      overlay.innerHTML = `<img src="${closeupAssets}list-panel.webp" alt=""><h2>Mes résultats</h2><div class="room-results-list"><button data-result="applications">Applications <span>0</span></button><button data-result="classes">Classes virtuelles <span>0</span></button></div>`;
      frame.append(overlay);
      status.textContent = 'Aucun résultat d’exercice enregistré. Les exercices notés et les classes virtuelles restent à recréer.';
      overlay.querySelectorAll('button').forEach(button => button.onclick = () => {
        status.textContent = button.dataset.result === 'applications'
          ? 'Les cours et les simulations sont disponibles. Ils ne produisent pas de notes d’exercice.'
          : 'Les classes virtuelles ne sont pas disponibles dans cette version.';
      });
      return;
    }
    if (config.menu) {
      const panel = document.createElement('img');
      panel.className = 'room-closeup-layer room-malle-panel';
      panel.src = closeupAssets + 'malle-panel.webp'; panel.alt = '';
      panel.style.cssText = placeRoomMedia(catalog.clips.CMENUMAL);
      const heading = document.createElement('h2');
      heading.className = 'room-malle-title'; heading.textContent = config.title;
      const choices = document.createElement('div'); choices.className = 'room-malle-choices';
      choices.innerHTML = catalog.experiments.map(item => `<button class="activity-choice" data-experiment="${item.id}" title="${escape(item.title)}" aria-label="${escape(item.title)}"><img src="${closeupAssets}${item.image}" alt=""><span class="activity-tooltip">${escape(item.title)}</span></button>`).join('');
      frame.append(panel, heading, choices);
      choices.querySelectorAll('button').forEach(button => button.onclick = async () => {
        cancel(); opening = true;
        const token = generation;
        choices.hidden = heading.hidden = panel.hidden = true;
        const complete = await player.play('CMENUMA2', { track: 'object' });
        if (leaving || token !== generation) return;
        if (complete) location.hash = `document/${button.dataset.experiment}`;
        else { opening = false; choices.hidden = heading.hidden = panel.hidden = false; }
      });
      choices.hidden = heading.hidden = panel.hidden = true;
      opening = true;
      await player.play('CMENUMAL', { track: 'object' });
      if (leaving) return;
      opening = false;
      choices.hidden = heading.hidden = panel.hidden = false;
    }
    await speak();
  } catch (error) {
    if (!leaving && root.isConnected) status.textContent = error.message;
  }
}
