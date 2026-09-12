import {scenes, renderScene} from './scenes.js';
import {renderGreenhouse} from './greenhouse.js';
import {renderSimulations,renderSimulation} from './simulations.js';
import {renderEncyclopedia,showOriginalMedia} from './encyclopedia.js';
import {parseOriginalLink,findOriginalDefinition} from './course-links.js';
import {renderRoom} from './room.js';
import {renderGames} from './games.js';
import {renderRoomActivity} from './room-activities.js';
import {renderSokoban} from './sokoban.js';
import {renderWGob3} from './wgob3.js';
import {renderMrMatt} from './mrmatt1.js';
const main = document.querySelector('#main');
const dialog = document.querySelector('#info-dialog');
const $ = (selector) => document.querySelector(selector);
const escape = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
let catalog;
let level = '6';
let subject = 'all';
let query = '';
let saved = [];
let read = [];
let currentCourse;
let pageHistory = [];
let storageWorks = true;
let toastTimer;
const subjects = {1:'Sciences de la vie et de la Terre', 2:'Chimie', 3:'Physique'};
const subjectShort = {1:'SVT', 2:'Chimie', 3:'Physique'};

try {
  const state = JSON.parse(localStorage.getItem('adi4-v1') || '{}');
  if (['6','5','4','3'].includes(state.level)) level = state.level;
  saved = Array.isArray(state.saved) ? state.saved.filter(x => typeof x === 'string') : [];
  read = Array.isArray(state.read) ? state.read.filter(x => typeof x === 'string') : [];
} catch { storageWorks = false; }

