import {
  createAtlas,
  dimensions,
  introductionSeen,
  markIntroductionSeen,
  pan,
  selectTopic,
  visibleMedia,
  zoom,
} from './engine.js';
import { escapeHtml } from '../../../shared/text.js';

const base = '/game/documents/atlas/';
const esc = escapeHtml;
const controls = [
  ['minus', 'Zoom arrière', 0, 0, 41, 20],
  ['plus', 'Zoom avant', 0, 20, 41, 24],
  ['globe', 'Le globe', 48, 0, 52, 44],
  ['maps', 'Choisir une carte', 100, 0, 55, 44],
  ['layers', 'Calques', 155, 0, 53, 44],
  ['legend', 'Légende', 208, 0, 36, 44],
  ['move', 'Déplacer la barre', 244, 0, 44, 44],
];
const icons = { 1: 1, 2: 1, 3: 103, 4: 52, 5: 52, 6: 52, 7: 103, 8: 256 };
const browserStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

export async function renderAtlas(main) {
  document.title = 'L’Atlas · ADI 4';
  main.innerHTML =
    '<section class="original-scene atlas"><div class="scene-heading"><h1>L’Atlas</h1><a class="button secondary" href="#documents">← Les documents</a></div><p role="status">Ouverture de l’Atlas…</p></section>';
  const root = main.firstElementChild,
    lifetime = new AbortController();
  let leaving = false,
    state = createAtlas(),
    drawSerial = 0,
    toolbar = { x: 300, y: 200 },
    mode = '',
    menu = '',
    legend = false,
    sound = true,
    player = null,
    lastFocus = null,
    introSeen = introductionSeen(browserStorage());
  const imageCache = new Map();
  function stopSound() {
    if (player) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      player = null;
    }
  }
  main.addEventListener(
    'sceneleave',
    () => {
      leaving = true;
      drawSerial++;
      stopSound();
      lifetime.abort();
      root.querySelectorAll('dialog').forEach((d) => d.close());
    },
    { once: true },
  );
  const on = (element, type, fn, options = {}) =>
    element.addEventListener(type, fn, { ...options, signal: lifetime.signal });
  async function getJson(name) {
    const r = await fetch(base + name, { signal: lifetime.signal });
    if (!r.ok) throw new Error('Impossible de charger les ressources de l’Atlas.');
    return r.json();
  }
  function loadImage(path) {
    if (!imageCache.has(path))
      imageCache.set(
        path,
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Image indisponible.'));
          image.src = base + path;
        }).catch((error) => {
          imageCache.delete(path);
          throw error;
        }),
      );
    return imageCache.get(path);
  }
  try {
    const [data, media] = await Promise.all([getJson('maps.json'), getJson('media.json')]);
    if (leaving) return;
    root.querySelector('[role=status]').remove();
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="atlas-actions"><label><input type="checkbox" data-sound checked> Son</label><button data-action="intro">Présentation</button><button data-action="stop">Arrêter</button><button data-action="help">Aide</button><button data-action="full">Plein écran</button><span role="status" class="atlas-status"></span></div>
      <div class="atlas-frame"><div class="atlas-stage" tabindex="0" aria-label="Atlas interactif. Flèches pour déplacer, plus et moins pour zoomer.">
        <canvas width="640" height="480" aria-label="Carte géographique"></canvas><div class="atlas-points"></div>
        <div class="atlas-tools" role="toolbar" aria-label="Navigation de l’Atlas" style="background-image:url('${base}ui/naviga-0.webp')">
        ${controls.map(([id, label, x, y, w, h]) => `<button data-action="${id}" aria-label="${label}" title="${label}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></button>`).join('')}
        <img class="atlas-topic-icon" alt="" src="${base}ui/naviga4-3.webp"></div>
        <div class="atlas-minimap" hidden><img src="${base}ui/naviga4-18.webp" alt="Planisphère de navigation"><button aria-label="Déplacer la vue sur le planisphère"><span></span></button></div><div class="atlas-menu" hidden></div><div class="atlas-legends" hidden></div>
        <div class="atlas-bottom-edge"></div><nav class="atlas-bottom" aria-label="Commandes de l’Atlas"><button data-action="print" aria-label="Imprimer la carte" title="Imprimer la carte"></button><button data-action="help" aria-label="Aide de l’Atlas" title="Aide"></button><button data-action="return" aria-label="Revenir à la carte" title="Revenir à la carte"></button><a href="#documents" aria-label="Quitter l’Atlas" title="Quitter"></a></nav>
      </div></div><p class="atlas-instructions">La loupe zoome à l’endroit où tu cliques. Fais glisser la carte pour te déplacer. Clique sur une icône pour ouvrir son document.</p>
      <dialog class="atlas-dialog" aria-labelledby="atlas-dialog-title"><div class="dialog-heading"><h2 id="atlas-dialog-title"></h2><button data-close aria-label="Fermer">×</button></div><div class="atlas-dialog-body"></div></dialog>`,
    );
    const stage = root.querySelector('.atlas-stage'),
      frame = root.querySelector('.atlas-frame'),
      canvas = root.querySelector('canvas'),
      ctx = canvas.getContext('2d'),
      points = root.querySelector('.atlas-points'),
      tools = root.querySelector('.atlas-tools'),
      popup = root.querySelector('.atlas-menu'),
      legends = root.querySelector('.atlas-legends'),
      minimap = root.querySelector('.atlas-minimap'),
      status = root.querySelector('.atlas-status'),
      dialog = root.querySelector('dialog');
    const resize = new ResizeObserver(() => {
      stage.style.transform = `scale(${frame.clientWidth / 640})`;
    });
    resize.observe(frame);
    lifetime.signal.addEventListener('abort', () => resize.disconnect(), { once: true });
    const topic = () => data.topics.find((t) => t.id === state.topic);
    const level = () => (state.level === 5 ? 'detail' : 'overview');
    function positionTools() {
      tools.style.left = `${toolbar.x}px`;
      tools.style.top = `${toolbar.y}px`;
      // N_SMAP is anchored 58 px to the right and 110 px above NAVIGA4.
      // Keeping this relation also makes the planisphère follow its handle.
      minimap.style.left = `${toolbar.x + 58}px`;
      minimap.style.top = `${toolbar.y - 110}px`;
    }
    positionTools();
    function dialogBody(title, html) {
      stopSound();
      lastFocus = document.activeElement;
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('.atlas-dialog-body').innerHTML = html;
      if (!dialog.open) dialog.showModal();
    }
    function closeDialog() {
      stopSound();
      dialog.close();
      if (lastFocus?.isConnected) lastFocus.focus();
    }
    on(dialog.querySelector('[data-close]'), 'click', closeDialog);
    on(dialog, 'cancel', (e) => {
      e.preventDefault();
      closeDialog();
    });
    function openMedia(id) {
      const entry = media.catalogue.find((e) => e.id === id);
      const resource = entry?.media || media.namedVmd?.[id];
      const path = resource?.src || resource?.image || resource?.video || resource?.audio;
      const url = path?.startsWith('/') ? path : base + path;
      if (!path) {
        dialogBody(
          entry?.title || 'Document',
          '<p>Ce document n’est pas présent dans cette édition de l’Atlas.</p>',
        );
        return;
      }
      if (/\.(mp4|webm)$/.test(path)) {
        dialogBody(
          entry?.title || id,
          `<video controls playsinline ${sound ? '' : 'muted'} src="${esc(url)}"></video>`,
        );
        player = dialog.querySelector('video');
        player.play().catch(() => {});
      } else if (/\.(flac|mp3|ogg|wav)$/.test(path)) {
        dialogBody(entry?.title || id, `<audio controls src="${esc(url)}"></audio>`);
        player = dialog.querySelector('audio');
        player.muted = !sound;
        player.play().catch(() => {});
      } else
        dialogBody(entry?.title || id, `<img src="${esc(url)}" alt="${esc(entry?.title || id)}">`);
    }
    function speak(name) {
      stopSound();
      const clip = media.namedVmd[name];
      if (!clip?.src || !sound) return;
      player = new Audio(clip.src);
      player.play().catch(() => {});
    }
    function renderLegends() {
      legends.hidden = !legend || state.level === 3;
      const source = state.overlay ? data.overlays[state.overlay] : data.maps[topic().map];
      legends.innerHTML = `<button data-action="legend" aria-label="Fermer la légende">×</button>${(source?.legends?.[level()] || []).map((l) => `<img src="${base + l.src}" alt="${esc(l.text)}">`).join('')}`;
    }
    function renderMenu() {
      popup.hidden = !menu;
      if (!menu) return;
      if (menu === 'maps')
        popup.innerHTML = `<strong>Les cartes</strong>${data.topics.map((t, i) => `<button data-topic="${t.id}" aria-pressed="${t.id === state.topic}"><img src="${base}ui/naviga4-${[3, 4, 5, 7, 8][i]}.webp" alt="">${esc(t.title)}</button>`).join('')}`;
      if (menu === 'layers')
        popup.innerHTML = `<strong>Calques</strong>${[
          ['borders', 'Frontières'],
          ['cities', 'Villes (vue détaillée)'],
          ['names', 'Légendes sur carte'],
          ['grid', 'Repères'],
          ['media', 'Documents multimédias'],
        ]
          .map(
            ([key, title]) =>
              `<label><input type="checkbox" data-toggle="${key}" ${state[key] ? 'checked' : ''}> ${title}</label>`,
          )
          .join(
            '',
          )}<hr><button data-layer="" aria-pressed="${state.overlay === null}">Aucun calque thématique</button>${topic()
          .overlays.map(
            (id) =>
              `<button data-layer="${id}" aria-pressed="${state.overlay === id}">${esc(data.overlays[id].title)}</button>`,
          )
          .join('')}`;
    }
    async function draw() {
      const serial = ++drawSerial,
        snapshot = { ...state },
        selected = topic();
      status.textContent = `${selected.title} · ${state.level === 3 ? 'Globe' : state.level === 4 ? 'Vue mondiale' : 'Vue détaillée'}`;
      stage.dataset.mode = mode;
      tools
        .querySelector('[data-action=plus]')
        .setAttribute('aria-pressed', String(mode === 'zoom'));
      tools.querySelector('[data-action=plus]').disabled = state.level === 5;
      tools.querySelector('[data-action=minus]').disabled = state.level === 3;
      tools.querySelector('[data-action=legend]').disabled = state.level === 3;
      tools.querySelector('.atlas-topic-icon').src =
        `${base}ui/naviga4-${{ 41: 3, 71: 4, 75: 5, 81: 7, 82: 8 }[state.topic]}.webp`;
      renderLegends();
      minimap.hidden = state.level !== 5;
      const marker = minimap.querySelector('span');
      marker.style.left = `${(state.x / 2688) * 168}px`;
      marker.style.top = `${(state.y / 1728) * 104}px`;
      points.innerHTML = visibleMedia(selected, snapshot)
        .map((point) => {
          const entry = media.catalogue.find((e) => e.id === point.id);
          return `<button data-media="${point.id}" aria-label="${esc(entry?.title || point.id)}" title="${esc(entry?.title || point.id)}" style="left:${point.left}px;top:${point.top}px;background-image:url('${base}ui/naviga-5.webp');background-position:-${icons[point.type] || 1}px -1px"></button>`;
        })
        .join('');
      try {
        let paths;
        if (snapshot.level === 3)
          paths = [data.globe.NM30_03.frames[Math.floor(snapshot.rotation)]];
        else {
          const key = snapshot.level === 5 ? 'detail' : 'overview';
          paths = [data.maps[selected.map][key]];
          if (snapshot.borders) paths.push(data.borders[key]);
          if (snapshot.overlay) paths.push(data.overlays[snapshot.overlay][key]);
          if (snapshot.names) paths.push(data.labels[selected.id][key]);
          if (snapshot.cities && snapshot.level === 5) paths.push(data.cities);
        }
        const images = await Promise.all(paths.filter(Boolean).map(loadImage));
        if (serial !== drawSerial || leaving) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 640, 480);
        ctx.imageSmoothingEnabled = false;
        if (snapshot.level === 3) ctx.drawImage(images[0], 163, 84);
        else
          for (const image of images) {
            const width = dimensions[snapshot.level].width;
            ctx.drawImage(image, -snapshot.x, -snapshot.y);
            ctx.drawImage(image, width - snapshot.x, -snapshot.y);
          }
        if (snapshot.grid && snapshot.level > 3) {
          ctx.strokeStyle = '#d2cb68';
          ctx.lineWidth = 1;
          const scale = dimensions[snapshot.level].height / 480;
          for (const y of [74, 202, 264, 326, 454]) {
            ctx.beginPath();
            ctx.moveTo(0, y * scale - snapshot.y);
            ctx.lineTo(640, y * scale - snapshot.y);
            ctx.stroke();
          }
        }
      } catch (error) {
        if (!leaving) status.textContent = error.message;
      }
    }
    function change(next) {
      if (state.level === 3 && next.level === 4 && !introSeen) {
        introSeen = true;
        markIntroductionSeen(browserStorage());
        speak('N_PR');
      }
      state = next;
      void draw();
    }
    function action(id) {
      if (id === 'plus') {
        mode = mode === 'zoom' ? '' : 'zoom';
        menu = '';
      }
      if (id === 'minus') {
        mode = '';
        state = zoom(state, -1);
      }
      if (id === 'globe') {
        mode = '';
        state = { ...state, level: 3, rotation: 0 };
      }
      if (id === 'maps' || id === 'layers') menu = menu === id ? '' : id;
      if (id === 'legend') legend = !legend;
      if (id === 'print') window.print();
      if (id === 'return') {
        menu = '';
        mode = '';
        legend = false;
      }
      if (id === 'intro') speak('N_PR');
      if (id === 'stop') stopSound();
      if (id === 'sound') {
        sound = !sound;
        root.querySelector('[data-sound]').checked = sound;
        if (player) player.muted = !sound;
      }
      if (id === 'help')
        dialogBody(
          'Explorer l’Atlas',
          '<p>Clique sur la loupe +, puis sur le globe ou la carte pour agrandir cette région. La loupe − revient à la vue précédente.</p><p>Fais glisser la carte pour te déplacer, ou utilise les flèches du clavier. Les touches + et − zooment au centre.</p><p>Le dessin de la carte ouvre les cinq thèmes. Les feuilles superposées donnent accès aux calques. Le bouton à rectangles colorés affiche la légende.</p><p>Les icônes de graphique, d’appareil photo et de caméra ouvrent les documents. La poignée rayée déplace la barre. Le clic droit la place près de la souris.</p>',
        );
      if (id === 'full') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else frame.requestFullscreen?.().catch(() => {});
      }
      renderMenu();
      void draw();
    }
    on(root, 'click', (e) => {
      const button = e.target.closest('button');
      if (button?.dataset.action) action(button.dataset.action);
      if (button?.dataset.topic) {
        state = selectTopic(
          state,
          data.topics.find((t) => t.id === Number(button.dataset.topic)),
        );
        menu = '';
        speak(`N${state.topic}0VO`);
        renderMenu();
        void draw();
      }
      if (button?.hasAttribute('data-layer')) {
        state = { ...state, overlay: button.dataset.layer ? Number(button.dataset.layer) : null };
        menu = '';
        renderMenu();
        void draw();
      }
      if (button?.dataset.media) openMedia(button.dataset.media);
    });
    on(root, 'change', (e) => {
      if (e.target.matches('[data-sound]')) {
        sound = e.target.checked;
        if (player) player.muted = !sound;
      }
      if (e.target.dataset.toggle)
        change({ ...state, [e.target.dataset.toggle]: e.target.checked });
    });
    const point = (e) => {
      const r = stage.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * 640) / r.width,
        y: ((e.clientY - r.top) * 480) / r.height,
      };
    };
    on(minimap.querySelector('button'), 'click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      change(
        pan(
          { ...state, x: 0, y: 0 },
          ((e.clientX - r.left) / r.width) * 2688 - 320,
          ((e.clientY - r.top) / r.height) * 1728 - 240,
        ),
      );
    });
    let drag = null;
    on(stage, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      const handle = e.target.closest('[data-action=move]');
      if (e.target !== canvas && !handle) return;
      const p = point(e);
      drag = { start: p, state, toolbar: { ...toolbar }, handle: !!handle, moved: false };
      stage.setPointerCapture(e.pointerId);
      stage.focus({ preventScroll: true });
      e.preventDefault();
    });
    on(stage, 'pointermove', (e) => {
      if (!drag) return;
      const p = point(e),
        dx = p.x - drag.start.x,
        dy = p.y - drag.start.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      if (drag.handle) {
        toolbar = {
          x: Math.max(0, Math.min(352, drag.toolbar.x + dx)),
          y: Math.max(0, Math.min(436, drag.toolbar.y + dy)),
        };
        positionTools();
      } else change(pan(drag.state, -dx, -dy));
    });
    on(stage, 'pointerup', (e) => {
      if (!drag) return;
      const previous = drag;
      drag = null;
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      if (!previous.moved && !previous.handle) {
        if (mode === 'zoom') {
          mode = '';
          change(zoom(state, 1, point(e)));
        } else if (menu) {
          menu = '';
          renderMenu();
        }
      }
    });
    on(stage, 'pointercancel', () => {
      drag = null;
    });
    on(stage, 'contextmenu', (e) => {
      e.preventDefault();
      const p = point(e);
      toolbar = { x: Math.max(0, Math.min(352, p.x - 144)), y: Math.max(0, Math.min(436, p.y)) };
      positionTools();
    });
    on(
      stage,
      'wheel',
      (e) => {
        if (e.target !== canvas) return;
        e.preventDefault();
        change(zoom(state, e.deltaY < 0 ? 1 : -1, point(e)));
      },
      { passive: false },
    );
    on(stage, 'keydown', (e) => {
      if (e.target !== stage) return;
      const moves = {
        ArrowLeft: [-50, 0],
        ArrowRight: [50, 0],
        ArrowUp: [0, -50],
        ArrowDown: [0, 50],
      };
      if (moves[e.key]) {
        e.preventDefault();
        change(pan(state, ...moves[e.key]));
      }
      if (['+', '=', '-'].includes(e.key)) {
        e.preventDefault();
        change(zoom(state, e.key === '-' ? -1 : 1));
      }
      if (e.key === 'Escape') {
        menu = '';
        mode = '';
        legend = false;
        renderMenu();
        void draw();
      }
    });
    await draw();
  } catch (error) {
    if (!leaving) root.insertAdjacentHTML('beforeend', `<p role="alert">${esc(error.message)}</p>`);
  }
}
