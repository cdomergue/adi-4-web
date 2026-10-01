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
      `<p>Redécouvre ADI 4 Sciences dans ton navigateur, avec les décors, les textes, les animations, les musiques et les voix du jeu original.</p>
      <p><strong>La chambre :</strong> retrouve Adi, explore les objets interactifs et écoute les musiques et ambiances de la radio.</p>
      <p><strong>Les documents :</strong> douze activités pour découvrir la nature, l’espace, la géographie, l’environnement et l’économie, avec des cartes, des films et des expériences interactives.</p>
      <p><strong>Les jeux :</strong> la caisse donne accès à Sokoban, aux trois Goblins, à Mr. Matt I et II, à BeeBop I et II, à Place Ball et aux quatre épisodes de Bad Toys 3D.</p>
      <p><strong>Les sciences :</strong> regarde l’arrivée à la station, retrouve Adi et les ambiances des laboratoires, explore 14 simulations et neuf documents vidéo, puis consulte l’encyclopédie, les cours de la 6e à la 3e, le dictionnaire et ton carnet personnel.</p>
      <p><strong>La planète Internet :</strong> retrouve les correspondants et les services d’Adi dans une simulation, sans connexion aux anciens services en ligne.</p>
      <p><strong>Encore en reconstruction :</strong> les exercices, les autres jeux et les outils. Certains contenus, animations et interactions manquent encore. Les sons et les images ne sont pas toujours parfaitement synchronisés, et la fidélité de certains jeux reste à vérifier.</p>
      <p>Les réglages de l’Atlas et des activités sur l’environnement ne sont pas conservés après leur fermeture, sauf le choix de présentation automatique de l’Atlas.</p>
      <p>Les textes sont ceux de l’édition originale de 1998–1999. Leur contenu n’a pas été actualisé.</p>
      <p>Le carnet web est indépendant des sauvegardes du jeu d’origine. ${isStorageAvailable() ? 'Il est enregistré dans ce navigateur.' : 'Le stockage du navigateur est actuellement indisponible.'}</p>`,
    );

  $('#credits-button').onclick = () =>
    info(
      'Crédits',
      `<p><strong>Portage web :</strong> Christophe Domergue</p>
      <p><strong>Jeu original :</strong> ADI 4 · Coktel</p>
      <p><strong>L’équipe présentée dans le jeu original</strong></p>
      <figure class="credits-team"><img src="/game/room/credits-team.webp" width="640" height="480" alt="La photo d’équipe présente dans le jeu original ADI 4"></figure>
      <p>Cathy, Philippe, Didier, Herbie, Julien, Pascal, Nabil, Hervé, Rodolphe, Thomas, Boris, Réginald, Ollivier et Manouf.</p>
      <p>Cette photo et ces prénoms ou pseudonymes proviennent de la présentation d’équipe du jeu. Ils sont repris tels quels ; cette présentation ne précise ni les noms complets ni les fonctions et ne constitue pas un générique exhaustif.</p>
      <p><strong>Moteur des trois Goblins :</strong> ScummVM 2.9.0, compilé en WebAssembly. <a href="/vendor/wgob3/COPYING">Licence du moteur</a>.</p>`,
    );

  return { main, info, toast };
}