function persist() {
  try { localStorage.setItem('adi4-v1', JSON.stringify({level, saved, read})); }
  catch { storageWorks = false; toast('La sauvegarde du navigateur est indisponible. Le carnet reste accessible pendant cette session.'); }
  $('#saved-count').textContent = saved.length;
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000);
}
function info(title, html) {
  $('#dialog-title').textContent = title;
  $('#dialog-content').innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
$('#dialog-close').onclick = () => dialog.close();
dialog.addEventListener('close',()=>dialog.querySelectorAll('audio,video').forEach(media=>media.pause()));
$('#about-button').onclick = () => info('Une nouvelle vie pour Adi 4', `<p>Cette version utilise les images et les textes de ton jeu original.</p><p><strong>Déjà accessible :</strong> une première chambre avec sa barre animée, Sokoban et ses 15 niveaux, les décors originaux de la station, 14 simulations avec leurs calculs, animations et voix, l’encyclopédie illustrée et ses films, les cours des quatre niveaux, le dictionnaire et un carnet enregistré sur cet appareil.</p><p><strong>À venir :</strong> les objets et surprises de la chambre, les séquences complètes d’Adi, les exercices et les autres jeux. La chambre utilise encore une capture de référence avec Adi immobile.</p><p>Les textes sont ceux de l’édition originale de 1998–1999. Leur contenu n’a pas été actualisé. Les illustrations et médias liés aux cours ne sont pas encore tous disponibles.</p><p>Le carnet web est indépendant des sauvegardes du jeu d’origine. ${storageWorks ? 'Il est enregistré dans ce navigateur.' : 'Le stockage du navigateur est actuellement indisponible.'}</p>`);

function home() {
  document.title = 'Chez Adi · ADI 4';
  main.innerHTML = `<section class="welcome"><div class="welcome-copy"><p class="eyebrow">BIENVENUE À LA MAISON</p><h1>De retour<br>chez <span>Adi.</span></h1><p class="intro">Un vieil ami. Tout un monde à redécouvrir.<br>Ta prochaine découverte commence ici.</p><a class="button primary" href="#scene/station">Entrer dans la station Sciences <span>↗</span></a><p class="quiet">6e · 5e · 4e · 3e</p></div><div class="adi-portrait"><img src="/game/adi.webp" alt="Adi, dans l’illustration originale du jeu"><span class="portrait-label">TON COMPAGNON DE DÉCOUVERTE</span><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span></div><span class="hero-number" aria-hidden="true">04</span></section>
  <section class="destinations" aria-label="Les lieux d’Adi"><article class="destination room-card"><img src="/game/room.webp" alt="Le télescope et le bureau de la chambre, illustration d’installation originale"><div><p class="eyebrow">01 / LE POINT DE DÉPART</p><h2>La chambre d’Adi</h2><p>Le bureau, les objets, les petits rituels…<br>On prépare leur retour.</p><span class="tag muted">Pièce interactive à venir</span></div></article><a class="destination science-card" href="#scene/station"><img src="/game/space.webp" alt="Planètes et fusée dans l’illustration originale"><div><p class="eyebrow">02 / LE GOÛT DE COMPRENDRE</p><h2>La station Sciences <span>↗</span></h2><p>Le vivant, la matière, les phénomènes.<br>Ouvre les cours de ton niveau.</p><span class="tag">Explorer la station</span></div></a></section><p class="development-note">Accueil provisoire illustré avec les images originales. La chambre et ses interactions seront reconstruites dans une prochaine étape.</p>`;
}

function levelButtons() {
  return ['6','5','4','3'].map(n => `<button data-level="${n}" class="${level === n ? 'active' : ''}" aria-pressed="${level === n}">${n}<sup>e</sup></button>`).join('');
}
function courseCard(course) {
  return `<a class="course-card" href="#course/${encodeURIComponent(course.id)}"><span class="course-top"><span class="subject subject-${course.subject}">${subjectShort[course.subject]}</span><span>${read.includes(course.id) ? '✓ Lu' : course.level + 'e'}</span></span><h3>${escape(course.title)}</h3><span class="course-bottom">${escape(course.chapterTitle.toLocaleLowerCase('fr'))}<b aria-hidden="true">↗</b></span></a>`;
}
function science() {
  document.title = 'La station Sciences · ADI 4';
  main.innerHTML = `<section class="station-heading"><div><p class="eyebrow">LA STATION SCIENCES</p><h1>La curiosité<br>n’a pas de limites.</h1><p>Choisis ton niveau. Ouvre un cours. Explore à ton rythme.</p></div><div class="station-screen"><img src="/game/science-menu.webp" alt="Console originale de la station Sciences"><div><span class="screen-light"></span><small>STATION SCIENCES</small><strong>Prêt pour<br>la découverte ?</strong><span>LES COURS SONT OUVERTS</span></div></div></section>
  <div class="scene-links"><a class="button secondary" href="#scene/station">← La station</a><button class="button secondary" id="course-voice">Écouter Adi : les cours</button><audio id="adi-voice" preload="none" src="/game/scenes/courses.wav"></audio></div><section class="library"><div class="library-heading"><div><p class="eyebrow">LES LIVRES DE BORD</p><h2>Qu’est-ce qu’on découvre ?</h2></div><div class="levels" aria-label="Niveau scolaire">${levelButtons()}</div></div><div class="filters"><div class="subjects" aria-label="Matière"><button data-subject="all" class="${subject === 'all' ? 'active' : ''}" aria-pressed="${subject === 'all'}">Tout explorer</button>${Object.entries(subjectShort).map(([id,name])=>`<button data-subject="${id}" class="${subject === id ? 'active' : ''}" aria-pressed="${subject === id}">${name}</button>`).join('')}</div><label class="search"><span aria-hidden="true">⌕</span><input id="course-search" type="search" placeholder="Rechercher un cours…" aria-label="Rechercher un cours" value="${escape(query)}"></label></div><p class="result-count" id="result-count" aria-live="polite"></p><div class="course-grid" id="course-grid"></div></section><aside class="dictionary-banner"><div><p class="eyebrow">UN MOT T’ÉCHAPPE ?</p><h2>Le dictionnaire est juste ici.</h2></div><button class="button secondary" id="dictionary-open">Ouvrir le dictionnaire <span>↗</span></button></aside>`;
  const voice=$('#adi-voice');
  const voiceButton=$('#course-voice');
  voiceButton.onclick=async()=>{
    if(!voice.paused) {voice.pause();return;}
    try {voice.currentTime=0;await voice.play();} catch {toast('La voix n’a pas pu être lue.');}
  };
  voice.onplay=()=>{voiceButton.textContent='Arrêter la voix';};
  voice.onpause=voice.onended=()=>{voiceButton.textContent='Écouter Adi : les cours';};
  updateCourses();
  $('#course-search').oninput = (e) => { query = e.target.value; updateCourses(); };
  $('#dictionary-open').onclick = dictionary;
}
function updateCourses() {
  const courses = catalog.courses.filter(c => c.level === level && (subject === 'all' || String(c.subject) === subject) && normalize(c.title + ' ' + c.chapterTitle).includes(normalize(query)));
  $('#result-count').textContent = `${courses.length} cours · niveau ${level}e`;
  $('#course-grid').innerHTML = courses.length ? courses.map(courseCard).join('') : '<div class="empty"><h3>Aucun cours dans cette sélection.</h3><p>Essaie une autre matière ou une autre recherche.</p><button class="button secondary" id="reset-filters">Réinitialiser les filtres</button></div>';
  if ($('#reset-filters')) $('#reset-filters').onclick = () => { subject = 'all'; query = ''; science(); };
}
function notebook() {
  document.title = 'Mon carnet · ADI 4';
  const courses = catalog.courses.filter(c => saved.includes(c.id));
  main.innerHTML = `<section class="notebook"><p class="eyebrow">TES DÉCOUVERTES, À PORTÉE DE MAIN</p><h1>Mon carnet.</h1><p>Les cours que tu veux retrouver. ${read.length} fiche${read.length > 1 ? 's' : ''} marquée${read.length > 1 ? 's' : ''} lue${read.length > 1 ? 's' : ''}.</p><div class="course-grid">${courses.length ? courses.map(courseCard).join('') : '<div class="empty"><span class="empty-symbol">✧</span><h2>Tout commence par une découverte.</h2><p>Ouvre un cours et ajoute-le à ton carnet pour le retrouver ici.</p><a href="#science" class="button primary">Explorer les cours ↗</a></div>'}</div><p class="quiet">${storageWorks ? 'Carnet enregistré sur cet appareil, dans ce navigateur.' : 'Carnet disponible pour cette session ; sauvegarde locale indisponible.'}</p></section>`;
}
function reader(course, pageKey = course.page, anchor = '') {
  const page = catalog.pages[pageKey];
  if (!page) { toast('Cette page n’est pas encore disponible.'); return; }
  currentCourse = course;
  document.title = `${course.title} · ADI 4`;
  main.innerHTML = `<section class="reader"><div class="reader-toolbar"><a href="#science" class="back-link">← Les cours</a><span>${course.level}e <span class="separator">/</span> ${subjects[course.subject]}</span><button id="save-course" class="button small ${saved.includes(course.id) ? 'selected' : 'secondary'}" aria-pressed="${saved.includes(course.id)}">${saved.includes(course.id) ? '✓ Dans mon carnet' : '+ Ajouter au carnet'}</button></div><div class="reader-layout"><aside class="reader-aside"><p class="eyebrow">FICHE DE COURS</p><h1>${escape(course.title)}</h1><p>${escape(course.chapterTitle.toLocaleLowerCase('fr'))}</p><button id="read-course" class="read-toggle" aria-pressed="${read.includes(course.id)}">${read.includes(course.id) ? '✓ Fiche marquée lue' : '○ Marquer comme lue'}</button><button id="dictionary-open" class="text-button">Consulter le dictionnaire ↗</button><p class="source-note">Texte original d’Adi 4.<br>Les liens ↗ ouvrent les compléments. Certaines illustrations et animations restent à porter.</p></aside><div class="paper">${pageKey !== course.page ? '<button class="back-link complement-back" id="page-back">← Retour à la page précédente</button><p class="eyebrow">COMPLÉMENT DU COURS</p>' : ''}<article id="course-body" class="course-body">${page.html}</article></div></div></section>`;
  $('#save-course').onclick = () => {
    saved = saved.includes(course.id) ? saved.filter(x=>x!==course.id) : [...saved, course.id];
    persist();
    const button = $('#save-course');
    button.textContent = saved.includes(course.id) ? '✓ Dans mon carnet' : '+ Ajouter au carnet';
    button.setAttribute('aria-pressed', String(saved.includes(course.id)));
    button.classList.toggle('selected', saved.includes(course.id));
  };
  $('#read-course').onclick = () => {
    read = read.includes(course.id) ? read.filter(x=>x!==course.id) : [...read, course.id];
    persist();
    $('#read-course').textContent = read.includes(course.id) ? '✓ Fiche marquée lue' : '○ Marquer comme lue';
    $('#read-course').setAttribute('aria-pressed', String(read.includes(course.id)));
  };
  $('#dictionary-open').onclick = dictionary;
  if ($('#page-back')) $('#page-back').onclick = () => reader(course, pageHistory.pop() || course.page);
  $('#course-body').onclick = (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    if (link.dataset.page) {
      const target = pageKey.split('/')[0] + '/' + link.dataset.page;
      if (target !== pageKey) pageHistory.push(pageKey);
      reader(course, target, link.dataset.anchor);
    } else if (link.dataset.media) {
      const reference=parseOriginalLink(link.dataset.media);
      if(reference.type===7){
        const definition=findOriginalDefinition(catalog.dictionary,reference.id);
        info(link.textContent.trim()||'Le dictionnaire d’Adi',definition===null
          ? '<p>Cette définition originale n’a pas encore été retrouvée.</p>'
          : `<p>${escape(definition)}</p>`);
        return;
      }
      showOriginalMedia(reference.id,pageKey.split('/')[0],info,(target,anchor)=>{
        if(!catalog.pages[target]){info('Complément','<p>Cette page est introuvable.</p>');return;}
        pageHistory.push(pageKey);reader(course,target,anchor);
      }).catch(()=>info('Complément multimédia','<p>Le média est indisponible.</p>'));
    }
  };
  if (anchor) requestAnimationFrame(() => document.getElementById('anchor-' + anchor)?.scrollIntoView({block:'start'}));
  else window.scrollTo(0,0);
}
function dictionary() {
  info('Le dictionnaire d’Adi', '<label class="search dictionary-search"><span aria-hidden="true">⌕</span><input id="dictionary-search" type="search" placeholder="Un mot, une idée…" aria-label="Rechercher dans les définitions"></label><p id="dictionary-count" class="quiet" aria-live="polite"></p><div id="dictionary-results"></div>');
  function update() {
    const term = normalize($('#dictionary-search').value);
    const results = Object.entries(catalog.dictionary).filter(([word,definition]) => normalize(word + ' ' + definition).includes(term));
    $('#dictionary-count').textContent = `${results.length} définition${results.length > 1 ? 's' : ''}${results.length > 35 ? ' · 35 premières affichées' : ''}`;
    $('#dictionary-results').innerHTML = results.slice(0,35).map(([word,text])=>`<section class="definition"><h3>${escape(word)}</h3><p>${escape(text)}</p></section>`).join('') || '<p>Aucune définition trouvée. Essaie un autre mot.</p>';
  }
  $('#dictionary-search').oninput = update;
  update();
  $('#dictionary-search').focus();
}
function route() {
  if (!catalog) return;
  main.querySelectorAll('audio,video').forEach(media=>media.pause());
  const hash = location.hash.slice(1) || 'room';
  let active = hash;
  if (hash.startsWith('course/')) {
    let id;
    try { id = decodeURIComponent(hash.slice(7)); } catch { id = ''; }
    const course = catalog.courses.find(c => c.id === id);
    if (course) { pageHistory = []; reader(course); active = 'science'; }
    else { location.hash = 'science'; toast('Cette fiche est introuvable. Voici les cours disponibles.'); return; }
  } else if (hash === 'encyclopedia') {
    renderEncyclopedia(main,['6','5'].includes(level)?'Adi410Sci65':'Adi410Sci43',info,(page,anchor)=>{
      const course=catalog.courses.find(c=>c.page===page)||catalog.courses.find(c=>c.level===level);
      if(course&&catalog.pages[page]){pageHistory=[];reader(course,page,anchor);}
    }); active='science';
  }
  else if (hash === 'simulations') { renderSimulations(main); active='science'; }
  else if (/^simulation\/\d+$/.test(hash)) { renderSimulation(main,hash.slice(11)); active='science'; }
  else if (hash === 'scene/greenhouse') { renderGreenhouse(main); active='science'; }
  else if (hash.startsWith('scene/') && scenes[hash.slice(6)]) { renderScene(main,hash.slice(6)); active='science'; }
  else if (hash === 'science') science();
  else if (hash === 'notebook') notebook();
  else if (hash === 'games') {renderGames(main,info);active='room';}
  else if (hash === 'radio') {renderRoomActivity(main,'radio',info);active='room';}
  else if (hash === 'game/sokoban') {renderSokoban(main);active='room';}
  else if (hash === 'game/wgob3') {renderWGob3(main);active='room';}
  else if (hash === 'game/mrmatt1') {renderMrMatt(main);active='room';}
  else if (hash === 'welcome') {home();active='room';}
  else { renderRoom(main,info); active = 'room'; }
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === active);
    if (link.dataset.nav === active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
}
main.addEventListener('click', (event) => {
  const levelButton = event.target.closest('[data-level]');
  const subjectButton = event.target.closest('[data-subject]');
  if (levelButton) { level = levelButton.dataset.level; persist(); science(); }
  if (subjectButton) { subject = subjectButton.dataset.subject; science(); }
});
window.addEventListener('hashchange', route);
try {
  const response = await fetch('/game/catalog.json');
  if (!response.ok) throw new Error('Catalogue indisponible');
  catalog = await response.json();
  saved = [...new Set(saved)].filter(id => catalog.courses.some(c=>c.id===id));
  read = [...new Set(read)].filter(id => catalog.courses.some(c=>c.id===id));
  $('#saved-count').textContent = saved.length;
  route();
} catch {
  main.innerHTML = '<section class="empty"><h1>Les livres n’ont pas pu être ouverts.</h1><p>Le catalogue local est indisponible. Vérifie que les ressources du jeu ont été préparées.</p><button class="button primary" id="retry">Réessayer</button></section>';
  $('#retry').onclick = () => location.reload();
}
