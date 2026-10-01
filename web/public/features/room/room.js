import { showRoomMemo } from '../tools/notepad/memo.js';
import { startRoomIdle } from './idle.js';
import { startNativeRoom } from './native-view.js';
import { roomObjects as objects } from './interactions.js';
const actions = [
  [
    'internet',
    'Internet',
    'BARINTER',
    'Découvre la planète Internet d’Adi, avec des correspondants et des services simulés localement.',
  ],
  ['science', 'Les matières', 'BARAPPLI', 'Ouvre l’application Sciences et sa station spatiale.'],
  ['games', 'Les jeux', 'BARJEUX', 'Ouvre les jeux de la chambre d’Adi.'],
  ['tools', 'Les outils', 'BAROUTIL', 'Ouvre la calculatrice, le bloc-notes et la palette Adi.'],
  ['documents', 'Les documents', 'BARDOCS', 'Ouvre les documents sur les animaux, l’eau, l’astronomie et l’espace.'],
  ['results', 'Mes résultats', 'BARANIM', 'Consulte les résultats des applications et des classes virtuelles.'],
  ['help', 'Aide', 'BARAIDE', 'Active ou désactive les explications des boutons.'],
  ['exit', 'Sortir', 'BARPORTE', 'Reviens à l’accueil.'],
];
export async function renderRoom(main, info) {
  document.title = 'La chambre d’Adi · ADI 4';
  main.innerHTML = `<section class="original-scene"><div class="scene-heading"><h1>La chambre d’Adi</h1><button class="button secondary" id="room-show-toolbar" aria-expanded="false">Afficher les boutons</button></div>
  <div class="scene-frame room-frame"><img src="/game/room/bedroom.webp" width="640" height="480" alt="La chambre originale d’Adi, avec son bureau, ses jouets et son télescope">
    <img class="room-layer room-actor" alt="Adi" hidden>
    <img class="room-layer room-animation" alt="" hidden>
    <div class="room-objects">${objects.map((o) => `<button class="room-object" data-room-object="${o.id}" aria-label="${o.label}" title="${o.label}" style="left:${o.rect[0] / 6.4}%;top:${o.rect[1] / 4.8}%;width:${o.rect[2] / 6.4}%;height:${o.rect[3] / 4.8}%"></button>`).join('')}<button class="room-object" data-room-object="adi" aria-label="Adi" title="Adi" style="left:40.15%;top:39.16%;width:16%;height:45.42%"></button></div>
    <div class="room-toolbar-edge" aria-hidden="true"></div>
    <nav class="room-toolbar" aria-label="Les activités de la chambre">${actions.map(([id, label, asset]) => `<button data-room-action="${id}" aria-label="${label}" title="${label}"><img src="/game/room/${asset}.webp" data-still="/game/room/${asset}.webp" data-motion="/game/room/${asset}-motion.webp" alt=""><span>${label}</span></button>`).join('')}</nav>
  </div><p id="room-hint" role="status">Descends la souris tout en bas de la chambre pour faire apparaître les huit boutons.</p>
  <div class="room-controls"><button class="button secondary" id="room-stop" hidden>Arrêter l’animation</button><label><input type="checkbox" id="room-outline"> Repérer les objets</label></div>
  <audio id="room-audio" preload="none"></audio>
  <p class="development-note">Décor, gros plans et animations d’origine. Les réactions et déplacements suivent les scénarios extraits du jeu.</p></section>`;
  const root = main.firstElementChild,
    frame = root.querySelector('.room-frame'),
    hint = root.querySelector('#room-hint');
  showRoomMemo(frame);
  let help = false;
  const actor = root.querySelector('.room-actor'),
    animation = root.querySelector('.room-animation');
  const audio = root.querySelector('audio'),
    stop = root.querySelector('#room-stop');
  let clips = {},
    timer,
    serial = 0,
    idleActor,
    ambient = { reset() {}, stop() {} },
    nativeReady = false,
    leaving = false,
    explicitPlaying = false,
    stopIdle = () => {};
  const position = (image, clip) => {
    image.style.left = `${clip.x / 6.4}%`;
    image.style.top = `${clip.y / 4.8}%`;
    image.style.width = `${clip.width / 6.4}%`;
    image.style.height = `${clip.height / 4.8}%`;
  };
  const idleBase = '/game/room/activities/crate-adi.webp';
  const resumeIdle = () => {
    stopIdle();
    if (!nativeReady && !leaving && idleActor && !actor.hidden) stopIdle = startRoomIdle(actor, idleActor, idleBase);
  };
  main.addEventListener('sceneleave', () => {
    leaving = true;
    serial++;
    clearTimeout(timer);
    ambient.stop();
    stopIdle();
    actor.onload = actor.onerror = animation.onload = animation.onerror = null;
    audio.pause();
  }, { once: true });
  const reset = () => {
    ambient.reset();
    explicitPlaying = false;
    serial++;
    clearTimeout(timer);
    stopIdle();
    actor.onload = null;
    actor.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    animation.hidden = true;
    stop.hidden = true;
    if (clips.ADIPZD12) {
      position(actor, idleActor || clips.ADIPZD12);
      actor.src = idleActor ? idleBase : '/game/room/ADIPZD12.webp';
    }
    resumeIdle();
  };
  const play = (name) => {
    reset();
    const clip = clips[name];
    if (!clip) {
      hint.textContent = 'Les animations ne sont pas encore disponibles.';
      return;
    }
    stopIdle();
    explicitPlaying = true;
    const target = name === 'ADIPZD12' ? actor : animation,
      token = serial;
    position(target, clip);
    target.onload = () => {
      if (token !== serial || !root.isConnected) return;
      target.onload = null;
      target.hidden = false;
      stop.hidden = false;
      if (clip.audio) {
        audio.src = `/game/room/${name}.wav`;
        audio.play().catch(() => {
          hint.textContent = 'Le son n’a pas pu démarrer.';
        });
      }
      timer = setTimeout(() => {
        if (root.isConnected) reset();
      }, clip.duration);
    };
    target.onerror = () => {
      if (token !== serial || !root.isConnected) return;
      reset();
      hint.textContent = 'Cette animation n’a pas pu être chargée.';
    };
    target.src = `/game/room/${name}-motion.webp?play=${serial}`;
  };
  stop.onclick = reset;
  root.querySelector('#room-outline').onchange = (e) =>
    frame.classList.toggle('room-outlines', e.target.checked);
  root.querySelectorAll('[data-room-object]').forEach(
    (button) =>
      (button.onclick = () => {
        const object = objects.find((o) => o.id === button.dataset.roomObject);
        if (help) {
          hint.textContent = object?.route
            ? `${object.label} : clique pour ouvrir son menu.`
            : object
              ? `${object.label} : ces outils restent à recréer.`
              : 'Clique sur Adi pour l’écouter raconter une blague.';
          return;
        }
        if (object?.unavailable) {
          reset();
          info(object.unavailable, '<p>La calculatrice, le bloc-notes et la palette de la chambre restent à recréer.</p>');
          return;
        }
        if (object?.route) {
          reset();
          location.hash = object.route;
          return;
        }
        hint.textContent = 'Adi';
        if (ambient.speak?.()) return;
        play('ADIPZD12');
      }),
  );
  const toggle = root.querySelector('#room-show-toolbar');
  toggle.onclick = () => {
    const open = frame.classList.toggle('toolbar-pinned');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Masquer les boutons' : 'Afficher les boutons';
  };
  root.querySelectorAll('[data-room-action]').forEach((button) => {
    const image = button.querySelector('img');
    button.onpointerenter = button.onfocus = () => (image.src = image.dataset.motion);
    button.onpointerleave = button.onblur = () => (image.src = image.dataset.still);
    button.onclick = () => {
      const [id, label, , description] = actions.find((a) => a[0] === button.dataset.roomAction);
      if (id === 'help') {
        help = !help;
        if (help) reset();
        button.setAttribute('aria-pressed', String(help));
        hint.textContent = help
          ? 'Mode explication : clique sur un bouton pour lire son rôle. Clique sur ? pour quitter ce mode.'
          : 'Aide désactivée. Choisis une activité.';
        return;
      }
      if (help) {
        hint.textContent = description;
        return;
      }
      if (id === 'science') location.hash = 'scene/station';
      else if (id === 'games') location.hash = 'games';
      else if (id === 'tools') location.hash = 'tools';
      else if (id === 'documents') location.hash = 'documents';
      else if (id === 'internet') location.hash = 'internet';
      else if (id === 'exit') location.hash = 'welcome';
      else if (id === 'results') location.hash = 'room/results';
      else info(label, `<p>${description}</p>`);
    };
  });
  try {
    const [response, idleResponse, nativeResponse, textResponse, trajectoryResponse] = await Promise.all([
      fetch('/game/room/clips.json'),
      fetch('/game/room/activities/catalog.json'),
      fetch('/game/room/native/catalog.json').catch(() => null),
      fetch('/game/room/native/texts.json').catch(() => null),
      fetch('/game/room/native/trajectories.json').catch(() => null),
    ]);
    if (!response.ok) throw new Error('Room assets unavailable');
    clips = await response.json();
    if (!root.isConnected) return;
    if (idleResponse.ok) {
      const catalog = await idleResponse.json();
      const standing = catalog.artwork.crateActor;
      // Same standing VMD coordinates as the crate; remove its close-up offset.
      idleActor = { ...standing, x: standing.x + 228, y: standing.y + 6 };
    }
    if (!root.isConnected) return;
    actor.hidden = false;
    reset();
    if (nativeResponse?.ok) {
      const catalog = await nativeResponse.json();
      const texts = textResponse?.ok ? await textResponse.json() : {};
      const trajectories = trajectoryResponse?.ok ? await trajectoryResponse.json() : {};
      if (!root.isConnected || leaving) return;
      nativeReady = true;
      stopIdle();
      ambient = startNativeRoom({ frame, actorImage: actor, hint, catalog, texts, trajectories,
        canPlay: () => !explicitPlaying && !help &&
          !document.querySelector('dialog[open]'),
      });
    }
  } catch {
    if (root.isConnected)
      hint.textContent = 'Le décor est disponible, mais les animations n’ont pas pu être chargées.';
  }
}
