export function createShell(isStorageAvailable) {
  const $ = (selector) => document.querySelector(selector);
  const main = $('#main');
  const dialog = $('#info-dialog');
  let toastTimer;
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
  dialog.addEventListener('close', () =>
    dialog.querySelectorAll('audio,video').forEach((media) => media.pause()),
  );
  $('#about-button').onclick = () =>
    info(
      'Une nouvelle vie pour Adi 4',
      `<p>Cette version utilise les images et les textes de ton jeu original.</p><p><strong>Déjà accessible :</strong> une première chambre avec sa barre animée, Sokoban et ses 15 niveaux, les décors originaux de la station, 14 simulations avec leurs calculs, animations et voix, l’encyclopédie illustrée et ses films, les cours des quatre niveaux, le dictionnaire et un carnet enregistré sur cet appareil.</p><p><strong>À venir :</strong> les objets et surprises de la chambre, les séquences complètes d’Adi, les exercices et les autres jeux. La chambre utilise encore une capture de référence avec Adi immobile.</p><p>Les textes sont ceux de l’édition originale de 1998–1999. Leur contenu n’a pas été actualisé. Les illustrations et médias liés aux cours ne sont pas encore tous disponibles.</p><p>Le carnet web est indépendant des sauvegardes du jeu d’origine. ${isStorageAvailable() ? 'Il est enregistré dans ce navigateur.' : 'Le stockage du navigateur est actuellement indisponible.'}</p>`,
    );

  return { main, info, toast };
}
