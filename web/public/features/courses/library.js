import { escapeHtml as escape, normalizeText as normalize } from '../../shared/text.js';
import { parseOriginalLink, findOriginalDefinition } from './links.js';
import { showOriginalMedia } from './encyclopedia.js';

// This instance owns the course filters, page history and the existing adi4-v1 notebook.
export function createCourseLibrary({ main, info, toast }) {
  const $ = (selector) => document.querySelector(selector);
  let catalog;
  let level = '6';
  let subject = 'all';
  let query = '';
  let saved = [];
  let read = [];
  let pageHistory = [];
  let storageWorks = true;
  const subjects = { 1: 'Sciences de la vie et de la Terre', 2: 'Chimie', 3: 'Physique' };
  const subjectShort = { 1: 'SVT', 2: 'Chimie', 3: 'Physique' };

  try {
    const state = JSON.parse(localStorage.getItem('adi4-v1') || '{}');
    if (['6', '5', '4', '3'].includes(state.level)) level = state.level;
    saved = Array.isArray(state.saved) ? state.saved.filter((x) => typeof x === 'string') : [];
    read = Array.isArray(state.read) ? state.read.filter((x) => typeof x === 'string') : [];
  } catch {
    storageWorks = false;
  }

  function persist() {
    try {
      localStorage.setItem('adi4-v1', JSON.stringify({ level, saved, read }));
    } catch {
      storageWorks = false;
      toast(
        'La sauvegarde du navigateur est indisponible. Le carnet reste accessible pendant cette session.',
      );
    }
    $('#saved-count').textContent = saved.length;
  }
  function levelButtons() {
    return ['6', '5', '4', '3']
      .map(
        (n) =>
          `<button data-level="${n}" class="${level === n ? 'active' : ''}" aria-pressed="${level === n}">${n}<sup>e</sup></button>`,
      )
      .join('');
  }
  function courseCard(course) {
    return `<a class="course-card" href="#course/${encodeURIComponent(course.id)}"><span class="course-top"><span class="subject subject-${course.subject}">${subjectShort[course.subject]}</span><span>${read.includes(course.id) ? '✓ Lu' : course.level + 'e'}</span></span><h3>${escape(course.title)}</h3><span class="course-bottom">${escape(course.chapterTitle.toLocaleLowerCase('fr'))}<b aria-hidden="true">↗</b></span></a>`;
  }
  function science() {
    document.title = 'La station Sciences · ADI 4';
    main.innerHTML = `<section class="station-heading"><div><p class="eyebrow">LA STATION SCIENCES</p><h1>La curiosité<br>n’a pas de limites.</h1><p>Choisis ton niveau. Ouvre un cours. Explore à ton rythme.</p></div><div class="station-screen"><img src="/game/science-menu.webp" alt="Console originale de la station Sciences"><div><span class="screen-light"></span><small>STATION SCIENCES</small><strong>Prêt pour<br>la découverte ?</strong><span>LES COURS SONT OUVERTS</span></div></div></section>
  <div class="scene-links"><a class="button secondary" href="#scene/station">← La station</a><button class="button secondary" id="course-voice">Écouter Adi : les cours</button><audio id="adi-voice" preload="none" src="/game/scenes/courses.wav"></audio></div><section class="library"><div class="library-heading"><div><p class="eyebrow">LES LIVRES DE BORD</p><h2>Qu’est-ce qu’on découvre ?</h2></div><div class="levels" aria-label="Niveau scolaire">${levelButtons()}</div></div><div class="filters"><div class="subjects" aria-label="Matière"><button data-subject="all" class="${subject === 'all' ? 'active' : ''}" aria-pressed="${subject === 'all'}">Tout explorer</button>${Object.entries(
    subjectShort,
  )
    .map(
      ([id, name]) =>
        `<button data-subject="${id}" class="${subject === id ? 'active' : ''}" aria-pressed="${subject === id}">${name}</button>`,
    )
    .join(
      '',
    )}</div><label class="search"><span aria-hidden="true">⌕</span><input id="course-search" type="search" placeholder="Rechercher un cours…" aria-label="Rechercher un cours" value="${escape(query)}"></label></div><p class="result-count" id="result-count" aria-live="polite"></p><div class="course-grid" id="course-grid"></div></section><aside class="dictionary-banner"><div><p class="eyebrow">UN MOT T’ÉCHAPPE ?</p><h2>Le dictionnaire est juste ici.</h2></div><button class="button secondary" id="dictionary-open">Ouvrir le dictionnaire <span>↗</span></button></aside>`;
    const voice = $('#adi-voice');
    const voiceButton = $('#course-voice');
    voiceButton.onclick = async () => {
      if (!voice.paused) {
        voice.pause();
        return;
      }
      try {
        voice.currentTime = 0;
        await voice.play();
      } catch {
        toast('La voix n’a pas pu être lue.');
      }
    };
    voice.onplay = () => {
      voiceButton.textContent = 'Arrêter la voix';
    };
    voice.onpause = voice.onended = () => {
      voiceButton.textContent = 'Écouter Adi : les cours';
    };
    updateCourses();
    $('#course-search').oninput = (e) => {
      query = e.target.value;
      updateCourses();
    };
    $('#dictionary-open').onclick = dictionary;
  }
  function updateCourses() {
    const courses = catalog.courses.filter(
      (c) =>
        c.level === level &&
        (subject === 'all' || String(c.subject) === subject) &&
        normalize(c.title + ' ' + c.chapterTitle).includes(normalize(query)),
    );
    $('#result-count').textContent = `${courses.length} cours · niveau ${level}e`;
    $('#course-grid').innerHTML = courses.length
      ? courses.map(courseCard).join('')
      : '<div class="empty"><h3>Aucun cours dans cette sélection.</h3><p>Essaie une autre matière ou une autre recherche.</p><button class="button secondary" id="reset-filters">Réinitialiser les filtres</button></div>';
    if ($('#reset-filters'))
      $('#reset-filters').onclick = () => {
        subject = 'all';
        query = '';
        science();
      };
  }
  function notebook() {
    document.title = 'Mon carnet · ADI 4';
    const courses = catalog.courses.filter((c) => saved.includes(c.id));
    main.innerHTML = `<section class="notebook"><p class="eyebrow">TES DÉCOUVERTES, À PORTÉE DE MAIN</p><h1>Mon carnet.</h1><p>Les cours que tu veux retrouver. ${read.length} fiche${read.length > 1 ? 's' : ''} marquée${read.length > 1 ? 's' : ''} lue${read.length > 1 ? 's' : ''}.</p><div class="course-grid">${courses.length ? courses.map(courseCard).join('') : '<div class="empty"><span class="empty-symbol">✧</span><h2>Tout commence par une découverte.</h2><p>Ouvre un cours et ajoute-le à ton carnet pour le retrouver ici.</p><a href="#science" class="button primary">Explorer les cours ↗</a></div>'}</div><p class="quiet">${storageWorks ? 'Carnet enregistré sur cet appareil, dans ce navigateur.' : 'Carnet disponible pour cette session ; sauvegarde locale indisponible.'}</p></section>`;
  }
  function reader(course, pageKey = course.page, anchor = '') {
    const page = catalog.pages[pageKey];
    if (!page) {
      toast('Cette page n’est pas encore disponible.');
      return;
    }
    document.title = `${course.title} · ADI 4`;
    main.innerHTML = `<section class="reader"><div class="reader-toolbar"><a href="#science" class="back-link">← Les cours</a><span>${course.level}e <span class="separator">/</span> ${subjects[course.subject]}</span><button id="save-course" class="button small ${saved.includes(course.id) ? 'selected' : 'secondary'}" aria-pressed="${saved.includes(course.id)}">${saved.includes(course.id) ? '✓ Dans mon carnet' : '+ Ajouter au carnet'}</button></div><div class="reader-layout"><aside class="reader-aside"><p class="eyebrow">FICHE DE COURS</p><h1>${escape(course.title)}</h1><p>${escape(course.chapterTitle.toLocaleLowerCase('fr'))}</p><button id="read-course" class="read-toggle" aria-pressed="${read.includes(course.id)}">${read.includes(course.id) ? '✓ Fiche marquée lue' : '○ Marquer comme lue'}</button><button id="dictionary-open" class="text-button">Consulter le dictionnaire ↗</button><p class="source-note">Texte original d’Adi 4.<br>Les liens ↗ ouvrent les compléments. Certaines illustrations et animations restent à porter.</p></aside><div class="paper">${pageKey !== course.page ? '<button class="back-link complement-back" id="page-back">← Retour à la page précédente</button><p class="eyebrow">COMPLÉMENT DU COURS</p>' : ''}<article id="course-body" class="course-body">${page.html}</article></div></div></section>`;
    $('#save-course').onclick = () => {
      saved = saved.includes(course.id)
        ? saved.filter((x) => x !== course.id)
        : [...saved, course.id];
      persist();
      const button = $('#save-course');
      button.textContent = saved.includes(course.id) ? '✓ Dans mon carnet' : '+ Ajouter au carnet';
      button.setAttribute('aria-pressed', String(saved.includes(course.id)));
      button.classList.toggle('selected', saved.includes(course.id));
    };
    $('#read-course').onclick = () => {
      read = read.includes(course.id) ? read.filter((x) => x !== course.id) : [...read, course.id];
      persist();
      $('#read-course').textContent = read.includes(course.id)
        ? '✓ Fiche marquée lue'
        : '○ Marquer comme lue';
      $('#read-course').setAttribute('aria-pressed', String(read.includes(course.id)));
    };
    $('#dictionary-open').onclick = dictionary;
    if ($('#page-back'))
      $('#page-back').onclick = () => reader(course, pageHistory.pop() || course.page);
    $('#course-body').onclick = (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      event.preventDefault();
      if (link.dataset.page) {
        const target = pageKey.split('/')[0] + '/' + link.dataset.page;
        if (target !== pageKey) pageHistory.push(pageKey);
        reader(course, target, link.dataset.anchor);
      } else if (link.dataset.media) {
        const reference = parseOriginalLink(link.dataset.media);
        if (reference.type === 7) {
          const definition = findOriginalDefinition(catalog.dictionary, reference.id);
          info(
            link.textContent.trim() || 'Le dictionnaire d’Adi',
            definition === null
              ? '<p>Cette définition originale n’a pas encore été retrouvée.</p>'
              : `<p>${escape(definition)}</p>`,
          );
          return;
        }
        showOriginalMedia(reference.id, pageKey.split('/')[0], info, (target, anchor) => {
          if (!catalog.pages[target]) {
            info('Complément', '<p>Cette page est introuvable.</p>');
            return;
          }
          pageHistory.push(pageKey);
          reader(course, target, anchor);
        }).catch(() => info('Complément multimédia', '<p>Le média est indisponible.</p>'));
      }
    };
    if (anchor)
      requestAnimationFrame(() =>
        document.getElementById('anchor-' + anchor)?.scrollIntoView({ block: 'start' }),
      );
    else window.scrollTo(0, 0);
  }
  function dictionary() {
    info(
      'Le dictionnaire d’Adi',
      '<label class="search dictionary-search"><span aria-hidden="true">⌕</span><input id="dictionary-search" type="search" placeholder="Un mot, une idée…" aria-label="Rechercher dans les définitions"></label><p id="dictionary-count" class="quiet" aria-live="polite"></p><div id="dictionary-results"></div>',
    );
    function update() {
      const term = normalize($('#dictionary-search').value);
      const results = Object.entries(catalog.dictionary).filter(([word, definition]) =>
        normalize(word + ' ' + definition).includes(term),
      );
      $('#dictionary-count').textContent =
        `${results.length} définition${results.length > 1 ? 's' : ''}${results.length > 35 ? ' · 35 premières affichées' : ''}`;
      $('#dictionary-results').innerHTML =
        results
          .slice(0, 35)
          .map(
            ([word, text]) =>
              `<section class="definition"><h3>${escape(word)}</h3><p>${escape(text)}</p></section>`,
          )
          .join('') || '<p>Aucune définition trouvée. Essaie un autre mot.</p>';
    }
    $('#dictionary-search').oninput = update;
    update();
    $('#dictionary-search').focus();
  }
  main.addEventListener('click', (event) => {
    const levelButton = event.target.closest('[data-level]');
    const subjectButton = event.target.closest('[data-subject]');
    if (levelButton) {
      level = levelButton.dataset.level;
      persist();
      science();
    }
    if (subjectButton) {
      subject = subjectButton.dataset.subject;
      science();
    }
  });

  return {
    science,
    notebook,
    get level() {
      return level;
    },
    get storageWorks() {
      return storageWorks;
    },
    openCourse(course, page = course.page, anchor = '') {
      pageHistory = [];
      reader(course, page, anchor);
    },
    load(data) {
      catalog = data;
      saved = [...new Set(saved)].filter((id) => catalog.courses.some((c) => c.id === id));
      read = [...new Set(read)].filter((id) => catalog.courses.some((c) => c.id === id));
      $('#saved-count').textContent = saved.length;
    },
  };
}
