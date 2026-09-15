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
      <p><strong>La chambre :</strong> l’introduction dans le vaisseau, le décor original et sa barre animée, les objets interactifs et leurs gros plans, les gestes, déplacements et répliques d’Adi. La radio propose 17 musiques et 10 ambiances.</p>
      <p><strong>Les documents :</strong> les animaux en danger, le cycle de l’eau, l’astronomie, les planètes et la conquête de l’espace, avec les décors, zones cliquables, films et voix d’origine. L’Atlas propose cinq cartes, le zoom, les calques, les légendes et les médias géographiques en JavaScript. La pollution de l’air et de l’eau, l’équilibre de la nature et l’entreprise proposent leurs réglages, animations, sons et trois cas de reconstitution en JavaScript. Le mode Comprendre de l’équilibre de la nature présente les liens de l’écosystème avec les flèches et voix originales. L’entreprise présente cinq réglages avec leurs limites d’investissement et quatre explications animées. La pollution de l’eau propose sept réglages et sept explications animées sur les sources de pollution. La désertification propose trois réglages à valider, trois cas, quatre explications animées et les séquences d’ambiance du script. Le développement d’un pays propose six réglages, quatre cas, six explications animées et les réactions d’Adi. Les douze documents fonctionnent en JavaScript, avec les médias originaux.</p>
      <p><strong>Les jeux :</strong> la caisse donne accès à Sokoban et ses 15 niveaux, aux trois Goblins, à Mr. Matt I et II (25 et 35 niveaux), ainsi qu’aux quatre épisodes de Bad Toys 3D. Elle se parcourt aussi avec la molette de la souris.</p>
      <p><strong>Les sciences :</strong> les décors de la station, 14 simulations avec leurs calculs, restrictions de réglage, parcours de défis, animations et voix, l’encyclopédie illustrée et ses films, les cours de la 6e à la 3e, le dictionnaire et le carnet personnel.</p>
      <p><strong>La planète Internet :</strong> retrouve les correspondants et les services d’Adi dans une simulation locale, sans connexion aux anciens services en ligne.</p>
      <p><strong>Encore en reconstruction :</strong> les exercices, les autres jeux, les outils. Les sessions de l’Atlas et des simulations d’environnement ne sont pas sauvegardées. Les finitions de fidélité restent obligatoires : animations d’ambiance, synchronisation, menus, polices et interactions des documents. Certains médias des simulations restent indisponibles et leur synchronisation audiovisuelle n’est pas garantie à l’identique. Certaines séquences, transitions et interactions restent à restituer, et les illustrations et médias des cours ne sont pas encore tous disponibles.</p>
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
