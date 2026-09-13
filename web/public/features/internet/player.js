import { createLocalInternet, categories, companions, gifts, grade, weekStart } from './engine.js';
import { addDays, calendarHour, canReserve, hourStart } from './calendar.js';
import { escapeHtml as esc } from '../../shared/text.js';
const root = document.querySelector('#internet');
const asset = name => `/game/internet/${name}`;
const resourceLog = [];
const securityViolations = [];
new PerformanceObserver(list => {
  for (const r of list.getEntries()) resourceLog.push(r.name);
}).observe({ type: 'resource', buffered: true });
document.addEventListener('securitypolicyviolation', e => securityViolations.push(e.blockedURI));
const options = (values, selected) => values.map(([v, label]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`).join('');
const button = (label, action, value = '', disabled = false) => `<button type="button" data-action="${action}" data-value="${esc(value)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
const badge = '';
const menuDefinitions = {
  home: ['AI_MENU', 'FD3P', 'La planète ADI', ['parents', 'forum', 'world'], ['Le coin parents', 'Le forum', 'Le monde des classes virtuelles'], 'COGE0100', ['COZO0801', 'COZO0803', 'COZO0802']],
  forum: ['AI_FORUM', 'FDFORUM', 'LE FORUM', ['netadi', 'onadi', 'club', 'mail'], ['Espace NetAdi', 'Espace OnAdi', 'Espace ClubAdi', 'Messagerie enfant'], 'ENGE0900', ['ENZO0902', 'ENZO0901', 'ENZO0903', 'ENZO0904']],
  onadi: ['AI_FORON', 'FDONADI', 'ONADI', categories.map(c => c.id), categories.map(c => c.label), 'ENGE1000', categories.map(c => c.voice)],
  world: ['AI_MONDE', 'FDMONDCV', 'LE MONDE DES CLASSES VIRTUELLES', ['results', 'points', 'reservations', 'classes', 'mail'], ['Résultats', 'Bons points', 'Réservations', 'Classes virtuelles', 'Messagerie enfant'], 'ENGE0700', ['ENZO0701', 'ENZO0702', 'ENZO0703', 'ENZO0704', 'ENZO0904']],
  parents: ['AI_PAREN', 'FDPARENT', 'LE COIN DES PARENTS', ['account', 'results', 'reservations', 'parentMail'], ['Gestion dossier', 'Résultats', 'Réservations', 'Messagerie parent'], 'PAGE0100', ['PAZO0101', 'PAZO0102', 'PAZO0103', 'PAZO0104']],
};
let catalog, lessons, media, ambient, engine, observer;
let ambientTimer, lastAmbient;
let screen = 'connect', history = [], selectedCategory = 'jokes', selectedArticle, chapter = 0, onlyFavorites = false;
let mailId, selectedMailId, parentMail = false, writer = false, replyTo = [], writeChapter = false, profileId = 'lina';
let level = '6', subject = 'F', chosenSession = 'F6AA', exercise = null, questionIndex = 0, answers = [], chosen = [], checked = false;
let calendarWeek = weekStart(Date.now()), firstHour = Math.min(16, new Date().getHours());
let booking = null, myReservations = false;
let navSites = [], siteIndex = -1, helpMode = false, soundEnabled = true, parentUnlocked = false;
let playback = new Audio(), motionTimer, notice = '', lessonFilter = '', alive = true;
playback.hidden = true;
playback.id = 'internet-voice';
document.body.append(playback);
const state = () => engine.state;
const labelFor = id => companions.find(c => c.id === id)?.name || ({ consommateurs: 'Service Consommateurs', technique: 'Support technique', achat: 'Service Achat' })[id] || id;
function speak(name, animate = false) {
  playback.pause(); clearTimeout(motionTimer); root.querySelector('.gag')?.remove();
  const clip = media[name]; if (!clip || !soundEnabled) return;
  if (clip.audio) {
    playback.src = asset(clip.audio);
    playback.play().catch(error => {
      // Changing screens or hiding the tab intentionally interrupts playback.
      if (error.name === 'AbortError') return;
      notice = error.name === 'NotAllowedError'
        ? 'Clique sur « Écouter les instructions » pour activer les voix.'
        : 'Cette voix n’a pas pu être lue.';
      status();
      console.warn('Lecture de la voix ADI :', error.name, error.message);
    });
  }
  if (animate && clip.image) {
    const img = new Image(); img.className = 'gag'; img.src = asset(clip.image); img.alt = '';
    Object.assign(img.style, { left: `${clip.x}px`, top: `${clip.y}px`, width: `${clip.width}px`, height: `${clip.height}px` });
    root.querySelector('.net-stage')?.append(img); motionTimer = setTimeout(() => img.remove(), clip.duration * 1000);
  }
}
function status() { const el = root.querySelector('.net-status'); if (el) el.textContent = notice; }
function go(next) {
  if (['forum', 'onadi', 'netadi', 'club', ...categories.map(c => c.id)].includes(next) && !engine.forumAllowed()) { notice = 'L’accès au forum est limité dans le coin parents.'; status(); return; }
  if (next === 'parents' && state().parentSymbol !== 'sans' && !parentUnlocked) next = 'parentGate';
  if (screen === 'reservations') { booking = null; myReservations = false; }
  history.push(screen); screen = next; writer = false; writeChapter = false; checked = false; notice = '';
  if (next === 'mail' || next === 'parentMail') { parentMail = next === 'parentMail'; mailId = null; selectedMailId = null; }
  if (categories.some(c => c.id === next)) { selectedCategory = next; selectedArticle = null; chapter = 0; onlyFavorites = false; }
  render();
}
function back() {
  if (['mail', 'parentMail'].includes(screen) && (writer || mailId)) {
    if (writer) writer = false;
    else mailId = null;
  } else if (screen === 'reservations' && (booking || myReservations)) {
    booking = null; myReservations = false;
  } else {
    screen = history.pop() || 'home'; writer = false; writeChapter = false;
  }
  notice = ''; render();
}
function run(op, payload) { return engine.request(op, payload); }
function form(id, content, submit = 'Valider') { return `<form id="${id}">${content}<div class="row"><button type="submit">${submit}</button>${button('Annuler', 'back')}</div></form>`; }
function panel(content, className = '') { return `<div class="net-panel ${className}">${content}</div>`; }
function heading(title, extra = '') { return `<h2>${esc(title)}</h2>${extra}`; }
function menu(name) {
  const [key, background, title, routes, labels] = menuDefinitions[name];
  return [background, `<h2 class="scene-title">${title}</h2>${catalog.menus[key].map(z => `<button class="net-zone" data-action="go" data-value="${routes[z.id - 1]}" aria-label="${labels[z.id - 1]}" data-voice="${menuDefinitions[name][6][z.id - 1]}" style="left:${z.rect[0]}px;top:${z.rect[1]}px;width:${z.rect[2]}px;height:${z.rect[3]}px"><span>${labels[z.id - 1]}</span></button>`).join('')}`];
}
function currentArticle() {
  const s = state(); const list = s.articles.filter(a => a.category === selectedCategory && (!onlyFavorites || s.favorites.includes(a.id)));
  const item = list.find(a => a.id === selectedArticle) || list[0]; if (item) selectedArticle = item.id;
  return { list, item };
}
function articleScreen() {
  const category = categories.find(c => c.id === selectedCategory); const { list, item } = currentArticle();
  if (writer) return [category.background, panel(heading(writeChapter ? 'Écris la suite du roman' : `${category.label} — Mode écriture`, badge) + form('article', `${writeChapter ? '' : '<label>Titre<input name="title" required maxlength="120"></label>'}<label>Thème<select name="theme"><option>Découverte</option></select></label><label>Zone d’écriture<textarea name="body" required maxlength="20000"></textarea></label>`, 'Envoyer mon texte'))];
  if (!item) return [category.background, panel(heading(category.label) + '<p>Aucun texte dans cette sélection.</p>' + button('Mode écriture', 'writeArticle') + button('Tous les textes', 'allArticles'))];
  chapter = Math.min(chapter, item.chapters.length - 1);
  return [category.background, panel(`<div class="row"><label>Thème<select><option>Découverte</option></select></label><label>Titre<select id="article-choice">${options(list.map(a => [a.id, a.title]), item.id)}</select></label></div><div class="row">${button('Auteur de ce texte : ' + labelFor(item.author), 'author', item.author)}${item.demo ? badge : '<span class="demo">Ton texte</span>'}</div><article class="story">${esc(item.chapters[chapter])}</article><div class="row">${selectedCategory === 'novels' ? `${button('Chapitre précédent', 'chapter', '-1')}<span>Chapitre ${chapter + 1}/${item.chapters.length}</span>${button('Chapitre suivant', 'chapter', '1')}` : ''}</div><div class="row">${[0, 1, 2, 3].map((n, i) => `<button class="icon-action ${item.votes[state().profile] === n ? 'selected' : ''}" data-action="vote" data-value="${n}" aria-label="${['Je n’aime pas du tout', 'Je n’aime pas beaucoup', 'J’aime beaucoup', 'J’aime énormément'][n]}"><img alt="" src="${asset(`AI_LINT1-${7 - i}.webp`)}"></button>`).join('')}${button(state().favorites.includes(item.id) ? 'Retirer des préférés' : 'Mes préférés +', 'favorite')}${button(selectedCategory === 'novels' ? 'Écrire la suite' : 'Mode écriture', 'writeArticle', selectedCategory === 'novels' ? 'chapter' : '')}</div>`, 'reader')];
}
function mailScreen() {
  const s = state(); const messages = s.messages.filter(m => !!m.parent === parentMail);
  if (writer) return ['FDMAIL', panel(heading(parentMail ? 'Messagerie parent' : 'Nouveau message', badge) + form('mail', `<label>Destinataire(s)<select name="to" multiple size="3" required>${options((parentMail ? ['consommateurs', 'technique', 'achat'] : s.friends).map(id => [id, labelFor(id)]), replyTo[0])}</select></label><label>Titre<input name="title" required maxlength="39"></label><label>Zone d’écriture<textarea name="body" required maxlength="20000"></textarea></label>`, 'Envoyer'))];
  if (mailId) {
    const m = messages.find(m => m.id === mailId); if (!m) mailId = null;
    else return ['FDMAIL', panel(heading(m.title) + `<p>DE ${esc(labelFor(m.from))} · POUR ${m.to.map(t => esc(labelFor(t))).join(', ')}</p>${m.demo ? '<span class="demo">Message de démonstration</span>' : ''}<div class="mail-body">${esc(m.body)}</div><div class="row">${button('Répondre', 'reply', m.from)}${button('Supprimer le message', 'deleteMail', m.id)}${button('Liste des messages', 'mailList')}</div>`)];
  }
  const selected = messages.find(m => m.id === selectedMailId);
  return ['FDMAILL', `<img class="mail-sign" src="${asset('ui-AI_MAIL-0.webp')}" alt="${parentMail ? 'Messagerie parent' : 'Messagerie enfant'}"><div class="native-inbox"><table aria-label="Liste des messages"><colgroup><col style="width:26%"><col style="width:22%"><col style="width:34%"><col style="width:18%"></colgroup><thead><tr><th>De</th><th>Pour</th><th>Titre</th><th>Date</th></tr></thead><tbody>${messages.slice().reverse().map(m => `<tr class="${m.id === selectedMailId ? 'mail-selected' : ''}" data-action="selectMail" data-value="${esc(m.id)}"><td><span class="mail-mark" aria-label="${m.read ? 'Lu' : 'Non lu'}">${m.read ? '✓' : '●'}</span>${esc(labelFor(m.from))}</td><td>${m.to.map(t => esc(labelFor(t))).join(', ')}</td><td><button type="button" data-action="selectMail" data-value="${esc(m.id)}" aria-pressed="${m.id === selectedMailId}" title="${esc(m.title)}">${esc(m.title)}</button></td><td>${new Date(m.date).toLocaleDateString('fr-FR')}</td></tr>`).join('')}</tbody></table>${messages.length ? '' : '<p class="empty-mail">Aucun message.</p>'}</div><div class="native-mail-actions">${spriteButton('Nouveau message', 'writeMail', 'AI_LINT1-8')}${spriteButton('Lire le message', 'readMail', 'AI_LINT1-15', selected?.id || '', !selected)}${spriteButton('Supprimer le message', 'deleteMail', 'AI_LINT1-16', selected?.id || '', !selected)}</div>`];
}
function spriteButton(label, action, sprite, value = '', disabled = false) {
  return `<button type="button" class="native-sprite" data-action="${action}" data-value="${esc(value)}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''} style="background-image:url('${asset('ui-' + sprite + '.webp')}')"></button>`;
}
function friendsScreen() {
  return ['FDCC', panel(heading('Carnet des copains', badge) + `<div class="net-list">${companions.map(c => `<div class="row">${button(c.name, 'author', c.id)}${button(state().friends.includes(c.id) ? 'Supprimer ce copain' : 'Ajouter ce copain', state().friends.includes(c.id) ? 'removeFriend' : 'addFriend', c.id)}</div>`).join('')}</div>${button('Ma fiche de goût', 'author', 'self')}`)];
}
function profileScreen() {
  const self = profileId === 'self' || profileId === state().profile; const c = companions.find(c => c.id === profileId);
  return ['FDFGOUT', panel(heading(self ? state().profile : c?.name || profileId, badge) + (self ? form('taste', `<label>Fiche de goût<textarea name="text" maxlength="300">${esc(state().taste)}</textarea></label>`) : `<p>${esc(c?.taste || 'Ce texte appartient à ce personnage.')}</p><div class="row">${c ? `${button('Mettre dans ton carnet des copains', 'addFriend', c.id)}${button('Envoyer un message', 'composeTo', c.id)}` : ''}</div>`))];
}
function netadiScreen() {
  const builtIn = catalog.sites.filter(s => !s.startsWith('file:')).map((address, i) => ({ id: `site-${i}`, address, name: address.replace(/^https?:\/\//, '') }));
  const sites = [...builtIn, ...state().sites]; const current = sites.find(s => s.id === navSites[siteIndex]);
  const historical = current && builtIn.some(s => s.id === current.id);
  return ['FDNETADI', panel(`<div class="row">${button('←', 'siteBack')}${button('→', 'siteForward')}${button('Accueil', 'siteHome')}${button('Arrêt', 'siteStop')}<span class="small">${state().controls.restricted ? 'Contrôle parental activé.' : 'Contrôle parental désactivé.'}</span></div><form id="navigate"><label>Site<input name="address" value="${esc(current?.address || '')}" placeholder="Adresse du site"></label><button>Ouvrir</button></form><div class="net-page">${current ? heading(current.name, badge) + `<p>${historical ? 'Adresse d’époque' : 'Adresse'} : <strong>${esc(current.address)}</strong></p><p>${historical ? 'Cette page est une fiche de remplacement. Le site original n’est pas fourni sur les CD : son contenu historique n’a pas été récupéré.' : 'Cette fiche a été ajoutée dans le coin parents.'}</p><p>${current.address.includes('netadi') ? 'NetAdi proposait une sélection de sites pour enfants, avec ou sans contrôle parental.' : 'Tu peux revenir à l’accueil, consulter une autre fiche, ou utiliser les flèches pour retrouver tes visites.'}</p>` : heading('NetAdi', badge) + '<p>Retrouve les sites de la liste originale et les fiches ajoutées dans le coin parents. Choisis un site pour consulter sa fiche.</p><div class="net-list">' + sites.map(s => button(s.name, 'site', s.id)).join('') + '</div>'}</div>` )];
}
function sessionChoices() { return catalog.sessions.filter(s => s.subject === subject && s.level === level && s.active); }
function availableLessons(sessionId = chosenSession) { return lessons.filter(l => l.id.startsWith(`FR${sessionId}`)); }
function selectors() {
  const sessions = sessionChoices(); if (!sessions.some(s => s.id === chosenSession)) chosenSession = sessions[0]?.id;
  return `<div class="row"><label>Matière<select id="subject">${options([['F', 'FRANÇAIS'], ['M', 'MATHS']], subject)}</select></label><label>Niveau<select id="level">${options(['A','9','8','7','6','5','4','3'].map((l, i) => [l, ['CE1','CE2','CM1','CM2','6ème','5ème','4ème','3ème'][i]]), level)}</select></label></div><label>Thème et séance<select id="session">${options(sessions.map(s => [s.id, `${s.theme} : ${s.title}`]), chosenSession)}</select></label>`;
}
function classesScreen() {
  const selectorsHtml = selectors(); const available = availableLessons();
  return ['FDSEANCE', panel(heading('CLASSES VIRTUELLES') + selectorsHtml + `<p>${available.length} exercice(s) jouable(s) extrait(s) pour cette séance.</p><div class="row">${button('La récréation', 'go', 'recreation')}${button('Réserver une séance', 'go', 'reservations')}${button('Tous les exercices jouables', 'go', 'exerciseLibrary')}</div><div class="net-list">${available.map((l, i) => button(`${i + 1}. ${l.instruction || l.id}`, 'exercise', l.id)).join('')}</div>${!available.length ? '<p>Le titre de cette séance est authentique ; ses exercices ne sont pas encore compatibles avec le lecteur. Le catalogue des exercices jouables permet d’en essayer d’autres.</p>' : ''}`)];
}
function libraryScreen() {
  const list = lessons.filter(l => `${l.instruction} ${l.id}`.toLocaleLowerCase().includes(lessonFilter.toLocaleLowerCase()));
  return ['FDSEANCE', panel(heading('Les exercices jouables') + `<label>Rechercher<input id="exercise-search" value="${esc(lessonFilter)}" placeholder="homonymes, calcul, FRF6AAA1…"></label><p>${list.length} / ${lessons.length} exercices · français et maths, collège</p><div class="net-list">${list.map(l => button(`${l.id} — ${l.instruction}`, 'exercise', l.id)).join('')}</div>`)];
}
function reservationScreen() {
  if (booking) return seatScreen();
  if (myReservations) return ['FDRESA', panel(heading('Mes réservations')
    + (state().reservations.length ? '<div class="net-list">' + state().reservations.slice().sort((a, b) => a.date - b.date).map(r => {
      const session = catalog.sessions.find(s => s.id === r.session);
      return `<div class="booking-summary"><p>${esc(session ? `${session.subject === 'M' ? 'MATHS' : 'FRANÇAIS'} · ${session.levelLabel} · ${session.title}` : r.session)}</p><p>${new Date(r.date).toLocaleString('fr-FR')} · place ${r.seat}</p>${button('Voir la réservation', 'openBooking', r.id)} ${button('Annuler la réservation', 'cancelReservation', r.id)}</div>`;
    }).join('') + '</div>' : '<p>Aucune réservation.</p>') + button('Le calendrier', 'calendar'))];
  const days = Array.from({ length: 7 }, (_, i) => addDays(calendarWeek, i));
  const current = Date.now();
  const reservations = state().reservations;
  const dayLabel = date => new Date(date).toLocaleDateString('fr-FR');
  const cells = Array.from({ length: 8 }, (_, row) => {
    const hour = firstHour + row;
    return `<span class="calendar-hour">${hour}h</span>` + days.map(day => {
      const date = calendarHour(day, hour);
      const reserved = reservations.find(r => date !== null && hourStart(r.date) === date);
      const session = reserved && catalog.sessions.find(s => s.id === reserved.session);
      const matching = session?.subject === subject && session?.level === level;
      const available = canReserve(date, current);
      const label = `${dayLabel(day)} à ${hour}h${reserved ? ` · Réservé : ${session?.levelLabel || ''} · ${session?.title || reserved.session}` : available ? ' · Libre' : ' · Séance indisponible'}`;
      return `<button type="button" class="calendar-cell ${reserved ? 'booked' : ''} ${reserved && !matching ? 'other-session' : ''}" data-action="calendarSlot" data-value="${date ?? ''}" aria-label="${esc(label)}" title="${esc(label)}" ${!available && !reserved ? 'disabled' : ''}>${reserved ? `<span class="reservation-icon ${session?.subject === 'M' ? 'maths' : 'french'}" aria-hidden="true"></span>` : ''}</button>`;
    }).join('');
  }).join('');
  return ['FDRESA', `<div class="calendar-week">${button('◀', 'calendarWeek', '-1', calendarWeek <= weekStart(current))}<span>Semaine du ${dayLabel(calendarWeek)} au ${dayLabel(days[6])}</span>${button('▶', 'calendarWeek', '1', calendarWeek >= weekStart(addDays(current, 28)))}</div><button class="my-reservations" data-action="myReservations">Mes réservations</button><div class="calendar-filters"><label><span class="sr-only">Matière</span><select id="subject">${options([['M', 'MATHS'], ['F', 'FRANÇAIS']], subject)}</select></label><label><span class="sr-only">Niveau</span><select id="level">${options(['A','9','8','7','6','5','4','3'].map((l, i) => [l, ['CE1','CE2','CM1','CM2','6ème','5ème','4ème','3ème'][i]]), level)}</select></label></div><div class="calendar-days">${days.map(day => `<span>${new Date(day).toLocaleDateString('fr-FR', { weekday: 'long' })}</span>`).join('')}</div><div class="calendar-grid" aria-label="Créneaux de la semaine">${cells}</div><div class="calendar-scroll"><button data-action="calendarHours" data-value="-1" aria-label="Heures précédentes" ${firstHour === 0 ? 'disabled' : ''}>▲</button><input id="calendar-hour" type="range" min="0" max="16" value="${firstHour}" aria-label="Première heure affichée"><button data-action="calendarHours" data-value="1" aria-label="Heures suivantes" ${firstHour === 16 ? 'disabled' : ''}>▼</button></div><p class="calendar-legend">Choisis une heure, puis ta place dans la classe.</p><p class="calendar-subscription">${state().subscription ? 'Abonné' : 'Sans abonnement'}</p>`];
}
function openBooking(date, existing) {
  if (existing) {
    const session = catalog.sessions.find(s => s.id === existing.session);
    if (session) { subject = session.subject; level = session.level; chosenSession = session.id; }
  }
  const sessions = sessionChoices();
  if (!sessions.some(s => s.id === chosenSession)) chosenSession = sessions[0]?.id;
  booking = { id: existing?.id, date, seat: existing?.seat || 0 };
  render();
}
function seatScreen() {
  const sessions = sessionChoices();
  const session = sessions.find(s => s.id === chosenSession);
  const themes = [...new Set(sessions.map(s => s.theme))];
  const editable = canReserve(booking.date, Date.now());
  return ['FDSEANCE', `<div class="seat-heading">${new Date(booking.date).toLocaleDateString('fr-FR')} à ${new Date(booking.date).getHours()}h : ${subject === 'M' ? 'MATHS' : 'FRANÇAIS'} - ${esc(session?.levelLabel || level)}</div><div class="seat-filters"><label><span class="sr-only">Thème</span><select id="booking-theme" ${editable ? '' : 'disabled'}>${options(themes.map(t => [t, t]), session?.theme)}</select></label><label><span class="sr-only">Séance</span><select id="session" ${editable ? '' : 'disabled'}>${options(sessions.filter(s => s.theme === session?.theme).map(s => [s.id, s.title]), chosenSession)}</select></label></div><h2 class="class-number">Classe 1</h2><div class="class-seats">${Array.from({ length: 6 }, (_, i) => `<button class="class-seat" data-action="chooseSeat" data-value="${i + 1}" aria-label="Place ${i + 1}${booking.seat === i + 1 ? ` : ${esc(state().profile)}` : ' libre'}" aria-pressed="${booking.seat === i + 1}" ${editable ? '' : 'disabled'}><img src="${asset(`ui-AI_LINT3-${booking.seat === i + 1 ? 1 : 2}.webp`)}" alt=""><span>${booking.seat === i + 1 ? esc(state().profile) : `Place ${i + 1}`}</span></button>`).join('')}</div><div class="seat-instructions"><p>${editable ? 'Choisis ta place, le thème et la séance, puis valide avec le pouce.' : 'Cette séance est passée.'}</p>${editable ? `<form id="reserve"><button type="submit" ${booking.seat ? '' : 'disabled'}>${booking.id ? 'Valider les modifications' : 'Valider la réservation'}</button></form>` : ''}</div>${booking.id ? `<div class="seat-cancel">${button('Annuler la réservation', 'cancelReservation', booking.id)}</div>` : ''}`];
}
function exerciseScreen() {
  const q = exercise.questions[questionIndex];
  const prompt = esc(q.prompt).replace(/⟦(.*?)⟧/gs, '<span class="slot">$1</span>');
  return ['FOND', panel(heading(exercise.instruction) + `<p class="small">Exercice original ${esc(exercise.id)} · Question ${questionIndex + 1}/${exercise.questions.length}</p><p class="exercise-text">${prompt}</p><div class="row">${q.choices.map((choice, i) => `<button class="choice ${chosen.includes(i) ? 'selected' : ''}" data-action="answer" data-value="${i}" aria-pressed="${chosen.includes(i)}" ${checked ? 'disabled' : ''}>${esc(choice)}</button>`).join('')}</div><div class="row">${button('Accès à la leçon', 'lessonHelp')}${!checked ? button('Valider ma réponse', 'checkAnswer') : button(questionIndex + 1 === exercise.questions.length ? 'Voir mon résultat' : 'Question suivante', 'nextQuestion')}</div>${checked ? `<div class="feedback">${grade(q, chosen) ? 'Bravo !' : esc(q.feedback || 'Regarde les bonnes réponses ci-dessous.')}<p>Réponse : ${q.choices.filter((_, i) => q.answerMask & 2 ** i).map(esc).join(', ')}</p></div>` : '<p>Clique sur le ou les choix, puis valide.</p>'}`)];
}
function resultsScreen() {
  const attempts = state().attempts;
  return ['FDRESULT', panel(heading('SUIVI DES SÉANCES') + `<p>${attempts.length} exercice(s) terminé(s) · Score général : ${engine.earned()} points</p><div class="row">${button('Graphique', 'resultGraph')}${button('Tableau', 'resultTable')}${button('Diplôme', 'diploma')}${button('Bons points', 'go', 'points')}</div><div id="results-chart" hidden>${attempts.slice(-12).map(a => `<p>${esc(a.lesson)} <meter min="0" max="20" value="${a.score}"></meter> ${a.score}/20</p>`).join('')}</div><table id="results-table"><thead><tr><th>Séance</th><th>Date</th><th>Note</th></tr></thead><tbody>${attempts.slice().reverse().map(a => `<tr><td>${esc(a.lesson)}</td><td>${new Date(a.date).toLocaleDateString('fr-FR')}</td><td>${a.score}/20</td></tr>`).join('')}</tbody></table><p class="small">Notes calculées sur les exercices terminés. Les sessions et moyennes historiques des serveurs ne sont pas disponibles.</p>`)];
}
function pointsScreen() {
  return ['FDBP', panel(heading('LES BONS POINTS', badge) + `<p>Score général : ${engine.earned()} · Points à dépenser : ${engine.balance()}</p>${gifts.map(g => `<div class="gift"><img src="${asset(g.file)}" alt="${esc(g.title)}"><div><h3>${g.title}</h3><p>${g.price} points ${state().rewards.includes(g.id) ? '· déjà obtenu' : ''}</p>${button('Informations', 'giftInfo', g.id)} ${button(state().rewards.includes(g.id) ? 'Visualiser' : 'Télécharger', 'gift', g.id)}</div></div>`).join('')}<p class="small">Collection de démonstration composée de décors originaux. Barème : 5 points par bonne réponse, uniquement pour l’amélioration du meilleur résultat de chaque exercice.</p>${button('Offre super cadeau', 'superGift')}`)];
}
function recreationScreen() {
  return ['RECREA02', panel(heading('La récréation', badge) + `<div class="row">${['Achille', 'Azerty', '%µ+y-x:='].map((name, i) => button(name, 'gag', ['CLSGAG01','FRSGAG01','MASGAG01'][i])).join('')}</div><div class="chat-log" role="log">${state().chats.map(m => `<p><strong>${esc(m.from)} :</strong> ${esc(m.text)}</p>`).join('')}</div>${form('chat', '<label>Ton message<input name="text" maxlength="500" required></label>', 'Parler')}${button('Classes virtuelles', 'go', 'classes')}`)];
}
function accountScreen() {
  const items = catalog.config.MESINT.GestionCompte;
  const destinations = ['controls','sites','coordinates','password','sessionInfo','forumTime','subscription','trial','parentMail','profiles','contract'];
  return ['FDCOMPTE', panel(heading('GESTION DOSSIER') + '<div class="net-list">' + destinations.map((destination, i) => button(items[`Intitule_${i + 1}`], 'go', destination)).join('') + '</div>')];
}
function parentScreen() {
  const s = state();
  switch (screen) {
    case 'controls': return ['FDCOMPTE', panel(heading('CONTRÔLE PARENTAL') + form('controls', `<label>Limitation du forum<select name="forum">${options([['unlimited','Forum illimité'],['limited','Forum limité en temps'],['blocked','Forum interdit']], s.controls.forum)}</select></label><div class="row"><label>Minutes par semaine<input name="minutes" type="number" min="0" max="10080" value="${s.controls.forumMinutes}"></label><label>Réservations par semaine<input name="limit" type="number" min="0" max="1000" value="${s.controls.reservationLimit ?? ''}" placeholder="Illimité"></label></div><label><input name="restricted" type="checkbox" ${s.controls.restricted ? 'checked' : ''}>Navigation limitée aux sites prédéfinis</label><p class="small">Ces réglages permettent d’essayer le contrôle parental du jeu.</p>`))];
    case 'sites': return ['FDCOMPTE', panel(heading('SAISISSEZ VOS SITES INTERNET…') + form('site', '<label>Intitulé<input name="name" required maxlength="80"></label><label>Adresse<input name="address" required maxlength="200"></label><p>Chaque adresse ajoutée crée une fiche dans NetAdi.</p>') + s.sites.map(p => `<p>${esc(p.name)} — ${esc(p.address)}</p>`).join(''))];
    case 'subscription': case 'trial': return ['FDCOMPTE', panel(heading(screen === 'trial' ? 'Offre d’essai aux classes virtuelles' : 'ABONNEMENTS AUX CLASSES VIRTUELLES', badge) + `<p>Les prix et offres des anciens serveurs ne sont pas disponibles. Utilise cet abonnement fictif pour essayer les réservations.</p>${form('subscription', `<label><input name="enabled" type="checkbox" ${s.subscription ? 'checked' : ''}>Abonné — accès illimité</label><label><input name="renewal" type="checkbox" ${s.renewal ? 'checked' : ''}>Renouvellement automatique fictif</label><p>Aucun paiement, aucune carte et aucun code d’achat ne sont demandés.</p>`)}`)];
    case 'password': return ['FDCOMPTE', panel(heading('Changement de mot de passe', badge) + form('symbol', `<p>Pour essayer cet écran sans saisir de vrai mot de passe, choisis un symbole public de démonstration.</p><label>Symbole<select name="symbol">${options(['sans','étoile','lune','soleil'].map(x => [x,x]), s.parentSymbol)}</select></label><p>Ce symbole est affiché sur l’écran d’entrée et ne protège aucune donnée.</p>`))];
    case 'parentGate': return ['FDCOMPTE', panel(heading('Le coin des parents', badge) + form('unlock', `<p>Symbole de démonstration à choisir : <strong>${esc(s.parentSymbol)}</strong></p><label>Symbole<select name="symbol">${options(['étoile','lune','soleil'].map(x => [x,x]), 'étoile')}</select></label>`))];
    case 'coordinates': return ['FDCOMPTE', panel(heading('SAISISSEZ VOS COORDONNÉES…', badge) + '<p>Le formulaire original enregistrait nom, adresse, téléphone, e-mail et fournisseur d’accès. Ici, le dossier contient uniquement un personnage fictif.</p><p>Famille Démonstration<br>1 rue des Planètes<br>00000 Ville imaginaire</p>' + button('Valider les coordonnées fictives', 'demoSaved'))];
    case 'sessionInfo': return ['FDRESULT', panel(heading('INFORMATIONS SUR LES SÉANCES') + `<p>Séances finies : ${s.attempts.length}</p><p>Les abandons et déconnexions de classes collectives ne sont pas simulés.</p>${button('Suivi des séances', 'go', 'results')}`)];
    case 'forumTime': return ['FDRESULT', panel(heading('TEMPS PASSÉ DANS LE FORUM') + `<p>Cette semaine : ${Math.floor((s.forumTime[String(weekStart(Date.now()))] || 0) / 60)} minute(s)</p><p>Le compteur tourne dans les écrans du forum uniquement, lorsque cette page est visible.</p>`)];
    case 'profiles': return ['FDVISAGE', panel(heading('Les enfants de votre dossier', badge) + `<p>Personnage actuel : ${esc(s.profile)}</p><div class="stack">${['Voyageur','Astronaute','Explorateur'].map(n => button(n, 'profileName', n)).join('')}</div><p>Trois noms fictifs pour le même dossier. Les sauvegardes restent partagées dans cette démonstration.</p>`)];
    case 'contract': return ['FDCOMPTE', panel(heading('Le contrat utilisateur') + '<p>Le jeu contient CONTRAT.RTF et CGVADICV.RTF. Ces textes décrivaient les services réels de l’époque. Cette reconstitution n’y souscrit pas.</p><p>Aucun compte n’est créé, aucun contrat n’est accepté et aucune donnée n’est transmise.</p>')];
  }
}
function screenContents() {
  if (menuDefinitions[screen]) return menu(screen);
  if (categories.some(c => c.id === screen)) { selectedCategory = screen; return articleScreen(); }
  switch (screen) {
    case 'connect': return ['FDCONN', panel(heading('Bienvenue sur la planète ADI', badge) + '<p>Explore les trois planètes, les textes, la messagerie et les classes virtuelles.</p><p>Tu joues avec des personnages fictifs. Tes textes, réservations et résultats restent dans ce navigateur.</p><p>Aucun identifiant ni accès Internet n’est nécessaire.</p>' + button('Entrer dans la planète ADI', 'connect') + button('Voir la présentation originale', 'presentation'))];
    case 'mail': case 'parentMail': return mailScreen();
    case 'friends': return friendsScreen();
    case 'profile': return profileScreen();
    case 'netadi': return netadiScreen();
    case 'classes': return classesScreen();
    case 'exerciseLibrary': return libraryScreen();
    case 'reservations': return reservationScreen();
    case 'exercise': return exerciseScreen();
    case 'results': return resultsScreen();
    case 'points': return pointsScreen();
    case 'recreation': return recreationScreen();
    case 'account': return accountScreen();
    case 'club': return ['FDCLUBA1', panel(heading('Espace ClubAdi', badge) + '<p>ClubAdi s’ouvrait dans le navigateur intégré ADISCAPE. Ses pages étaient chargées depuis le serveur Coktel et ne figurent pas sur les CD.</p><p>Cette page permet de retrouver les autres espaces de la planète.</p><div class="stack">' + button('Espace OnAdi', 'go', 'onadi') + button('Le monde des classes virtuelles', 'go', 'world') + button('Messagerie enfant', 'go', 'mail') + '</div>')];
    default: return parentScreen() || ['FD3P', panel('Cet écran n’est pas disponible.')];
  }
}
function showHelp(content) {
  root.querySelector('.net-help')?.remove();
  const overlay = document.createElement('div'); overlay.className = 'net-help'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-label', 'Explication');
  overlay.innerHTML = `${button('Fermer', 'closeHelp')}<h2>Explication</h2>${content}`; root.querySelector('.net-stage').append(overlay); overlay.querySelector('button').focus();
}
function confirmRemoval(message, action, id) {
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'net-confirm';
  dialog.setAttribute('aria-labelledby', 'confirmation-title');
  dialog.innerHTML = `<p id="confirmation-title">${esc(message)}</p><div class="row">${button('Oui', action, id)}<form method="dialog"><button autofocus>Non</button></form></div>`;
  root.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); previousFocus?.focus(); }, { once: true });
  dialog.showModal();
}
function render() {
  playback.pause(); clearTimeout(motionTimer); clearTimeout(ambientTimer); observer?.disconnect();
  const [background, content] = screenContents();
  root.innerHTML = `<div class="net-wrap"><div class="net-bar"><small>ADI INTERNET · <strong>SIMULATION LOCALE</strong> · ${esc(state().profile)}</small>${button('La chambre', 'exit')}</div><nav class="net-nav" aria-label="Navigation Internet">${screen !== 'connect' ? `${button('Retour', 'back')}${button('Les trois planètes', 'go', 'home')}${button('Carnet des copains', 'go', 'friends')}${button('Mes préférés', 'favorites')}` : ''}</nav><div class="net-viewport"><div class="net-stage" style="background-image:url('${asset(background + '.webp')}')" data-screen="${screen}">${content}<nav class="toolbar" aria-label="Menu du bas">${button('Imprimer', 'print')}${button('Aide', 'helpMode')}${button('Valider', 'validate')}${button('Sortir', 'back')}</nav></div></div><div class="net-bar">${button('Écouter les instructions', 'voice')}${button(soundEnabled ? 'Couper le son' : 'Activer le son', 'sound')}${button(helpMode ? 'Quitter le mode explication' : 'Mode explication', 'helpMode')}${button('Repérer les zones', 'zones')}</div><p class="net-status" role="status">${esc(notice)}</p><details class="net-details"><summary>Origine des contenus et fonctionnement local</summary><p>Interfaces, graphismes, voix, libellés et zones des menus : fichiers ADI 4.21. OnAdi, messages, personnes, places, bons points et abonnement : données de démonstration.</p><p>${catalog.playableExercises} exercices adaptés sur ${catalog.exerciseCount} modules originaux. Les exercices jouables conservent leurs textes, réponses et aides ; les autres formats, le déroulement collectif et les anciens services ne sont pas entièrement portés.</p><p>Stockage : ${engine.storageError ? 'indisponible — progression temporaire' : 'dans ce navigateur'}. Aucun service externe. Toutes les adresses historiques restent du texte.</p>${button('Vérifier les ressources locales', 'audit')}<output id="network-audit"></output></details></div>`;
  const viewport = root.querySelector('.net-viewport'); const stage = root.querySelector('.net-stage');
  observer = new ResizeObserver(() => { stage.style.transform = `scale(${viewport.clientWidth / 640})`; }); observer.observe(viewport);
  if (menuDefinitions[screen]) scheduleAmbient(ambient.initialDelay * 1000);
}
const inform = text => { notice = text; status(); };
root.addEventListener('click', event => {
  const el = event.target.closest('[data-action]'); if (!el) return;
  const { action, value } = el.dataset;
  if (helpMode && el.classList.contains('net-zone')) { speak(el.dataset.voice); inform(el.getAttribute('aria-label')); return; }
  try {
    switch (action) {
      case 'connect': run('connect'); go('home'); speak('COGE0100'); break;
      case 'presentation': speak('NETADI', true); break;
      case 'go': go(value); break;
      case 'back': back(); break;
      case 'exit':
        playback.pause(); if (window.parent !== window) window.parent.postMessage({ type: 'adi-internet-exit' }, location.origin); else location.href = '/#room'; break;
      case 'voice': speak(menuDefinitions[screen]?.[5] || ({ connect:'COGE0100', classes:'ENGE0700', netadi:'ENGE1400', results:'ENGE0800', reservations:'ENGE1500', points:'ENGE1600', mail:'ENGE1300', parentMail:'PAGE1300' })[screen] || 'ENGE1000'); break;
      case 'sound': soundEnabled = !soundEnabled; render(); break;
      case 'helpMode': helpMode = !helpMode; render(); break;
      case 'zones': root.querySelector('.net-stage').classList.toggle('show-zones'); break;
      case 'help':
        showHelp('<p>Les menus reprennent les zones du jeu original. Active le mode explication puis clique sur un bâtiment pour écouter sa description.</p><p>Le menu du bas apparaît au survol de la scène. Utilise la porte ou Retour pour revenir à l’écran précédent.</p><p>Les opérations de publication, messagerie, réservation et abonnement sont uniquement locales.</p>'); break;
      case 'closeHelp': root.querySelector('.net-help')?.remove(); break;
      case 'print': window.print(); break;
      case 'validate': if (root.querySelector('form')) root.querySelector('form').requestSubmit(); else if (screen === 'exercise') root.querySelector(`[data-action="${checked ? 'nextQuestion' : 'checkAnswer'}"]`)?.click(); break;
      case 'favorites':
        go(selectedCategory); onlyFavorites = true; render(); break;
      case 'allArticles': onlyFavorites = false; render(); break;
      case 'writeArticle': writer = true; writeChapter = value === 'chapter'; render(); break;
      case 'chapter': chapter = Math.max(0, chapter + Number(value)); render(); break;
      case 'vote': run('voteItem', { id: selectedArticle, vote: Number(value) }); render(); inform('Ton vote est enregistré.'); break;
      case 'favorite': run('favorite', { id: selectedArticle }); render(); break;
      case 'author': profileId = value; go('profile'); break;
      case 'addFriend': case 'removeFriend': run(action, { id: value }); render(); inform('Le carnet a été mis à jour.'); break;
      case 'composeTo':
        run('addFriend', { id: value }); go('mail'); replyTo = [value]; writer = true; render(); break;
      case 'writeMail': replyTo = []; writer = true; render(); break;
      case 'selectMail':
        if (selectedMailId === value) { run('readMail', { id: value }); mailId = value; }
        selectedMailId = value; render(); break;
      case 'readMail': run('readMail', { id: value }); mailId = value; selectedMailId = value; render(); break;
      case 'reply': replyTo = state().friends.includes(value) || parentMail ? [value] : []; writer = true; render(); break;
      case 'deleteMail': confirmRemoval('Veux-tu effacer ce message ?', 'confirmDeleteMail', value); break;
      case 'confirmDeleteMail': run('deleteMail', { id: value }); mailId = null; selectedMailId = null; render(); root.querySelector('[data-action="writeMail"]')?.focus(); break;
      case 'mailList': mailId = null; writer = false; render(); break;
      case 'site': navSites = navSites.slice(0, siteIndex + 1); navSites.push(value); siteIndex++; render(); break;
      case 'siteBack': siteIndex = Math.max(-1, siteIndex - 1); render(); break;
      case 'siteForward': siteIndex = Math.min(navSites.length - 1, siteIndex + 1); render(); break;
      case 'siteHome': siteIndex = -1; render(); break;
      case 'siteStop': inform('Chargement terminé.'); break;
      case 'exercise':
        exercise = lessons.find(l => l.id === value); if (!exercise) throw new Error('Cet exercice est indisponible.');
        questionIndex = 0; chosen = []; answers = []; checked = false; go('exercise'); break;
      case 'answer': if (!checked) { const i = Number(value); chosen = chosen.includes(i) ? chosen.filter(n => n !== i) : [...chosen, i]; render(); } break;
      case 'checkAnswer':
        if (!chosen.length) throw new Error('Choisis une réponse avant de valider.');
        if (!checked) { answers.push([...chosen]); checked = true; render(); } break;
      case 'nextQuestion':
        if (!checked) break;
        if (questionIndex + 1 < exercise.questions.length) { questionIndex++; chosen = []; checked = false; render(); }
        else { const result = run('finishExercise', { lesson: exercise.id, answers }); go('results'); inform(`${result.correct}/${result.total} bonne(s) réponse(s) · ${result.score}/20. Tes points ont été mis à jour.`); } break;
      case 'lessonHelp': showHelp(exercise.help.map(t => `<p style="white-space:pre-wrap">${esc(t)}</p>`).join('') || '<p>Aucune aide textuelle présente pour cet exercice.</p>'); break;
      case 'calendarWeek': {
        const next = addDays(calendarWeek, Number(value) * 7);
        if (next >= weekStart(Date.now()) && next <= weekStart(addDays(Date.now(), 28))) calendarWeek = next;
        render(); break;
      }
      case 'calendarHours': firstHour = Math.max(0, Math.min(16, firstHour + Number(value))); render(); break;
      case 'myReservations': myReservations = true; render(); break;
      case 'calendar': booking = null; myReservations = false; render(); break;
      case 'calendarSlot': {
        const date = Number(value);
        const existing = state().reservations.find(r => hourStart(r.date) === date);
        const session = existing && catalog.sessions.find(s => s.id === existing.session);
        if (session && (session.subject !== subject || session.level !== level)) throw new Error('Tu as déjà réservé une séance à cette heure, pour une autre matière ou un autre niveau. Retrouve-la dans « Mes réservations ».');
        if (!existing && !canReserve(date, Date.now())) throw new Error('Séance indisponible.');
        openBooking(date, existing); break;
      }
      case 'openBooking': {
        const existing = state().reservations.find(r => r.id === value);
        if (existing) openBooking(hourStart(existing.date), existing);
        break;
      }
      case 'chooseSeat': booking.seat = Number(value); render(); break;
      case 'cancelReservation': confirmRemoval('Es-tu sûr de vouloir annuler ta réservation ?', 'confirmCancelReservation', value); break;
      case 'confirmCancelReservation': run('cancelReservation', { id: value }); booking = null; render(); inform('Réservation annulée.'); root.querySelector('[data-action="myReservations"], [data-action="calendar"]')?.focus(); break;
      case 'resultGraph': root.querySelector('#results-chart').hidden = false; root.querySelector('#results-table').hidden = true; break;
      case 'resultTable': root.querySelector('#results-chart').hidden = true; root.querySelector('#results-table').hidden = false; break;
      case 'diploma': showHelp('<p>Le diplôme original était accordé après toutes les séances d’une matière. Le catalogue n’étant pas entièrement porté, aucun diplôme de fin de matière n’est attribué.</p><img style="width:100%" src="/game/internet/FDDIP.webp" alt="Modèle original du diplôme, non attribué">'); break;
      case 'giftInfo': { const g = gifts.find(g => g.id === value); showHelp(`<p>${esc(g.title)} · ${g.price} points.</p><p>Décor original utilisé comme bon point de démonstration. Les anciennes collections du serveur ne sont pas présentes sur les CD.</p>`); break; }
      case 'gift': {
        const g = run('giveGoodie', { id: value }); render(); showHelp(`<img style="width:100%" src="${asset(g.file)}" alt="${esc(g.title)}"><p>${esc(g.title)}</p><a href="${asset(g.file)}" download="adi-${g.id}.webp">Enregistrer cette image</a>`); break;
      }
      case 'superGift': showHelp('<p>Dans le jeu, un score permettait d’obtenir un cadeau envoyé par la poste. Le cadeau et son seuil venaient du serveur.</p><p>Cette offre est présentée pour mémoire. La simulation n’envoie aucun cadeau et ne demande aucune adresse.</p>'); break;
      case 'gag': speak(value, true); break;
      case 'demoSaved': inform('Coordonnées validées.'); break;
      case 'profileName': run('chooseProfile', { name: value }); render(); inform('Personnage sélectionné.'); break;
      case 'audit': {
        const external = resourceLog.filter(url => new URL(url, location.href).origin !== location.origin);
        root.querySelector('#network-audit').textContent = `${resourceLog.length} ressources observées · ${external.length} ressource externe · ${securityViolations.length} tentative bloquée. Les anciennes adresses ne sont jamais visitées.`;
        break;
      }
    }
  } catch (error) { inform(error.message); }
});
root.addEventListener('change', event => {
  const { id, value } = event.target;
  if (id === 'subject') { subject = value; render(); }
  else if (id === 'level') { level = value; render(); }
  else if (id === 'session') { chosenSession = value; render(); }
  else if (id === 'booking-theme') { chosenSession = sessionChoices().find(s => s.theme === value)?.id; render(); }
  else if (id === 'calendar-hour') { firstHour = Number(value); render(); root.querySelector('#calendar-hour')?.focus(); }
  else if (id === 'article-choice') { selectedArticle = value; chapter = 0; render(); }
});
root.addEventListener('input', event => {
  if (event.target.id === 'exercise-search') {
    const position = event.target.selectionStart; lessonFilter = event.target.value; render();
    const field = root.querySelector('#exercise-search'); field.focus(); field.setSelectionRange(position, position);
  }
});
root.addEventListener('submit', event => {
  if (event.target.getAttribute('method') === 'dialog') return;
  event.preventDefault(); const formElement = event.target; const data = new FormData(formElement); const get = k => data.get(k);
  try {
    switch (formElement.id) {
      case 'article': {
        if (writeChapter) run('writeChapter', { id: selectedArticle, body: get('body') });
        else selectedArticle = run('writeItem', { category: selectedCategory, title: get('title'), body: get('body') }).id;
        writer = false; writeChapter = false; onlyFavorites = false; render(); inform('Ton texte a été enregistré.'); break;
      }
      case 'mail':
        run('writeMail', { to: data.getAll('to'), title: get('title'), body: get('body'), parent: parentMail });
        writer = false; mailId = null; render(); inform('Message envoyé.'); break;
      case 'taste': run('taste', { text: get('text') }); render(); inform('Fiche de goût enregistrée.'); break;
      case 'controls': run('controls', { forum: get('forum'), forumMinutes: Number(get('minutes')), reservationLimit: get('limit') === '' ? null : Number(get('limit')), restricted: get('restricted') === 'on' }); render(); inform('Réglages enregistrés.'); break;
      case 'site': run('addSite', { name: get('name'), address: get('address') }); render(); inform('Site ajouté à NetAdi.'); break;
      case 'navigate': {
        const address = String(get('address')).trim().replace(/\/$/, '');
        let id = state().sites.find(s => s.address.replace(/\/$/, '') === address)?.id;
        const index = catalog.sites.filter(s => !s.startsWith('file:')).findIndex(s => s.replace(/\/$/, '') === address);
        if (index >= 0) id = `site-${index}`;
        if (!id) { inform(state().controls.restricted ? 'Accès au site interdit. Seuls les sites prédéfinis sont accessibles.' : 'Accès au site impossible. Aucune fiche n’existe pour cette adresse.'); break; }
        navSites = navSites.slice(0, siteIndex + 1); navSites.push(id); siteIndex++; render(); break;
      }
      case 'reserve':
        run('reserve', { ...booking, session: chosenSession });
        calendarWeek = weekStart(booking.date); firstHour = Math.min(16, new Date(booking.date).getHours());
        booking = null; myReservations = false; render(); inform('Réservation enregistrée.'); break;
      case 'chat': run('chat', { text: get('text') }); render(); root.querySelector('.chat-log').scrollTop = 1e6; break;
      case 'subscription': run('subscription', { enabled: get('enabled') === 'on', renewal: get('renewal') === 'on' }); render(); inform('Abonnement mis à jour.'); break;
      case 'symbol': run('parentSymbol', { symbol: get('symbol') }); parentUnlocked = false; render(); inform('Symbole enregistré.'); break;
      case 'unlock': if (get('symbol') !== state().parentSymbol) throw new Error('Symbole incorrect.'); parentUnlocked = true; go('parents'); break;
    }
  } catch (error) { inform(error.message); }
});
async function init() {
  try {
    const files = ['catalog.json', 'lessons.json', 'media.json', 'ambient.json'];
    [catalog, lessons, media, ambient] = await Promise.all(files.map(async f => { const response = await fetch(asset(f)); if (!response.ok) throw new Error(`Ressource locale manquante : ${f}`); return response.json(); }));
    let storage;
    try { storage = localStorage; } catch { storage = { getItem() { throw new Error('Stockage indisponible'); } }; }
    engine = createLocalInternet({ catalog, lessons, storage });
    screen = state().connected ? 'home' : 'connect'; render();
    const timer = setInterval(() => {
      if (!alive || document.hidden) return;
      if (['forum','onadi','netadi','club',...categories.map(c => c.id)].includes(screen)) {
        run('forumTime', { seconds: 5 });
        if (!engine.forumAllowed()) { screen = 'home'; render(); inform('Le temps de forum accordé est dépassé.'); }
      }
    }, 5000);
    window.addEventListener('pagehide', () => { alive = false; clearInterval(timer); clearTimeout(motionTimer); clearTimeout(ambientTimer); playback.pause(); observer?.disconnect(); }, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) playback.pause(); });
  } catch (error) { root.innerHTML = `<div class="net-error"><h1>La planète Internet n’a pas pu s’ouvrir</h1><p>${esc(error.message)}</p><p>Recharge cette page après avoir préparé les ressources locales.</p></div>`; }
}
function scheduleAmbient(delay) {
  ambientTimer = setTimeout(() => {
    const key = {home:0, forum:1, onadi:2, world:3, parents:4}[screen];
    if (!alive || key === undefined) return;
    if (document.hidden) { scheduleAmbient(1000); return; }
    const choices = ambient.groups[key].filter(name => name !== lastAmbient && media[name]?.image);
    if (!choices.length) return;
    const name = choices[Math.floor(Math.random() * choices.length)]; lastAmbient = name;
    const clip = media[name], img = new Image(); img.className = 'net-biscouette'; img.alt = ''; img.dataset.clip = name;
    Object.assign(img.style, {position:'absolute',left:`${clip.x}px`,top:`${clip.y}px`,width:`${clip.width}px`,height:`${clip.height}px`,pointerEvents:'none',zIndex:3});
    img.onload = () => {
      if (!img.isConnected) return;
      ambientTimer = setTimeout(() => { img.remove(); scheduleAmbient((ambient.pauseMin + Math.floor(Math.random() * ambient.pauseChoices)) * 1000); }, clip.duration * 1000);
    };
    img.src = asset(clip.image); root.querySelector('.net-stage').append(img);
  }, delay);
}
init();
