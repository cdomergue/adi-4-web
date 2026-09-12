export function renderWGob3(main) {
  document.title = 'Goblins 3 · ADI 4';
  main.innerHTML = `<section class="wgob3-page"><a href="#games" class="back-link">← Les jeux</a>
    <h1>Goblins 3</h1><p>L’aventure de Blount, dans l’édition française de ton disque ADI.</p>
    <iframe class="wgob3-frame" src="/wgob3/player.html" title="Goblins 3 — jeu original" allow="autoplay; fullscreen" allowfullscreen></iframe>
    <p class="quiet">Clique pour te déplacer ou agir. Clic droit pour ranger l’objet en main. Survole le haut de l’écran pour ouvrir le tableau de bord et sauvegarder. Échap permet de passer le générique.</p>
    <details class="wgob3-credits"><summary>À propos de cette version</summary>
      <p>Données originales de WGOB3, interprétées par le moteur Gob de ScummVM 2.9.0 compilé en WebAssembly.
      Analyse de l’exécutable Windows 16 bits avec Ghidra. Le moteur et les données sont servis localement.</p>
      <p><a href="/vendor/wgob3/COPYING">Licence du moteur</a> ·
      <a href="https://github.com/scummvm/scummvm/tree/v2.9.0">Sources ScummVM 2.9.0</a></p>
    </details></section>`;
}
