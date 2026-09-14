import { scenePoint, maskColor, menuOffset, spacePoint } from './engine.js';

const base = '/game/documents/';
const place = (x, y, width, height) =>
  `left:${x / 6.4}%;top:${y / 4.8}%;width:${width / 6.4}%;height:${height / 4.8}%`;
const navigation = [
  ['#internet', 'Internet', 'BARINTER'],
  ['#scene/station', 'Les matières', 'BARAPPLI'],
  ['#games', 'Les jeux', 'BARJEUX'],
  [null, 'Les outils', 'BAROUTIL'],
  ['#documents', 'Les documents', 'BARDOCS'],
  [null, 'Les animations', 'BARANIM'],
];
const toolbar = () =>
  `<div class="room-toolbar-edge" aria-hidden="true"></div><nav class="room-toolbar" aria-label="Navigation des documents">${navigation
    .map(([href, label, icon]) =>
      href
        ? `<a href="${href}" title="${label}" aria-label="${label}"><img src="/game/room/${icon}.webp" alt=""></a>`
        : `<button disabled title="${label}" aria-label="${label}"><img src="/game/room/${icon}.webp" alt=""></button>`,
    )
    .join(
      '',
    )}<button data-doc-help title="Aide" aria-label="Aide" aria-pressed="false"><img src="/game/room/BARAIDE.webp" alt=""></button><button data-doc-back title="Retour" aria-label="Retour"><img src="/game/room/BARPORTE.webp" alt=""></button></nav>`;

let catalogPromise;
function catalog() {
  return (catalogPromise ||= Promise.all(
    ['catalog.json', 'topics.json', 'astronomy.json', 'assets.json'].map(async (file) => {
      const response = await fetch(base + file);
      if (!response.ok) throw new Error(`Document indisponible : ${file}`);
      return response.json();
    }),
  ).catch((error) => {
    catalogPromise = null;
    throw error;
  }));
}

