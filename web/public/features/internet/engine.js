// Local replacement for the retired server. No networking, DOM, or credentials.
export const storageKey = 'adi4-internet-local-v1';
export const categories = [
  { id: 'novels', label: 'Romans', background: 'FDROMAN', voice: 'ENZO1004' },
  { id: 'news', label: 'Brèves', background: 'FDBREVES', voice: 'ENZO1002' },
  { id: 'jokes', label: 'Blagues', background: 'FDBLAGUE', voice: 'ENZO1001' },
  { id: 'stories', label: 'Histoires', background: 'FDHISTOI', voice: 'ENZO1003' },
  { id: 'ads', label: 'Annonces', background: 'FDPA', voice: 'ENZO1005' },
];
export const companions = [
  { id: 'lina', name: 'Lina', taste: 'Les étoiles, les histoires et le dessin.' },
  { id: 'nino', name: 'Nino', taste: 'Les énigmes et les découvertes scientifiques.' },
  { id: 'sacha', name: 'Sacha', taste: 'La musique et les jeux de mots.' },
];
export const gifts = [
  { id: 'planets', title: 'Les trois planètes', file: 'FD3P.webp', price: 5 },
  { id: 'forum', title: 'Le forum', file: 'FDFORUM.webp', price: 10 },
  { id: 'classroom', title: 'La récréation', file: 'RECREA02.webp', price: 15 },
];
const seeds = [
  ['novels', 'La porte des étoiles', 'lina', 'Au fond du jardin, une petite porte brillait. Lina tourna la poignée et découvrit un escalier qui montait vers les étoiles. Qui allait-elle rencontrer ?'],
  ['news', 'Bienvenue sur la planète ADI', 'nino', 'Les décors viennent du jeu original. Ce petit journal est un exemple créé pour découvrir OnAdi : aucun ancien message d’enfant n’a été récupéré.'],
  ['jokes', 'La blague de la souris', 'sacha', 'Que dit une souris devant un ordinateur ? « Enfin une copine ! »'],
  ['stories', 'Un voyage en papier', 'lina', 'Nino plia une feuille pour en faire une fusée. Dans son imagination, elle traversa la chambre et se posa sur une planète bleue.'],
  ['ads', 'Un roman à plusieurs mains', 'nino', 'Tu peux continuer le roman de démonstration et essayer les votes, les préférés et la messagerie.'],
];
const clean = (value, max = 20000) => String(value ?? '').trim().slice(0, max);
const requireValue = (value, message) => { if (!value) throw new Error(message); return value; };
export function weekStart(timestamp) {
  const date = new Date(timestamp); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return date.getTime();
}
export function grade(question, selected) {
  const unique = [...new Set(selected)];
  if (unique.some(i => !Number.isInteger(i) || i < 0 || i >= question.choices.length)) return false;
  return unique.reduce((mask, i) => mask + 2 ** i, 0) === question.answerMask;
}
export function createLocalInternet({ catalog, lessons, storage, now = Date.now }) {
  const initial = () => ({
    version: 1, profile: 'Voyageur', connected: false, nextId: 1, friends: ['lina', 'nino'],
    taste: 'Les sciences et les jeux.', articles: seeds.map(([category, title, author, body], i) => ({ id: `demo-${i}`, category, title, author, theme: 'Démonstration', chapters: [body], demo: true, votes: {}, closed: false })),
    favorites: [], messages: [{ id: 'welcome', from: 'lina', to: ['Voyageur'], title: 'Bienvenue !', body: 'Je suis un personnage de démonstration. Tu peux me répondre pour découvrir la messagerie.', date: now(), read: false, demo: true }],
    reservations: [], attempts: [], rewards: [], spent: 0, controls: { forum: 'unlimited', forumMinutes: 60, reservationLimit: null, restricted: true },
    forumTime: {}, sites: [], chats: [], subscription: true, renewal: false, parentSymbol: 'sans',
  });
  let state;
  let storageError = false;
  try { const s = JSON.parse(storage?.getItem(storageKey) || 'null'); state = s?.version === 1 && Array.isArray(s.articles) && Array.isArray(s.messages) && s.controls ? s : initial(); }
  catch { state = initial(); storageError = true; }
  const save = () => { try { storage?.setItem(storageKey, JSON.stringify(state)); } catch { storageError = true; } };
  const id = () => `local-${state.nextId++}`;
  const article = id => requireValue(state.articles.find(a => a.id === id), 'Ce texte n’est plus disponible.');
  const activeWeek = () => String(weekStart(now()));
  const earned = () => Object.values(Object.groupBy(state.attempts, a => a.lesson)).reduce((sum, attempts) => sum + Math.max(...attempts.map(a => a.correct)) * 5, 0);
  const forumAllowed = () => state.controls.forum !== 'blocked' && (state.controls.forum !== 'limited' || (state.forumTime[activeWeek()] || 0) < state.controls.forumMinutes * 60);
  function assertForum() { requireValue(forumAllowed(), state.controls.forum === 'blocked' ? 'Tes parents ont interdit l’accès au forum.' : 'Le temps de forum accordé pour cette semaine est dépassé.'); }
  function request(operation, p = {}) {
    let result;
    switch (operation) {
      case 'connect':
        state.connected = true; result = state.profile; break;
      case 'disconnect': state.connected = false; break;
      case 'chooseProfile':
        requireValue(['Voyageur', 'Astronaute', 'Explorateur'].includes(p.name), 'Choisis un personnage de démonstration.');
        state.profile = p.name; break;
      case 'writeItem': {
        assertForum(); const category = requireValue(categories.find(c => c.id === p.category), 'Choisis une rubrique.');
        const title = requireValue(clean(p.title, 120), 'Saisis un titre pour ton texte.');
        const body = requireValue(clean(p.body), 'Écris ton texte.');
        result = { id: id(), category: category.id, title, author: state.profile, theme: 'Démonstration', chapters: [body], demo: false, votes: {}, closed: false };
        state.articles.push(result); break;
      }
      case 'writeChapter': {
        assertForum(); const a = article(p.id); requireValue(a.category === 'novels' && !a.closed, 'Ce roman est terminé.');
        a.chapters.push(requireValue(clean(p.body), 'Écris la suite du roman.')); break;
      }
      case 'voteItem': {
        assertForum(); requireValue(Number.isInteger(p.vote) && p.vote >= 0 && p.vote <= 3, 'Vote invalide.');
        article(p.id).votes[state.profile] = p.vote; break;
      }
      case 'favorite': article(p.id); state.favorites = state.favorites.includes(p.id) ? state.favorites.filter(x => x !== p.id) : [...state.favorites, p.id]; break;
      case 'addFriend': requireValue(companions.some(c => c.id === p.id), 'Ce correspondant est introuvable.'); if (!state.friends.includes(p.id)) state.friends.push(p.id); break;
      case 'removeFriend': state.friends = state.friends.filter(x => x !== p.id); break;
      case 'taste': state.taste = clean(p.text, 300); break;
      case 'writeMail': {
        if (!p.parent) assertForum();
        const allowed = p.parent ? ['consommateurs', 'technique', 'achat'] : state.friends;
        const to = [...new Set(p.to || [])].filter(x => allowed.includes(x));
        requireValue(to.length, 'Choisis un destinataire.');
        const title = requireValue(clean(p.title, 120), 'Saisis un titre pour ton message.');
        const body = requireValue(clean(p.body), 'Écris ton message.');
        result = { id: id(), from: state.profile, to, title, body, date: now(), read: true, parent: !!p.parent };
        state.messages.push(result, { id: id(), from: to[0], to: [state.profile], title: `Re : ${title}`, body: 'Merci pour ton message ! Retrouve-moi dans la récréation ou continue notre roman dans OnAdi.', date: now(), read: false, demo: true, parent: !!p.parent }); break;
      }
      case 'readMail': result = requireValue(state.messages.find(m => m.id === p.id), 'Ce message n’est plus disponible.'); result.read = true; break;
      case 'deleteMail': state.messages = state.messages.filter(m => m.id !== p.id); break;
      case 'controls': {
        requireValue(['unlimited', 'limited', 'blocked'].includes(p.forum), 'Limitation invalide.');
        const minutes = Number(p.forumMinutes); const limit = p.reservationLimit === null ? null : Number(p.reservationLimit);
        requireValue(Number.isFinite(minutes) && minutes >= 0 && minutes <= 10080 && (limit === null || Number.isInteger(limit) && limit >= 0 && limit <= 1000), 'Limite invalide.');
        state.controls = { forum: p.forum, forumMinutes: minutes, reservationLimit: limit, restricted: !!p.restricted }; break;
      }
      case 'forumTime': {
        const seconds = Math.min(60, Math.max(0, Number(p.seconds) || 0));
        state.forumTime[activeWeek()] = (state.forumTime[activeWeek()] || 0) + seconds; break;
      }
      case 'reserve': {
        const session = requireValue(catalog.sessions.find(s => s.id === p.session && s.active), 'Séance indisponible.');
        requireValue(state.subscription, 'Active l’abonnement fictif dans le coin parents.');
        const date = Number(p.date); const d = new Date(date);
        requireValue(Number.isFinite(date) && date > now() && date <= now() + 28 * 86400000 && ![4, 5].includes(d.getHours()), 'Choisis une heure disponible dans les quatre prochaines semaines.');
        requireValue(!state.reservations.some(r => r.date === date), 'Tu as déjà réservé une séance à cette heure.');
        const booked = state.reservations.filter(r => weekStart(r.date) === weekStart(date)).length;
        requireValue(state.controls.reservationLimit === null || booked < state.controls.reservationLimit, 'Le nombre de réservations accordé est dépassé.');
        requireValue(Number.isInteger(p.seat) && p.seat >= 1 && p.seat <= 6, 'Choisis une place.');
        result = { id: id(), session: session.id, date, seat: p.seat }; state.reservations.push(result); break;
      }
      case 'cancelReservation': state.reservations = state.reservations.filter(r => r.id !== p.id); break;
      case 'finishExercise': {
        const l = requireValue(lessons.find(l => l.id === p.lesson), 'Exercice indisponible.');
        requireValue(Array.isArray(p.answers) && p.answers.length === l.questions.length, 'Termine toutes les questions.');
        const correct = l.questions.filter((q, i) => grade(q, p.answers[i])).length;
        result = { id: id(), lesson: l.id, correct, total: l.questions.length, score: Math.round(correct / l.questions.length * 20), date: now() };
        state.attempts.push(result); break;
      }
      case 'giveGoodie': {
        const gift = requireValue(gifts.find(g => g.id === p.id), 'Bon point indisponible.');
        if (!state.rewards.includes(gift.id)) {
          requireValue(earned() - state.spent >= gift.price, 'Tu n’as pas encore assez de points pour télécharger ce bon point.');
          state.spent += gift.price; state.rewards.push(gift.id);
        }
        result = gift; break;
      }
      case 'chat': {
        assertForum(); const message = requireValue(clean(p.text, 500), 'Écris un message.');
        state.chats.push({ from: state.profile, text: message }, { from: 'Azerty', text: 'Message reçu ! Tu peux choisir une activité ou revenir à ta leçon.' });
        state.chats = state.chats.slice(-100); break;
      }
      case 'addSite': {
        const name = requireValue(clean(p.name, 80), 'Donne un intitulé.');
        const address = requireValue(clean(p.address, 200), 'Donne une adresse.');
        // Addresses are inert display text. They are never assigned to a URL attribute.
        state.sites.push({ id: id(), name, address }); break;
      }
      case 'subscription': state.subscription = !!p.enabled; state.renewal = !!p.renewal; break;
      case 'parentSymbol': requireValue(['sans', 'étoile', 'lune', 'soleil'].includes(p.symbol), 'Symbole invalide.'); state.parentSymbol = p.symbol; break;
      default: throw new Error('Opération locale inconnue.');
    }
    save(); return result;
  }
  return { get state() { return structuredClone(state); }, get storageError() { return storageError; }, request, forumAllowed, earned, balance: () => earned() - state.spent };
}
