import { scenes, renderScene } from '../features/science/scenes.js';
import { renderSimulations, renderSimulation } from '../features/science/simulations.js';
import { renderEncyclopedia } from '../features/courses/encyclopedia.js';
import { renderRoom } from '../features/room/room.js';
import { renderGames } from '../features/room/games.js';
import { renderRoomActivity } from '../features/room/activities.js';
import { renderSokoban } from '../features/games/sokoban/view.js';
import { renderWGob3 } from '../features/games/wgob3/view.js';
import { renderMrMatt } from '../features/games/mrmatt/view.js';
import { renderBadToys } from '../features/games/badtoys/view.js';
import { renderWelcome } from './welcome.js';
import { renderInternet } from '../features/internet/view.js';

export function createRouter({ main, info, toast, catalog, library }) {
  return function route() {
    main.dispatchEvent(new Event('sceneleave'));
    main.querySelectorAll('audio,video').forEach((media) => media.pause());
    const hash = location.hash.slice(1) || 'welcome';
    let active = hash;
    if (hash.startsWith('course/')) {
      let id;
      try {
        id = decodeURIComponent(hash.slice(7));
      } catch {
        id = '';
      }
      const course = catalog.courses.find((c) => c.id === id);
      if (course) {
        library.openCourse(course);
        active = 'science';
      } else {
        location.hash = 'science';
        toast('Cette fiche est introuvable. Voici les cours disponibles.');
        return;
      }
    } else if (hash === 'encyclopedia') {
      renderEncyclopedia(
        main,
        ['6', '5'].includes(library.level) ? 'Adi410Sci65' : 'Adi410Sci43',
        info,
        (page, anchor) => {
          const course =
            catalog.courses.find((c) => c.page === page) ||
            catalog.courses.find((c) => c.level === library.level);
          if (course && catalog.pages[page]) {
            library.openCourse(course, page, anchor);
          }
        },
      );
      active = 'science';
    } else if (hash === 'simulations') {
      renderSimulations(main);
      active = 'science';
    } else if (/^simulation\/\d+$/.test(hash)) {
      renderSimulation(main, hash.slice(11));
      active = 'science';
    } else if (hash === 'scene/greenhouse') {
      renderSimulation(main, '2');
      active = 'science';
    } else if (hash.startsWith('scene/') && scenes[hash.slice(6)]) {
      renderScene(main, hash.slice(6));
      active = 'science';
    } else if (hash === 'science') library.science();
    else if (hash === 'notebook') library.notebook();
    else if (hash === 'games') {
      renderGames(main, info);
      active = 'room';
    } else if (hash === 'radio') {
      renderRoomActivity(main, 'radio', info);
      active = 'room';
    } else if (hash === 'game/sokoban') {
      renderSokoban(main);
      active = 'room';
    } else if (hash === 'game/wgob3') {
      renderWGob3(main);
      active = 'room';
    } else if (hash === 'game/mrmatt1') {
      renderMrMatt(main);
      active = 'room';
    } else if (/^game\/bt3d_[1-4]$/.test(hash)) {
      renderBadToys(main, hash.slice(-1));
      active = 'room';
    } else if (hash === 'internet') {
      renderInternet(main);
      active = 'room';
    } else if (hash === 'welcome') {
      renderWelcome(main);
      active = 'room';
    } else {
      renderRoom(main, info);
      active = 'room';
    }
    document.querySelectorAll('[data-nav]').forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === active);
      if (link.dataset.nav === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  };
}