export async function renderDocuments(main, topicId = '') {
  document.title = 'Les documents · ADI 4';
  main.innerHTML =
    '<section class="original-scene documents"><div class="scene-heading"><h1>Les documents</h1><a class="button secondary" href="#room">← La chambre</a></div><p role="status">Ouverture…</p></section>';
  const root = main.firstElementChild;
  let leaving = false,
    serial = 0,
    introTimer,
    hoverTimer,
    hovered = null;
  const timers = new Set(),
    media = new Set();
  const stopMedia = () => {
    serial++;
    clearTimeout(introTimer);
    clearTimeout(hoverTimer);
    hovered = null;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    for (const player of media) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      if (player.tagName === 'AUDIO') player.remove();
    }
    media.clear();
    root.querySelectorAll('.document-animation').forEach((layer) => layer.remove());
  };
  main.addEventListener(
    'sceneleave',
    () => {
      leaving = true;
      stopMedia();
    },
    { once: true },
  );
  try {
    const [entries, topics, astronomy, resources] = await catalog();
    if (leaving) return;
    const topic = topics[topicId];
    if (topicId && !topic) {
      root.innerHTML =
        '<h1>Document introuvable</h1><a class="button" href="#documents">Les documents</a>';
      return;
    }
    root.querySelector('[role="status"]').remove();
    if (topic) {
      root.querySelector('h1').textContent = topic.title;
      document.title = `${topic.title} · ADI 4`;
    }
    const controls = document.createElement('div');
    controls.className = 'room-controls';
    controls.innerHTML =
      '<button class="button secondary" data-toggle-toolbar aria-expanded="false">Afficher les boutons</button>' +
      (topic
        ? '<label><input type="checkbox" data-doc-sound checked> Son</label><button class="button secondary" data-doc-intro>Présentation</button><button class="button secondary" data-doc-stop>Arrêter</button>'
        : '');
    root.append(controls);
    const frame = document.createElement('div');
    frame.className = `scene-frame documents-frame${topic ? '' : ' toolbar-pinned'}`;
    frame.innerHTML = `${topic ? '<canvas width="640" height="480" aria-label="Décor interactif"></canvas><div class="document-hotspots"></div><div class="document-tooltip" hidden></div>' : '<img src="/game/room/bedroom.webp" width="640" height="480" alt="La chambre d’Adi"><div class="documents-shade"></div>'}${toolbar()}`;
    root.append(frame);
    controls.querySelector('[data-toggle-toolbar]').setAttribute('aria-expanded', String(!topic));
    controls.querySelector('[data-toggle-toolbar]').textContent = topic
      ? 'Afficher les boutons'
      : 'Masquer les boutons';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = topic
      ? 'Survole le décor puis clique pour explorer.'
      : 'Choisis un document.';
    root.append(status);
    let help = false,
      sound = true;
    frame.querySelector('[data-doc-help]').onclick = (event) => {
      help = !help;
      event.currentTarget.setAttribute('aria-pressed', String(help));
      if (topic) {
        stopMedia();
        if (help) playAudio(topic.help);
      }
      status.textContent = help
        ? 'Mode explication. Clique sur ? pour revenir à l’exploration.'
        : 'Choisis un élément du décor.';
    };
    controls.querySelector('[data-toggle-toolbar]').onclick = (event) => {
      const pinned = frame.classList.toggle('toolbar-pinned');
      event.currentTarget.setAttribute('aria-expanded', String(pinned));
      event.currentTarget.textContent = pinned ? 'Masquer les boutons' : 'Afficher les boutons';
    };
    frame.querySelector('[data-doc-back]').onclick = () => {
      location.hash = topic ? 'documents' : 'room';
    };
    if (!topic) {
      const panel = document.createElement('div');
      panel.className = 'documents-menu';
      panel.innerHTML = `<img class="documents-menu-panel" src="${base}menu/0.webp" alt=""><img class="documents-menu-scroll" src="${base}menu/1.webp" alt=""><h2>Les docs</h2><div class="documents-menu-list" aria-label="Choisir un document"></div><button class="documents-menu-up" aria-label="Défiler vers le haut"></button><input type="range" class="documents-menu-range" min="0" max="${Math.max(0, entries.length - 7)}" value="0" aria-label="Défilement des documents"><button class="documents-menu-down" aria-label="Défiler vers le bas"></button>`;
      frame.append(panel);
      let offset = 0;
      const list = panel.querySelector('.documents-menu-list'),
        range = panel.querySelector('input');
      function drawMenu() {
        list.replaceChildren();
        for (const entry of entries.slice(offset, offset + 7)) {
          const button = document.createElement('button');
          button.textContent = entry.title;
          button.disabled = !entry.route;
          button.title = entry.route ? entry.title : `${entry.title} — à venir`;
          button.onclick = () => {
            if (help) status.textContent = entry.title + ' : clique pour ouvrir ce document.';
            else location.hash = entry.route;
          };
          list.append(button);
        }
        range.value = String(offset);
        panel.querySelector('.documents-menu-up').disabled = offset === 0;
        panel.querySelector('.documents-menu-down').disabled =
          offset === Math.max(0, entries.length - 7);
      }
      function scroll(amount) {
        offset = menuOffset(offset, amount, entries.length);
        drawMenu();
      }
      panel.querySelector('.documents-menu-up').onclick = () => scroll(-1);
      panel.querySelector('.documents-menu-down').onclick = () => scroll(1);
      range.oninput = () => {
        offset = Number(range.value);
        drawMenu();
      };
      panel.addEventListener(
        'wheel',
        (event) => {
          if (event.deltaY) {
            event.preventDefault();
            scroll(Math.sign(event.deltaY));
          }
        },
        { passive: false },
      );
      drawMenu();
      return;
    }
    const canvas = frame.querySelector('canvas'),
      ctx = canvas.getContext('2d');
    const hotspots = frame.querySelector('.document-hotspots'),
      tooltip = frame.querySelector('.document-tooltip');
    const images = new Map();
    async function loadImage(key, alpha = false) {
      const cacheKey = key + (alpha ? ':alpha' : '');
      if (!images.has(cacheKey))
        images.set(
          cacheKey,
          (async () => {
            const image = new Image();
            image.src = resources.images[key]?.src || key;
            await image.decode();
            if (!alpha) return image;
            const surface = document.createElement('canvas');
            surface.width = image.width;
            surface.height = image.height;
            const context = surface.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);
            const data = context.getImageData(0, 0, image.width, image.height);
            for (let i = 0; i < data.data.length; i += 4)
              if (data.data[i] === 0 && data.data[i + 1] === 0 && data.data[i + 2] === 0)
                data.data[i + 3] = 0;
            context.putImageData(data, 0, 0);
            return surface;
          })(),
        );
      return images.get(cacheKey);
    }
    async function loadMask(key) {
      const image = await loadImage(key);
      const surface = document.createElement('canvas');
      surface.width = image.width;
      surface.height = image.height;
      const context = surface.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return {
        pixels: context.getImageData(0, 0, image.width, image.height).data,
        width: image.width,
        height: image.height,
      };
    }
    function button(label, box, action) {
      const element = document.createElement('button');
      element.className = 'document-hotspot';
      element.style.cssText = place(...box);
      element.setAttribute('aria-label', label);
      element.title = label;
      element.onclick = () => {
        if (help) status.textContent = label;
        else action();
      };
      hotspots.append(element);
      return element;
    }
    function playAudio(key, loop = false) {
      const item = resources.media[key?.toUpperCase()];
      if (!item?.audio && item?.type !== 'audio') return null;
      const player = new Audio(item.audio || item.src);
      player.muted = !sound;
      player.loop = loop;
      if (loop) player.volume = 0.3;
      media.add(player);
      player.hidden = true;
      root.append(player);
      player.play().catch(() => {
        if (!leaving && sound) status.textContent = 'Clique sur Présentation pour écouter Adi.';
      });
      player.onended = () => {
        media.delete(player);
        player.remove();
      };
      return player;
    }
    function animate(key, after) {
      const item = resources.media[key?.toUpperCase()];
      if (!item?.src || item.type !== 'animation') {
        after?.();
        return;
      }
      const token = serial;
      const image = new Image();
      image.className = 'document-animation';
      image.style.cssText = place(item.x, item.y, item.width, item.height);
      image.onload = () => {
        if (leaving || token !== serial) {
          image.remove();
          return;
        }
        playAudio(key);
        const timer = setTimeout(() => {
          timers.delete(timer);
          image.remove();
          if (token === serial) after?.();
        }, item.duration * 1000);
        timers.add(timer);
      };
      image.onerror = () => {
        image.remove();
        status.textContent = 'Cette animation n’a pas pu être chargée.';
      };
      image.src = item.src + '?lecture=' + serial;
      frame.append(image);
    }
    const film = document.createElement('div');
    film.className = 'document-film';
    film.hidden = true;
    film.innerHTML =
      '<div class="document-film-window"><video controls playsinline preload="metadata"></video><button class="document-film-close" aria-label="Fermer le film">×</button></div>';
    frame.append(film);
    const video = film.querySelector('video');
    function closeFilm(resume = false) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      media.delete(video);
      film.hidden = true;
      if (resume) ambient();
    }
    film.querySelector('button').onclick = () => closeFilm(true);
    film.addEventListener('click', (event) => {
      if (event.target === film) closeFilm(true);
    });
    frame.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !film.hidden) closeFilm(true);
    });
    function playFilm(key, label) {
      const item = resources.media[key?.toUpperCase()];
      stopMedia();
      if (!item || item.type !== 'video') {
        status.textContent = 'Ce film n’a pas pu être chargé.';
        return;
      }
      tooltip.hidden = true;
      film.hidden = false;
      video.src = item.src;
      video.muted = !sound;
      video.setAttribute('aria-label', label);
      media.add(video);
      video.play().catch(() => {
        status.textContent = 'Clique sur Lecture dans le film.';
      });
      video.onerror = () => {
        status.textContent = 'Le film n’a pas pu être chargé. Tu peux réessayer.';
      };
      video.onended = () => closeFilm(true);
      film.querySelector('button').focus({ preventScroll: true });
      status.textContent = label;
    }
    controls.querySelector('[data-doc-sound]').onchange = (event) => {
      sound = event.target.checked;
      for (const player of media) player.muted = !sound;
    };
    controls.querySelector('[data-doc-stop]').onclick = () => {
      stopMedia();
      closeFilm();
      if (topicId === 'astro') { selectedConstellation = null; draw(); }
      status.textContent = 'Lecture arrêtée.';
    };
    let ambience = null;
    function ambient() {
      if (!leaving && (!ambience || !media.has(ambience)))
        ambience = playAudio(topic.ambience, true);
    }
    let mask,
      zones = topic.zones || [],
      planet = null,
      season = 1,
      direction = 1,
      allConstellations = false,
      spaceScroll = 0,
      drawSerial = 0;
    let sky,
      selectedConstellation = null;
    const sourcePoint = (event) =>
      scenePoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
    async function draw() {
      const token = ++drawSerial;
      let background = topic.background,
        nextSky,
        nextMask;
      if (topicId === 'astro') {
        nextSky = astronomy.skies.find(
          (entry) => entry.season === season && entry.direction === direction,
        );
        background = allConstellations ? nextSky.outline : nextSky.background;
        nextMask = await loadMask(nextSky.mask);
      }
      const image = await loadImage(background);
      if (leaving || token !== drawSerial) return;
      if (nextSky) {
        sky = nextSky;
        zones = sky.zones;
        mask = nextMask;
      }
      ctx.clearRect(0, 0, 640, 480);
      ctx.drawImage(image, 0, 0);
      if (topicId === 'astro') {
        const bar = await loadImage('ASTRO:0', true);
        if (leaving || token !== drawSerial) return;
        for (let i = 0; i < 4; i++)
          ctx.drawImage(
            bar,
            [16, 123, 228, 333][i],
            i + 1 === season ? 60 : 0,
            90,
            60,
            10 + 100 * i,
            0,
            90,
            60,
          );
        ctx.drawImage(bar, 439, allConstellations ? 60 : 0, 90, 60, 410, 5, 90, 60);
        ctx.drawImage(bar, 560, direction === 1 ? 2 : 63, 67, 63, 550, 0, 67, 63);
      }
      if (topicId === 'espace') {
        const timeline = await loadImage('ESPACE:2', true),
          cover = await loadImage('ESPACE:0', true),
          thumb = await loadImage('ESPACE:5', true);
        if (leaving || token !== drawSerial) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(470, 184, 170, 130);
        ctx.drawImage(
          timeline,
          72 - (33 * spaceScroll) / 100,
          44 + (83 * spaceScroll) / 100,
          170,
          130,
          470,
          184,
          170,
          130,
        );
        ctx.drawImage(cover, 470, 184, 170, 130, 470, 184, 170, 130);
        ctx.drawImage(thumb, 0, 0, 25, 22, 495, 315 + (45 * spaceScroll) / 100, 25, 22);
      }
    }
    function zoneAt(point) {
      if (topicId === 'espace') {
        if (!mask || !point || point.x < 470 || point.y < 184 || point.y >= 314) return null;
        const pixel = spacePoint(point, spaceScroll);
        return zones.find(
          (zone) => zone.color === maskColor(mask.pixels, mask.width, mask.height, pixel),
        );
      }
      return (
        mask &&
        zones.find((zone) => zone.color === maskColor(mask.pixels, mask.width, mask.height, point))
      );
    }
    function selectZone(zone) {
      if (!zone) return;
      if (help) {
        status.textContent = zone.label;
        return;
      }
      if (topicId === 'planete') {
        planet = zone;
        showPlanet(1);
      } else if (topicId === 'astro') {
        stopMedia();
        selectedConstellation = zone;
        drawConstellation(zone);
        const voice = playAudio(zone.audio);
        ambient();
        voice?.addEventListener(
          'ended',
          () => {
            if (!leaving && selectedConstellation === zone) {
              selectedConstellation = null;
              draw();
            }
          },
          { once: true },
        );
        status.textContent = zone.label;
      } else playFilm(zone.media, zone.label);
    }
    async function drawConstellation(zone, figures = true) {
      await draw();
      const token = drawSerial;
      const image = await loadImage(figures ? sky.figures : sky.lines, true);
      if (
        leaving ||
        token !== drawSerial ||
        (figures ? selectedConstellation !== zone : hovered !== zone)
      )
        return;
      ctx.drawImage(image, zone.crop[0], zone.crop[1], zone.rect[2], zone.rect[3], ...zone.rect);
    }
    async function showPlanet(tab) {
      stopMedia();
      closeFilm();
      tooltip.hidden = true;
      const token = ++drawSerial,
        current = planet;
      hotspots.replaceChildren();
      const page = topic.pages[String(current.id * 100 + tab)];
      if (!page) return;
      const [border, picture, tabBar, activeBar] = await Promise.all([
        loadImage('PLANETE:5'),
        loadImage(page.image),
        loadImage('PLANETE:2'),
        loadImage('PLANETE:3'),
      ]);
      if (leaving || token !== drawSerial) return;
      ctx.drawImage(border, 0, 0);
      ctx.drawImage(picture, 22, 57);
      ctx.drawImage(tabBar, 0, 0);
      const tabX = topic.tabs.findIndex((entry) => entry.id === tab) * 104;
      ctx.drawImage(activeBar, tabX, 0, 104, 57, tabX, 0, 104, 57);
      ctx.font = '16px AdiMenu, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'top';
      for (const label of page.labels || []) ctx.fillText(label.text, label.x, label.y);
      topic.tabs.forEach((entry, index) =>
        button(entry.label, [104 * index, 0, 104, 57], () => showPlanet(entry.id)).setAttribute(
          'aria-pressed',
          String(entry.id === tab),
        ),
      );
      frame.querySelector('[data-doc-back]').onclick = () => {
        stopMedia();
        planet = null;
        hotspots.replaceChildren();
        draw();
        frame.querySelector('[data-doc-back]').onclick = () => {
          location.hash = 'documents';
        };
      };
      playAudio(page.audio);
      status.textContent =
        current.label + ' — ' + topic.tabs.find((entry) => entry.id === tab).label;
    }
    canvas.addEventListener('pointermove', (event) => {
      if (planet) return;
      const point = sourcePoint(event),
        zone = zoneAt(point);
      if (hovered !== zone) {
        clearTimeout(hoverTimer);
        hovered = zone;
        if (topicId === 'astro' && !selectedConstellation) {
          if (zone) drawConstellation(zone, false);
          else draw();
        }
        if (!help && zone?.hoverAudio)
          hoverTimer = setTimeout(() => {
            if (!leaving && hovered === zone && film.hidden) playAudio(zone.hoverAudio);
          }, 1000);
      }
      canvas.style.cursor = zone ? 'pointer' : 'default';
      tooltip.hidden = !zone;
      if (zone) {
        tooltip.textContent = zone.label;
        tooltip.style.left = `${Math.min(480, point.x + 12) / 6.4}%`;
        tooltip.style.top = `${Math.min(410, point.y + 22) / 4.8}%`;
      }
    });
    canvas.addEventListener('pointerleave', () => {
      tooltip.hidden = true;
      clearTimeout(hoverTimer);
      hovered = null;
    });
    canvas.addEventListener('click', (event) => {
      if (!planet) selectZone(zoneAt(sourcePoint(event)));
    });
    function intro() {
      stopMedia();
      closeFilm();
      if (planet) {
        planet = null;
        hotspots.replaceChildren();
        frame.querySelector('[data-doc-back]').onclick = () => { location.hash = 'documents'; };
        draw();
      }
      if (topicId === 'astro') { selectedConstellation = null; draw(); }
      const token = serial;
      const clips = topic.intro || [];
      let index = 0;
      function next() {
        if (leaving || token !== serial) return;
        if (index >= clips.length) {
          ambient();
          return;
        }
        const key = clips[index++];
        if (resources.media[key]?.type === 'animation') animate(key, next);
        else {
          const player = playAudio(key);
          if (player) player.addEventListener('ended', next, { once: true });
          else next();
        }
      }
      next();
    }
    controls.querySelector('[data-doc-intro]').onclick = intro;
    if (topicId === 'astro') {
      for (let i = 0; i < 4; i++)
        button(['Printemps', 'Été', 'Automne', 'Hiver'][i], [10 + i * 100, 0, 90, 60], () => {
          stopMedia();
          season = i + 1;
          selectedConstellation = null;
          draw();
        });
      button('Afficher les constellations', [410, 5, 90, 60], () => {
        allConstellations = !allConstellations;
        selectedConstellation = null;
        draw();
      });
      button('Vue vers le Nord', [550, 0, 67, 30], () => {
        stopMedia();
        direction = 1;
        selectedConstellation = null;
        draw();
      });
      button('Vue vers le Sud', [550, 30, 67, 33], () => {
        stopMedia();
        direction = 2;
        selectedConstellation = null;
        draw();
      });
    } else mask = await loadMask(topicId === 'espace' ? 'ESPACE:6' : topic.mask);
    if (topicId === 'espace') {
      const scroll = (delta) => {
        spaceScroll = Math.max(0, Math.min(100, spaceScroll + delta));
        slider.value = String(spaceScroll);
        draw();
      };
      button('Avant', [496, 291, 25, 28], () => scroll(-10));
      button('Après', [496, 379, 25, 28], () => scroll(10));
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = '0';
      slider.className = 'document-space-range';
      slider.setAttribute('aria-label', 'Date de la conquête de l’espace');
      slider.oninput = () => {
        spaceScroll = Number(slider.value);
        draw();
      };
      hotspots.append(slider);
      canvas.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          scroll(Math.sign(event.deltaY) * 10);
        },
        { passive: false },
      );
    }
    await draw();
    if (leaving) return;
    const choices = document.createElement('details');
    choices.className = 'document-choices';
    choices.innerHTML = '<summary>Choisir un sujet au clavier</summary><div></div>';
    const choiceList = choices.querySelector('div');
    const allZones =
      topicId === 'astro'
        ? astronomy.skies.flatMap((sky) =>
            sky.zones.map((zone) => ({ ...zone, season: sky.season, direction: sky.direction })),
          )
        : zones;
    const seen = new Set();
    for (const zone of allZones) {
      if (seen.has(zone.label)) continue;
      seen.add(zone.label);
      const choice = document.createElement('button');
      choice.className = 'button secondary';
      choice.textContent = zone.label;
      choice.onclick = async () => {
        if (zone.season) {
          season = zone.season;
          direction = zone.direction;
          await draw();
        }
        if (!leaving) selectZone(zone);
      };
      choiceList.append(choice);
    }
    root.append(choices);
    introTimer = setTimeout(() => {
      if (!leaving) intro();
    }, 150);
  } catch (error) {
    if (!leaving) {
      stopMedia();
      root.innerHTML =
        '<h1>Les documents</h1><p role="alert">Les ressources n’ont pas pu être chargées.</p><a class="button" href="#documents">Réessayer</a>';
    }
    console.error(error);
  }
}
