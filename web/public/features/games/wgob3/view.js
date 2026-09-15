export function renderWGob3(main, episode = '3') {
  const title = {1: 'Gobliiins', 2: 'Gobliins 2', 3: 'Goblins 3'}[episode];
  const description = {
    1: 'Trois gobelins aux talents complémentaires, dans l’édition française de ton disque ADI.',
    2: 'L’aventure de Fingus et Winkle, dans l’édition française de ton disque ADI.',
    3: 'L’aventure de Blount, dans l’édition française de ton disque ADI.',
  }[episode];
  document.title = `${title} · ADI 4`;
  main.innerHTML = `<section class="wgob3-page"><a href="#games" class="back-link">← Les jeux</a>
    <h1>${title}</h1><p>${description}</p>
    <iframe class="wgob3-frame" src="/wgob3/player.html?game=wgob${episode}" title="${title} — jeu original" allow="autoplay; fullscreen" allowfullscreen></iframe>
    <p class="quiet">Clique dans le jeu pour capturer la souris, sélectionner un personnage, te déplacer ou agir. Place le curseur contre les bords gauche ou droit pour faire défiler les décors plus larges que l’écran. Échap libère la souris ; clique dans le jeu pour la capturer à nouveau. ${episode === '1' ? 'Le tableau de bord se trouve en bas de l’écran.' : 'Survole le haut de l’écran pour ouvrir le tableau de bord.'} Le bouton « Passer · Échap » permet de passer le générique.${episode === '1' ? ' Note les codes de niveau donnés par le jeu pour reprendre ton aventure.' : ' Utilise le menu du jeu pour sauvegarder.'}</p>
    <details class="wgob3-credits"><summary>À propos de cette version</summary>
      <p>Données originales de WGOB${episode}, interprétées par le moteur Gob de ScummVM 2.9.0 compilé en WebAssembly.</p>
      <p><a href="/vendor/wgob3/COPYING">Licence du moteur</a> ·
      <a href="https://github.com/scummvm/scummvm/tree/v2.9.0">Sources ScummVM 2.9.0</a></p>
    </details></section>`;
}
